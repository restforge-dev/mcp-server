import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDataPush(server: McpServer): void {
  server.registerTool(
    'data_push',
    {
      title: 'Push Envelope Files into Database',
      description: `Load rows from JSON envelope files (data-storage/<table>.json, as written by 'data_pull') into database tables with batch INSERT driven by the SDF, by running npx restforge data push --json.

DESTRUCTIVE: writes rows into the target database and is append-only, so re-running inserts duplicates. Confirm the target config and tables with the user before calling.

USE WHEN:
- The user wants to import, seed, or restore rows from files ("push data", "seed data tabel", "import data ke database")
- The second half of moving data between databases after 'data_pull'

DO NOT USE FOR:
- Exporting rows to files -> 'data_pull'
- Updating or replacing rows -> not supported (no upsert)
- Creating tables -> the dbschema tools

NOTES:
- Give exactly one of 'table', 'schema' (one or comma-separated), or 'allSchemas'. Schema and allSchemas load tables in FK order.
- allSchemas also pushes every other schema with files, such as the auth-service seed in schema auth; use 'schema' or 'table' to push application data only.
- Report the inserted row and table counts from the summary; do not paste the raw JSON.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform; SDF + data-storage resolved from here)'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Target table name (must be registered in SDF). Use schema.table for schema-qualified tables. Exactly one of table/schema/allSchemas.'),
        schema: z
          .string()
          .min(1)
          .optional()
          .describe('Schema filter: one name or comma-separated (e.g. public,sales). Pushes SDF tables in those schemas that have a file, in FK parent->child order. Exactly one of table/schema/allSchemas.'),
        allSchemas: z
          .boolean()
          .optional()
          .describe('Push every SDF table that has a file under storage, across all schemas, in FK parent->child order. Exactly one of table/schema/allSchemas.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Target database config file (.env). When omitted, the CLI falls back to the default config.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe('SDF location (file or folder). When omitted, the CLI uses its default (schema).'),
        storagePath: z
          .string()
          .min(1)
          .optional()
          .describe('Source folder for envelope files, relative to cwd. When omitted, the CLI uses its default (data-storage).'),
        batchSize: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('INSERT batch size (also the commit unit). When omitted, the CLI uses its default (1000).'),
      },
      annotations: {
        title: 'Push Envelope Files into Database',
        readOnlyHint: false,
        idempotentHint: false, // append-only: re-running duplicates rows
        destructiveHint: true, // mutates the target database
      },
    },
    async ({ cwd, table, schema, allSchemas, config, schemaPath, storagePath, batchSize }) => {
      const projectCwd = resolve(cwd);

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

For the assistant:
- The user needs to install the RESTForge package before envelope files can be loaded into a database.
- Suggest installing the package first, then retry. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const scopeCount = [table, schema, allSchemas ? true : undefined].filter((v) => v !== undefined).length;
      if (scopeCount !== 1) {
        return {
          content: [
            {
              type: 'text',
              text: `Scope not specified correctly: provide exactly one of 'table', 'schema', or 'allSchemas' (got ${scopeCount}).

For the assistant:
- Ask the user which scope they want: a single table, one/more schemas, or every table with a file. Then retry with exactly one scope set.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'data', 'push'];
      if (table) args.push(`--table=${table}`);
      if (schema) args.push(`--schema=${schema}`);
      if (allSchemas) args.push('--all-schemas');
      if (config) args.push(`--config=${config}`);
      if (schemaPath) args.push(`--schema-path=${schemaPath}`);
      if (storagePath) args.push(`--storage-path=${storagePath}`);
      if (batchSize !== undefined) args.push(`--batch-size=${batchSize}`);
      args.push('--json');

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 120_000 });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to push data into the database.

Project path: ${projectCwd}
Scope: ${table ? `table=${table}` : schema ? `schema=${schema}` : 'all-schemas'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the data import did not complete. Note that, because import is append-only and commits per batch, some early batches/tables may already be inserted.
- Summarise the likely cause from the CLI output. Common causes by exit code: 1 = the envelope file is missing or its shape/columns do not match the SDF; 2 = usage problem (config required but no default, table not registered, schema matched no tables); 3 = database connection or INSERT error.
- Do not paste raw output unless the user asks. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Data loaded into the database (append-only INSERT).

Project path: ${projectCwd}
Scope: ${table ? `table=${table}` : schema ? `schema=${schema}` : 'all-schemas'}
Command: ${result.command}

--- CLI output (JSON summary) ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Read the JSON summary above and tell the user how many rows/tables were inserted.
- Remind the user this was append-only: running it again would insert the same rows a second time.
- Keep the reply concise. Do not paste the raw JSON unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
