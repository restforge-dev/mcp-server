import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenDbschemaIntrospect(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_introspect',
    {
      title: 'Introspect Database into dbschema-kit Files',
      description: `Reverse-engineer an existing database into SDF files (dbschema-kit factory functions), by running npx restforge schema introspect. The mode (single table, one schema, several schemas, all schemas) follows the combination of 'table', 'schema', and 'allSchemas'.

USE WHEN:
- The user wants schema files from an existing database ("buatkan schema dari database existing", "introspect DB ke schema files")
- Moving a legacy database to schema-as-code, or capturing the current structure before refactoring
- A dry-run preview before writing files

DO NOT USE FOR:
- Listing tables or describing one table without writing files -> 'codegen_list_tables' / 'codegen_describe_table'
- Generating an RDF payload -> 'codegen_generate_payload'
- Validating an SDF file -> 'codegen_dbschema_validate'
- Changing the database -> 'codegen_dbschema_migrate' / 'codegen_dbschema_apply'
- Reading row data -> out of scope

NOTES:
- 'schemaPath' is required in every mode, including dryRun.
- Confirm the mode with the user: modes produce different layouts (flat files or one subfolder per schema).
- Without force, existing files are not overwritten; confirm before passing force=true. Suggest dryRun=true first for an unfamiliar database.
- PostgreSQL soft-delete check: a table with a partial or mistyped is_deleted/deleted_at/deleted_by set, or without the consistency CHECK, blocks the whole run with exit 1 and a message starting "[restforge] ERROR: introspect blocked for table". Relay the message and its mitigation options; it is not a generic failure. A conforming table gets softDelete: { enabled: true }.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and the config file)'),
        config: z
          .string()
          .min(1)
          .default('db-connection.env')
          .describe('Config file name relative to the project, used by the CLI to connect to the database'),
        schemaPath: z
          .string()
          .min(1)
          .describe('Schema output target relative to cwd, mapped to the CLI flag --schema-path. Required for every mode, including dry-run. For single-table mode: a .js file path; for bulk modes: a folder path. Multi-schema bulk uses subfolders inside this folder.'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Single-table mode. Format: "users" or "inventory.products" (qualified). When omitted, bulk mode is used (combine with schema or allSchemas).'),
        schema: z
          .string()
          .min(1)
          .optional()
          .describe('Bulk mode filter: a single schema name ("inventory") or comma-separated list ("inventory,audit"). Mutually exclusive with allSchemas.'),
        allSchemas: z
          .boolean()
          .optional()
          .describe('Default false. When true, auto-detect all user schemas (skip system schemas). Mutually exclusive with schema and table.'),
        force: z
          .boolean()
          .optional()
          .describe('Default false. When true, overwrite existing output files. Without this, the CLI refuses to overwrite.'),
        dryRun: z
          .boolean()
          .optional()
          .describe('Default false. When true, print the factory function content to stdout and do NOT write any file.'),
      },
      annotations: {
        title: 'Introspect Database into dbschema-kit Files',
        destructiveHint: false, // writes files (and may overwrite with force=true), but no live DB mutation; reversible by deleting outputs
        idempotentHint: false,  // first call writes new files; subsequent calls behave differently depending on force
      },
    },
    async ({ cwd, config, schemaPath, table, schema, allSchemas, force, dryRun }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: @restforgejs/platform must be present in node_modules. per §3.4
      try {
        await access(join(projectCwd, 'node_modules', '@restforgejs', 'platform'));
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the RESTForge package is not installed in this project.

Project path: ${projectCwd}
Expected location: node_modules/@restforgejs/platform
Requested config: ${config}
Requested schemaPath: ${schemaPath}
Requested table: ${table ?? '(none)'}
Requested schema: ${schema ?? '(none)'}
Requested allSchemas: ${allSchemas ?? false}
Requested force: ${force ?? false}
Requested dryRun: ${dryRun ?? false}

For the assistant:
- The user needs to install the RESTForge package before the database can be introspected.
- Suggest installing the package first, then retry the introspection.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. The CLI handles mode resolution
      // and mutual-exclusivity rules. per §3.5
      const cliArgs = ['restforge', 'schema', 'introspect', `--config=${config}`, `--schema-path=${schemaPath}`];
      if (table !== undefined) cliArgs.push(`--table=${table}`);
      if (schema !== undefined) cliArgs.push(`--schema=${schema}`);
      if (allSchemas === true) cliArgs.push('--all-schemas');
      if (force === true) cliArgs.push('--force');
      if (dryRun === true) cliArgs.push('--dry-run');

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 60_000,
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // The CLI signals "dry-run completed" with exit code 2 (it throws 'schema introspect
      // dry-run complete' with exitCode=2), but usage errors also exit 2. Exit 2 only counts
      // as dry-run success when dry-run was actually requested AND the combined output carries
      // the dry-run completion marker; any other exit 2 falls through to the error branch.
      // per D-00.2 / D-00.6
      const combinedOutput = `${result.stdout}\n${result.stderr}`;
      const isDryRunSuccess =
        dryRun === true &&
        result.exitCode === 2 &&
        /dry-run complete/i.test(combinedOutput);

      // Branch C: real CLI failure (any non-zero exit other than dry-run sentinel). per §3.4
      if (!result.success && !isDryRunSuccess) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to introspect the database.

Project path: ${projectCwd}
Config: ${config}
SchemaPath: ${schemaPath}
Table: ${table ?? '(none)'}
Schema: ${schema ?? '(none)'}
allSchemas: ${allSchemas ?? false}
Force: ${force ?? false}
DryRun: ${dryRun ?? false}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that introspecting the database did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Config file not found — suggest verifying the config path and that the file exists.
  * Database connection failed — suggest verifying credentials, host, and port.
  * Schema path missing or invalid — the CLI requires --schema-path for every mode, including dry-run.
  * Output file exists without --force — suggest passing force=true if the user really wants to overwrite, or picking a different schema path.
  * Conflicting flags — e.g. table together with allSchemas, or schema together with allSchemas. The CLI rejects these combinations; suggest picking a single mode.
  * Soft-delete contract violation (PostgreSQL) — the output contains "introspect blocked for table". This is a strict block, NOT a generic failure: the message lists the exact non-conformance (partial columns, wrong types, or missing consistency CHECK) and concrete mitigation options (possibly including a ready-to-run ALTER TABLE statement). Present the full blocked-table message including its options to the user — this is an exception to the no-paste rule below.
  * Unknown command 'schema introspect' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Derive a human-readable mode label for the labeled facts. The CLI is the source of
      // truth for actual mode resolution; this label is informational only.
      let modeLabel: string;
      if (dryRun === true) {
        modeLabel = table !== undefined ? 'dry-run (single-table)' : 'dry-run (bulk)';
      } else if (table !== undefined) {
        modeLabel = 'single-table';
      } else if (allSchemas === true) {
        modeLabel = 'bulk all-schemas';
      } else if (schema !== undefined) {
        modeLabel = schema.includes(',') ? 'bulk multi-schema' : 'bulk single-schema';
      } else {
        modeLabel = 'bulk default';
      }

      // Branch B: success (write or dry-run). per §3.5
      const summaryHeading = isDryRunSuccess
        ? 'Database introspection dry-run completed (no files were written).'
        : 'Database introspection completed.';
      const fenceLabel = isDryRunSuccess ? 'Factory function preview' : 'CLI output';

      return {
        content: [
          {
            type: 'text',
            text: `${summaryHeading}

Project path: ${projectCwd}
Config: ${config}
Mode: ${modeLabel}
Schema path: ${schemaPath}
Table: ${table ?? '(not specified)'}
Schema: ${schema ?? '(not specified)'}
allSchemas: ${allSchemas ?? false}
Force overwrite: ${force ?? false}

--- ${fenceLabel} ---
${result.stdout}
--- end ${fenceLabel} ---

For the assistant:
- Confirm to the user that the introspection ${isDryRunSuccess ? 'preview' : 'run'} completed. Mention the mode and the output target in plain language.
- ${isDryRunSuccess ? 'This was a preview only. No files were written to disk.' : 'Output files use the factory function pattern, ready to be validated. Suggest validating them as the next step (without naming the internal tool).'}
- The introspected dialect is auto-detected from the config; database types are mapped to generic types (string, integer, decimal, boolean, date, timestamp, uuid, json) so the schema files are dialect-portable.
- For multi-schema layouts (multiple schemas in the schema flag, or allSchemas=true), files are organised in subfolders per schema to avoid name collisions.
- ${isDryRunSuccess ? 'When the user is ready to commit the result to disk, mention that the same call without dry-run will write the files.' : 'This is a write operation. Files in the output target may have been created or overwritten if force=true was used.'}
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
