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
      description: `Generate an RDF payload file (fields, metadata, action specs) from a database table, by running npx restforge payload generate. Table 'guest_book' becomes payload/guest-book.json.

USE WHEN:
- The user asks for a payload from a table ("buatkan payload dari table X", "generate payload guest_book")
- A table was just created and the request covers building its API
- Regenerating a payload after a schema change
- A master-detail (header-detail) pair -> 'detail' with one or more detail tables

DO NOT USE FOR:
- Credentials in the env file -> 'setup_write_env'
- Validating the config -> 'setup_validate_config'
- Making the payload runnable -> 'codegen_create_endpoint'
- Applying schema drift to an existing payload -> 'codegen_sync_payload'
- A frontend UDF -> 'codegen_migrate_payload'

NOTES:
- 'schemaPath' is required when the table has soft-delete columns (is_deleted, deleted_at, deleted_by): the softDelete block comes from the SDF, and the CLI fails without it. The SDF also supplies CHECK constraints for fieldValidation and checkConstraints; without an SDF that step is skipped.
- 'detail' adds a masterDetail block, one detail query file per table, and composite actions. Every detail table needs an FK to the master primary key. Each entry's cardinality (one/many) is derived from the SDF; read it in the generated RDF. An existing masterDetail block is kept.
- 'output' other than payload/ means the file must be moved back before 'codegen_create_endpoint'.
- JOIN columns are never generated here; use 'codegen_sync_payload' with expandFk.
- With TENANT_MODE=multi, a table with a tenant_id column gets requestScope when the RDF has none, so 'codegen_create_endpoint' accepts it.`,
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
          .describe('Detail table name, or several names separated by commas (e.g. vendor,customer), for master-detail generation. When set, the generated payload also contains a masterDetail block plus one detail query file per table, and the composite actions are enabled. Each table becomes one masterDetail.details[] entry with cardinality "one" when its foreignKey column has a single-column unique in the SDF, otherwise "many"; a single "many" table keeps the flat detailTable/detailConfig shape. Every table must differ from the table parameter and must reference the master table primary key by foreign key.'),
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
