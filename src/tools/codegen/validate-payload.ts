import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';
import { configArgs, configLabel } from '../../lib/default-config.js';

export function registerCodegenValidatePayload(server: McpServer): void {
  server.registerTool(
    'codegen_validate_payload',
    {
      title: 'Validate Payload',
      description: `Check whether existing CRUD payload files (RDF with tableName and fieldName) are still in sync with the database, by running npx restforge payload validate. Read-only; reports OK, DRIFT, or ERROR per file.

USE WHEN:
- The user asks whether payloads are still in sync ("cek drift payload", "apakah payload masih sinkron")
- After ALTER TABLE or new database migrations, to find affected payloads
- A quick status pass before 'codegen_diff_payload'

DO NOT USE FOR:
- Column-level detail -> 'codegen_diff_payload'
- Updating payloads to match the database -> 'codegen_sync_payload'
- A table with no payload -> 'codegen_generate_payload'
- Config, license, or connection checks -> 'setup_validate_config'
- Dashboard payloads (a widgets array) -> 'codegen_validate_dashboard_payload'

NOTES:
- 'table' limits the check to one payload.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and the config file)'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Config file name relative to the project, used by the CLI to connect to the database. When omitted, the CLI uses the default recorded by config set-default.'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Specific table name to check (e.g. supplier or core.supplier). When omitted, all payload files in the payload/ directory are checked.'),
      },
      annotations: {
        title: 'Validate Payload',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, config, table }) => {
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
Requested table: ${table ?? 'all'}
Requested config: ${configLabel(config)}

For the assistant:
- The user needs to install the RESTForge package before payload files can be validated against the database schema.
- Use the appropriate package-installation tool to do this, then retry validating the payload.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. Defaults inside restforge
      // (e.g. payload/ as the default output dir, all files when --table is omitted)
      // should remain in effect when the user does not specify them. per §3.5
      const args = ['restforge', 'payload', 'validate', ...configArgs(config)];
      if (table) args.push(`--table=${table}`);

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 30_000 });

      // CLI failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to validate payload.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Table: ${table ?? 'all'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the payload validation did not complete successfully.
- Summarise the likely cause from the CLI output in plain language (common causes: the config file is missing or has incomplete credentials, the database is unreachable, the requested table does not exist, or the payload directory is empty). Do not paste the raw stdout/stderr unless the user explicitly asks.
- Offer to retry once the underlying issue is resolved. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Success: one-line summary + labeled facts + fenced raw output per §3.5.
      // The CLI prints a Summary section with counts (OK / DRIFT / ERROR); the
      // model should extract those numbers from stdout when talking to the user.
      return {
        content: [
          {
            type: 'text',
            text: `Payload validation completed.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Table: ${table ?? 'all'}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Read the Summary section in the CLI output above and tell the user how many payload files are OK, in DRIFT, or in ERROR.
- If every file is OK, confirm in plain language that the payload files are still in sync with the database. The next step is generating the endpoint module ('codegen_create_endpoint'). When the user's request already covers the endpoint, continue with it instead of stopping here; otherwise offer it in one sentence.
- If any file is in DRIFT or ERROR, suggest as the next step that the user can see the column-level differences for the affected file (added, removed, or changed columns). Do not name the internal tool — describe it by what it does.
- If the user later wants to apply those changes, mention that the next step is to update the payload files automatically (with the previous version archived). Describe this step in plain language; do not name the internal tool.
- Keep the reply concise. Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
