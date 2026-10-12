import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenDbschemaValidate(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_validate',
    {
      title: 'Validate dbschema-kit Files',
      description: `Validate SDF schema files (defineModel structure, field types, length, nullable, primary key, defaults, FK targets, soft-delete contract), by running npx restforge schema validate. With 'config' it also compares each model with the live database.

USE WHEN:
- The user asks to validate schema files ("validasi schema saya", "cek apakah schema valid")
- Right after writing or editing schema/<table>.js, before generating DDL or migrating
- Checking an FK or relation, or after introspection
- One verdict per table that also covers the database ("schema valid dan sesuai database?") -> pass config

DO NOT USE FOR:
- RDF payload files -> 'codegen_validate_payload'; dashboard payloads -> 'codegen_validate_dashboard_payload'
- SQL statements -> 'codegen_validate_sql'
- Syntax lookup -> 'codegen_get_dbschema_catalog'
- Generating or applying DDL -> 'codegen_dbschema_generate_ddl' / 'codegen_dbschema_migrate' / 'codegen_dbschema_apply'
- A per-column drift report -> 'codegen_dbschema_diff'

NOTES:
- 'schemaPath' is required (e.g. ./schema or schema/users.js); confirm it with the user when not mentioned.
- Without 'config' the run is file-only; the default config is NOT used.
- With 'config', each model gets [OK], [DRIFT] (valid but differs from the table), or [ERROR] with table-missing (migrate or apply fixes it) or sdf-invalid.
- 'table' limits the report to one table; all files are still loaded for FK checks.
- Exit 0: all OK. Exit 1: validation errors, or a DRIFT/ERROR verdict; with config this is a result, not a tool failure. Exit 2: config invalid, connection failed, or table not in the SDF.
- Soft-delete: is_deleted, deleted_at, and deleted_by must all exist with the right types exactly when softDelete.enabled is true. Reusable unique columns need a single-column string UNIQUE with length >= base + 38.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
        schemaPath: z
          .string()
          .min(1)
          .describe('Path to schema file or folder relative to cwd (e.g. "./schema" or "schema/users.js"). Required by the CLI.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Database config file (e.g. "db-connection.env"). When given, the SDF is also compared with the table structure in the database. When omitted, only the files are validated (the default config is not used).'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Report only one table. All models in the schema path are still loaded and validated.'),
        json: z
          .boolean()
          .optional()
          .describe('Request the JSON report ({ schemaVersion, mode, summary, issues, models? }) instead of the human-readable output.'),
      },
      annotations: {
        title: 'Validate dbschema-kit Files',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, schemaPath, config, table, json }) => {
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
Requested schema path: ${schemaPath}

For the assistant:
- The user needs to install the RESTForge package before schema files can be validated.
- Suggest installing the package first, then retry validating the schema.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // CLI v4+ requires --schema-path as a flag (no positional, no default). Optional
      // flags forwarded only when supplied; config is never defaulted so that file-only
      // mode stays the default. per §3.5
      const cliArgs = ['restforge', 'schema', 'validate', `--schema-path=${schemaPath}`];
      if (config !== undefined) cliArgs.push(`--config=${config}`);
      if (table !== undefined) cliArgs.push(`--table=${table}`);
      if (json === true) cliArgs.push('--json');

      const databaseMode = config !== undefined;
      const context = `Project path: ${projectCwd}
Schema path: ${schemaPath}
Mode: ${databaseMode ? `file and database (config: ${config})` : 'file only'}
Table filter: ${table ?? 'all tables'}`;

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: databaseMode ? 60_000 : 30_000, // database mode introspects every compared table
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Branch B (verdicts): file and database mode, exit 1 — at least one DRIFT or ERROR
      // verdict. A meaningful result, NOT a tool failure. per §3.5
      if (databaseMode && result.exitCode === 1) {
        return {
          content: [
            {
              type: 'text',
              text: `Schema validation against the database completed: some models are not OK (this is a result, not an error).

${context}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Present this as a factual result per table, NOT a failure.
- [DRIFT] means the file is valid but differs from the database (columns, types, indexes, uniques, or FKs). Additive changes can be applied incrementally with the apply action (preview first); for per-column detail, offer the drift check action.
- [ERROR] table-missing means the table has not been created in the database yet. Suggest migrate or apply.
- [ERROR] sdf-invalid means the schema file failed validation and was not compared. Help fix the file using the catalog (do not invent rules from training data).
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names.
- Match the user's language.`,
            },
          ],
        };
      }

      // Branch C: CLI failure — real error per §3.4 (file-mode validation failures and
      // exit 2 system errors land here). per §3.5
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Schema validation failed.

${context}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the schema validation surfaced one or more issues (or could not run at all).
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Single-model error — a field has an invalid type, constraint, or shorthand. Suggest reviewing the offending file and consulting the schema catalog for valid syntax.
  * Cross-model error — a foreign key references a table or column that does not exist in any sibling schema file. Suggest checking the FK target name and that the referenced model is included in the same path.
  * Schema folder not found — the CLI cannot locate the path. Suggest verifying the folder name passed via --schema-path.
  * Missing required flag --schema-path — the CLI now requires this flag explicitly. Confirm the path with the user.
  * Exit code 2 — the config file is missing or invalid, the database connection failed, or the table name is not in the schema files. Suggest verifying the config, credentials, and table name.
  * Unsupported dialect — the database comparison does not support sqlite yet. Suggest file-only validation (without config) or a postgres/mysql/oracle config.
  * Unknown command 'schema validate' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Read the per-file error report in the CLI output to identify the failing file and field. Help the user fix it by referencing the catalog (do not invent rules from training data).
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B: success — labeled facts + fenced raw output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Schema validation passed.

${context}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that all schema files are valid. If the CLI output lists per-file status lines or [OK] verdicts, count them and mention the count in plain language.
- The validation covers both single-model (type, length, nullable, primary key, default value) and cross-model (FK target table existence, referenced column existence). All layers passed.
- In file and database mode, every compared table also matches the database structure.
- The next step is applying the schema: 'codegen_dbschema_migrate' (dryRun first) for tables that do not exist yet, or 'codegen_dbschema_diff' then 'codegen_dbschema_apply' for an existing database. When the user's request already covers applying the schema, continue with it (the destructive-operation confirmation still applies); otherwise offer it in one sentence.
- Do not paste the raw CLI output unless the user explicitly asks.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
