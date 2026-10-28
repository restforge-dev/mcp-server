import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';
import { configArgs, configLabel } from '../../lib/default-config.js';

export function registerCodegenListTables(server: McpServer): void {
  server.registerTool(
    'codegen_list_tables',
    {
      title: 'List Database Tables',
      description: `List the tables and views in the project's database, by running npx restforge schema list (live catalog query).

USE WHEN:
- The user asks which tables exist ("tabel apa saja yang ada di database", "show me the tables")
- Before writing SQL or generating a payload when the table catalog is unknown
- Checking whether a named table exists, or exploring an unfamiliar database
- Filtering by schema ("tabel di schema public saja")

DO NOT USE FOR:
- Columns, keys, or indexes of one table -> 'codegen_describe_table'
- Payload files on disk -> file tools
- Payload vs database sync -> 'codegen_validate_payload'
- Row data -> out of scope
- Changing tables -> edit the SDF, then 'codegen_dbschema_migrate' or 'codegen_dbschema_apply'
- Listing schemas or databases themselves -> out of scope

NOTES:
- The dialect comes from the config. The 'schema' filter means a PostgreSQL schema, a MySQL database, or an Oracle owner (uppercase for Oracle).`,
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
        schema: z
          .string()
          .min(1)
          .optional()
          .describe('Filter to a specific database schema/owner. Postgres: schema name (e.g. public); MySQL: database name; Oracle: owner (uppercase). When omitted, lists tables from all user-owned schemas.'),
        includeSystem: z
          .boolean()
          .optional()
          .describe("Default false. When true, include system tables (Postgres: pg_catalog, information_schema; MySQL: mysql, performance_schema, sys; Oracle: SYS, SYSTEM, etc). Most users do NOT want this."),
      },
      annotations: {
        title: 'List Database Tables',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, config, schema, includeSystem }) => {
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
Requested config: ${configLabel(config)}
Requested schema filter: ${schema ?? 'all user-owned schemas'}
Requested includeSystem: ${includeSystem ?? false}

For the assistant:
- The user needs to install the RESTForge package before the database table list can be retrieved.
- Suggest installing the package first, then retry listing the tables.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. CLI defaults remain in
      // effect when the user does not specify them. per §3.5
      // --format=json is always sent: the CLI default is a human-readable table,
      // while this tool depends on JSON.parse of stdout.
      const cliArgs = [
        'restforge',
        'schema',
        'list',
        ...configArgs(config),
        '--format=json',
      ];
      if (schema !== undefined) cliArgs.push(`--schema=${schema}`);
      if (includeSystem !== undefined) cliArgs.push(`--include-system=${includeSystem}`);

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 30_000,
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Branch C: CLI failure — real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to list database tables.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Schema filter: ${schema ?? 'all user-owned schemas'}
includeSystem: ${includeSystem ?? false}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that listing the database tables did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Config file not found — suggest verifying the path and that the file exists in the project.
  * Database connection failed — suggest verifying the credentials, that the host is reachable, and that the port is open.
  * Unknown command 'schema list' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the underlying issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch D: JSON parse failure — real error per §3.4 (CLI succeeded but produced invalid output).
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to parse the database table list as JSON.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Reason: ${msg}

--- Raw stdout ---
${result.stdout}
--- end Raw stdout ---

For the assistant:
- The CLI returned output that is not valid JSON.
- Summarise this to the user in plain language; do not paste the raw stdout unless they explicitly ask.
- Suggest checking that the installed RESTForge package version is compatible. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Defensive labeled facts: if the JSON shape changes upstream, fall back to 'unknown' / 'n/a'
      // rather than crashing. Mirror the catalog tools pattern.
      const root = (parsed ?? {}) as Record<string, unknown>;
      const summary = (root.summary ?? {}) as Record<string, unknown>;
      const totalTables =
        typeof summary.totalTables === 'number' ? summary.totalTables : 'unknown';
      const databaseType =
        typeof summary.database === 'string' ? summary.database : 'unknown';
      const schemasInResult = Array.isArray(summary.schemas)
        ? `[${(summary.schemas as unknown[]).map((s) => JSON.stringify(s)).join(', ')}]`
        : 'unknown';

      const prettyJson = JSON.stringify(parsed, null, 2);

      // Branch B: success — one-line summary + labeled facts + fenced JSON output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Database tables retrieved successfully.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Database: ${databaseType}
Schema filter: ${schema ?? 'all user-owned schemas'}
totalTables: ${totalTables}
schemas in result: ${schemasInResult}

--- Database Tables (JSON) ---
${prettyJson}
--- end Database Tables (JSON) ---

For the assistant:
- Confirm to the user that the table list was retrieved. Mention the database type and the total count in plain language.
- If a specific table was named in the user's question, find it in the list and confirm whether it exists; if not found, say so explicitly.
- Do not paste the full JSON unless the user asks. Summarise instead — for many tables, group by schema or list only the names relevant to the user's task.
- This is a read-only operation: it queries the database catalog tables (information_schema / pg_catalog / all_tables) without modifying anything.
- For deeper details on a specific table (columns, primary key, foreign keys, indexes), suggest the table-describe action as the next step. Do not mention internal tool names.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
