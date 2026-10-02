import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenGeneratePayload(server: McpServer): void {
  server.registerTool(
    'codegen_generate_payload',
    {
      title: 'Generate Payload',
      description: `Generate a payload spec file (metadata, fields, action specs) from a database table by introspecting its schema via restforge.

USE WHEN:
- The user asks to generate a payload, payload spec, or payload metadata file from a database table
- The user asks things like "buatkan payload dari table X", "generate payload guest_book", "scan schema table to JSON", "create payload for endpoint generation"
- The user wants to "introspect" or "scan" a database table into a JSON spec
- Starting CLI codegen workflow after the project config has been validated
- Re-generating payload after a schema change in the database

DO NOT USE FOR:
- Filling in credentials in db-connection.env -> use 'setup_write_env'
- Validating config before generating payload -> use 'setup_validate_config'
- Creating the project / endpoint code from a payload -> that is the next CLI step (will be wrapped in a future tool, not yet available)

This tool runs: npx restforge payload generate --table=<table> --config=<config> [--output=<dir>] [--schema-path=<path>] [--detail=<table>] in the given cwd.
The CLI connects to the database described in the config file, reads the table schema,
and writes a payload JSON file (e.g. table 'guest_book' -> 'guest-book.json' with underscore
mapped to hyphen). The payload file is the input for the next codegen step (project + endpoint creation).

Optional flags and when they matter:
- 'output': write the payload somewhere other than the default 'payload/' folder. Note that the endpoint generator reads from 'payload/', so a custom output folder means the file has to be moved back before generating code.
- 'schemaPath': location of the schema definition files (SDF). REQUIRED when the table has soft-delete columns (is_deleted / deleted_at / deleted_by): the softDelete block of the payload is derived from the SDF, and the CLI fails with an explicit error when the table has those columns but no matching SDF declaration. The SDF is also used to derive CHECK constraints into fieldValidation (enum, min, max, notEqual) and the checkConstraints registry; when no SDF is found, that derivation is skipped.
- 'detail': name of the detail table for a master-detail (header-detail) pair. The payload then also gets a fully populated 'masterDetail' block plus a generated detail query file, and the composite actions are enabled. The detail table must have a foreign key referencing the master table's primary key. An existing 'masterDetail' block in the target file is preserved, not overwritten.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The config file (default 'db-connection.env') must exist in the project and contain valid
  database credentials. This tool does not pre-check that — if the CLI fails, the failure response
  will surface the underlying cause.

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user. Describe actions by what they do (e.g. "install the package", "fill in the credentials", "generate the payload").
- Speak in plain language. Summarise the result; do not paste raw CLI output unless the user explicitly asks.
- When a precondition is not met, frame it as a question or next-step suggestion rather than an error.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and the config file)'),
        table: z
          .string()
          .min(1)
          .describe('Name of the database table to introspect (e.g. guest_book)'),
        config: z
          .string()
          .min(1)
          .default('db-connection.env')
          .describe('Config file name (relative to project) used by the CLI to connect to the database'),
        output: z
          .string()
          .min(1)
          .optional()
          .describe('Output directory for the generated payload file. Omit to use the CLI default (payload/). The endpoint generator expects the payload in payload/, so only set this when the user explicitly asks for another location.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe("Schema definition (SDF) location, file or folder. Omit to use the CLI default ('schema'). Required to cover the table when it has soft-delete columns (is_deleted/deleted_at/deleted_by), because the softDelete block is derived from the SDF. Also used to derive CHECK constraints (enum, min, max, notEqual) into the payload."),
        detail: z
          .string()
          .min(1)
          .optional()
          .describe('Detail table name for master-detail generation. When set, the generated payload also contains a masterDetail block derived from the detail table plus a generated detail query file, and the composite actions are enabled. Must differ from the table parameter and must reference the master table primary key by foreign key.'),
      },
      annotations: {
        title: 'Generate Payload',
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    async ({ cwd, table, config, output, schemaPath, detail }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: @restforgejs/platform must be present in node_modules.
      // Treated as a non-error precondition per the authoring guide §3.4.
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
Requested table: ${table}
Requested config: ${config}

For the assistant:
- The user needs to install the RESTForge package before a payload can be generated from a table schema.
- Use the appropriate package-installation tool to do this, then retry generating the payload.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Optional flags are only appended when the caller set them, so a call without
      // them produces exactly the same CLI invocation as before.
      const cliArgs = ['restforge', 'payload', 'generate', `--table=${table}`, `--config=${config}`];
      if (output !== undefined) cliArgs.push(`--output=${output}`);
      if (schemaPath !== undefined) cliArgs.push(`--schema-path=${schemaPath}`);
      if (detail !== undefined) cliArgs.push(`--detail=${detail}`);

      const result = await execProcess('npx', cliArgs, { cwd: projectCwd, timeout: 30_000 });

      // CLI failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to generate payload.

Project path: ${projectCwd}
Table: ${table}
Config: ${config}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that generating the payload did not complete successfully.
- Summarise the likely cause from the CLI output in plain language (common causes: the config file is missing or has incomplete credentials, the database is unreachable, or the requested table does not exist in the database). Do not paste the raw stdout/stderr unless the user explicitly asks.
- Offer to retry once the underlying issue is resolved. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Success: one-line summary + labeled facts + fenced raw output per §3.5.
      // The CLI itself prints the output filename in stdout; we do not try to re-derive it here.
      return {
        content: [
          {
            type: 'text',
            text: `Payload generated successfully.

Project path: ${projectCwd}
Table: ${table}
Config: ${config}
Output directory: ${output ?? 'payload/ (CLI default)'}
Schema path (SDF): ${schemaPath ?? 'schema (CLI default)'}
Detail table (master-detail): ${detail ?? '(not requested)'}
Output: payload file generated by restforge (see CLI output below for the exact filename; underscores in the table name are mapped to hyphens, e.g. 'guest_book' -> 'guest-book.json').

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that the payload spec for the requested table is ready.
- The next steps are validating this payload ('codegen_validate_payload') and then generating the endpoint module from it ('codegen_create_endpoint'). When the user's request already covers the endpoint, continue with those steps instead of stopping here.
${detail
  ? `- The masterDetail block, the detail query file, and the composite actions were generated from '${detail}'. Only the 'headerCalculations' and 'calculated' formulas are filled in by hand, grounded in the RESTForge handbook (catalogs/rdf/master-detail.md).`
  : `- For a header-detail module, re-run this tool with 'detail' set to the detail table instead of writing masterDetail by hand. A status-driven lifecycle ('workflow' block and its action key) is not generated and is added manually, grounded in the RESTForge handbook (catalogs/rdf/workflow.md). Only raise this when the user's intent points to such a module.`}
- Keep the reply concise. Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
