import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirror of the CLI's own payload lookup for the dashboard command
 * (PayloadValidator.findPayloadFile): the value is used verbatim, first under
 * '<cwd>/payload/', then under '<cwd>'. No extension is appended anywhere —
 * that is exactly why the pre-flight must not normalise the argument either.
 * Deliberately local to the dashboard tools: create-endpoint and the other
 * codegen tools keep their own extensionless convention, so a shared helper
 * would change their behaviour too.
 */
async function resolvePayloadPath(projectCwd: string, payload: string): Promise<string | null> {
  for (const candidate of [join(projectCwd, 'payload', payload), join(projectCwd, payload)]) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export function registerCodegenCreateDashboard(server: McpServer): void {
  server.registerTool(
    'codegen_create_dashboard',
    {
      title: 'Create Dashboard Module',
      description: `Generate a multi-widget dashboard endpoint module from a dashboard payload (a 'widgets' array of SQL aggregations, no table, no CRUD actions) by wrapping restforge dashboard. URL pattern produced: POST /api/{project}/{name}/dashboard.

DESTRUCTIVE: with the default force=true an existing dashboard module is overwritten (the CLI first copies the previous module to '.restforge/archive/<run>/') and the project is re-registered under this call's 'database' value. There is no preview; check the payload with 'codegen_validate_dashboard_payload' first. Confirm intent with the user BEFORE calling, e.g. "Saya akan generate dashboard <name> di project <project>. Versi lama, bila ada, diarsipkan ke .restforge/archive. Lanjut?".

USE WHEN:
- The user asks to generate or scaffold a dashboard, multi-widget aggregator, or analytics endpoint ("buatkan dashboard sales di project Y", "generate dashboard inbound")
- A payload with a 'widgets' array exists and the user wants it runnable, or wants it regenerated after the payload changed

DO NOT USE FOR:
- A CRUD endpoint (payload has 'tableName', 'fieldName', 'action') -> 'codegen_create_endpoint'
- Checking a dashboard payload without writing -> 'codegen_validate_dashboard_payload'
- Looking up the dashboard payload contract -> 'codegen_get_dashboard_catalog'
- A processor -> 'codegen_create_processor'; deleting a project -> 'project_delete'
- Widget presentation (widgetType, layout, color, title, subtitle): frontend concerns, forbidden in the payload

DATABASE TYPE: the CLI uses '--database' when given, otherwise postgres. It does NOT read DB_TYPE from the config (unlike 'codegen_create_endpoint'), so pass the project's real database whenever it is not postgres; the dialect is baked into the generated SQL.

FORCE=FALSE: never prompts. When nothing conflicts it generates normally. When the module file exists the CLI stops with "Dashboard module already exists at '<path>'..." and writes nothing; when the project is registered under a different database type it stops with "Cannot change to '<db>' without --force.". The shared main module 'src/modules/<project>.js' is skipped, not failed, when it exists. Use force=false to find out whether the dashboard exists, or when the registered database type must not change.

FILES: the CLI writes 'src/modules/<project>.js', 'src/modules/<project>/<name>.js', 'metadata/<project>/<name>.json', and updates '.restforge/projects.json'. An overwritten module is first copied to '.restforge/archive/<run>/<original relative path>' (the 5 most recent runs are kept), so rollback is always possible.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The 'payload' value is passed verbatim and must carry '.json': the CLI looks for '<cwd>/payload/<payload>' then '<cwd>/<payload>'.
- The payload must follow the dashboard schema. The CLI's DashboardValidator rejects mixed CRUD shapes, forbidden frontend fields, widgets without 'id', duplicate ids, a widget with both or neither of 'query' and 'queries', and placeholders not declared in 'params'.
- The dashboard name MUST start with 'dash-' (e.g. dash-sales); the prefix becomes part of the URL.

NOTES:
- After the run, surface the endpoint URL (POST /api/<project>/<name>/dashboard) and any archive activity ('.restforge/archive/<run>/').
- Dashboard vs CRUD: a dashboard aggregates several SQL queries into a JSON envelope keyed by widget id; a CRUD endpoint exposes /datatables, /read, /create, /update, /delete on one table.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and a payload/ directory with the named payload file)'),
        project: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'must start with a letter or number; only letters, numbers, dashes, underscores allowed')
          .describe('Project name. Letters/numbers/dash/underscore, max 50 chars, cannot start or end with dash or underscore. Auto-lowercased by the CLI. Reserved names rejected by the CLI: src, lib, node_modules, config, utils, models, controllers, middleware, routes.'),
        name: z
          .string()
          .min(6)
          .max(50)
          .regex(/^dash-[a-zA-Z0-9_-]+$/, "must start with 'dash-' prefix and have at least one character after it (e.g. dash-sales, dash-inbound)")
          .describe("Dashboard name. MUST start with 'dash-' prefix. The prefix is required by the CLI and becomes part of the URL segment (POST /api/{project}/{name}/dashboard). The full name is the URL slug, e.g. dash-sales, dash-inbound. The CLI rejects 'dash-' alone — there must be at least one character after the prefix."),
        payload: z
          .string()
          .min(1)
          .max(200)
          .regex(
            /^[a-zA-Z0-9][a-zA-Z0-9._\\/-]*$/,
            'must start with a letter or number; letters, numbers, dot, dash, underscore and path separators are allowed'
          )
          .refine((v) => !v.split(/[\\/]/).includes('..'), { message: "must not contain a '..' path segment" })
          .describe("Payload file name or relative path, WITH the .json extension (e.g. 'dashboard-sales.json' or 'payload/dashboard-sales.json'). The value is passed to the CLI exactly as written — nothing is stripped or appended — and the CLI resolves it against '<cwd>/payload/' first, then '<cwd>'. The CLI does not add '.json' itself, so an extensionless name such as 'dashboard-sales' fails with 'Payload file not found'. Payload must follow the dashboard schema (with a `widgets` array; NOT a CRUD payload with `tableName`)."),
        database: z
          .enum(['postgres', 'oracle', 'mysql', 'sqlite'])
          .optional()
          .describe("Database type for the generated code. Accepted values match the CLI's own list for this command: postgres, oracle, mysql, sqlite. Optional, and when it is left unset this tool sends '--database=postgres' explicitly, which is also the CLI's own default for 'dashboard create'. NOTE — unlike 'codegen_create_endpoint', the dashboard CLI handler does NOT auto-detect DB_TYPE from the active config: it only applies a plain postgres default. So for any project that is not postgres, set this parameter explicitly, otherwise the generated dashboard module targets the wrong dialect."),
        skipSqlValidation: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip SQL keyword validation in payload widget queries. Useful when the SQL fragments are intentional but the validator flags them as suspicious.'),
        force: z
          .boolean()
          .default(true)
          .describe("Default true — the existing behaviour: overwrite an existing dashboard module (the CLI first copies the previous module to .restforge/archive/<run>/) and re-register the project under the 'database' value of this call. Set to false for the non-overwrite path: generation still proceeds when nothing conflicts, but an existing dashboard module or a different registered database type makes the CLI stop with a clean error and write nothing. The dashboard command has no interactive prompt, so force=false never hangs the call."),
      },
      annotations: {
        title: 'Create Dashboard Module',
        readOnlyHint: false,    // tool spawns CLI that writes module/metadata files and updates the registry
        destructiveHint: true,  // can overwrite an existing dashboard module file (CLI archives it to .restforge/archive/<run>/ first)
        idempotentHint: false,  // re-running creates new archive files
      },
    },
    async ({ cwd, project, name, payload, database, skipSqlValidation, force }) => {
      const projectCwd = resolve(cwd);
      const dbType = database ?? 'postgres';

      // Pre-flight 1: @restforgejs/platform must be installed. Treated as a non-error precondition per §3.4.
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
Requested project: ${project}
Requested dashboard: ${name}
Requested payload: ${payload}
Requested database: ${dbType}

For the assistant:
- The dashboard generator can only run once the RESTForge package is installed locally.
- Suggest installing the package first, then retry generating the dashboard.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Pre-flight 2: payload file must exist. Treated as a non-error precondition per §3.4.
      // The argument is checked as written, using the same candidate list as the CLI, so the
      // pre-flight can never accept something the CLI would then reject (or the reverse).
      const payloadPath = await resolvePayloadPath(projectCwd, payload);
      if (payloadPath === null) {
        // Frequent caller mistake: an extensionless name. The CLI does not append '.json',
        // and this tool no longer appends it either, so say so explicitly instead of
        // silently rewriting the argument.
        const extensionHint =
          !payload.toLowerCase().endsWith('.json') && (await resolvePayloadPath(projectCwd, `${payload}.json`)) !== null
            ? `\nNOTE: '${payload}.json' does exist. The payload argument is passed to the CLI verbatim and the CLI never appends an extension, so retry with payload='${payload}.json'.`
            : '';
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: payload file not found.

Project path: ${projectCwd}
Payload argument: ${payload}
Locations checked: ${join(projectCwd, 'payload', payload)} and ${join(projectCwd, payload)}
Requested project: ${project}
Requested dashboard: ${name}
Requested database: ${dbType}${extensionHint}

For the assistant:
- The dashboard generator needs the payload file to exist before it can run.
- The payload argument must include the '.json' extension; it is forwarded to the CLI unchanged.
- Suggest creating or locating the payload first. Dashboard payloads have a different schema than CRUD payloads (a \`widgets\` array instead of \`tableName\`); see the dashboard documentation if the user is unfamiliar with the format.
- When explaining to the user, say something like "the payload file '${payload}' isn't in the payload/ folder yet — should I help you draft it, or do you have one to put there?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Build CLI invocation. The payload argument is forwarded byte-for-byte: the CLI's
      // findPayloadFile does an exact-name lookup and never appends '.json', so any
      // normalisation here would break resolution (issue-45 butir 2).
      // force defaults to true, which reproduces the previous hardcoded '--force=true'.
      // With force=false the flag is omitted (the CLI's own default is false), so the CLI
      // performs its own conflict checks and fails cleanly — the dashboard path has no
      // interactive prompt, so no stdin handling is needed here.
      const cliArgs = [
        'restforge',
        'dashboard',
        'create',
        `--project=${project}`,
        `--name=${name}`,
        `--payload=${payload}`,
        `--database=${dbType}`,
      ];
      if (force) cliArgs.push('--force=true');
      if (skipSqlValidation !== undefined) cliArgs.push(`--skip-sql-validation=${skipSqlValidation}`);

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 60_000,
          env: { NODE_ENV: 'production' }, // suppress legacy banner output
          stripFinalNewline: true,
        }
      );

      // Branch C: CLI failure — real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the dashboard module.

Project path: ${projectCwd}
Project: ${project}
Dashboard: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Database: ${dbType}
Overwrite mode: ${force ? 'force (existing module overwritten, previous version archived)' : 'non-overwrite (force=false)'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that creating the dashboard module did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Dashboard name did not start with 'dash-' prefix — suggest renaming (e.g. 'sales' becomes 'dash-sales').
  * Payload uses CRUD shape (has 'tableName') instead of dashboard shape (has 'widgets') — suggest reviewing the payload structure or pointing to dashboard documentation.
  * Payload contains forbidden frontend fields (widgetType, layout, title, subtitle, color) — those are frontend concerns and must be removed.
  * Widget without 'id', duplicate widget id, or widget that declares both 'query' AND 'queries' (or neither) — suggest reviewing the widgets array.
  * Widget SQL uses an undeclared placeholder (e.g. ':year' but 'year' missing from 'params') — suggest declaring the missing param or removing the placeholder.
  * Database mismatch with the existing project registry entry — the CLI refuses to switch the database. Suggest sticking with the originally registered database.
  * Reserved project name rejected by the validator — suggest a different project name.
  * 'Payload file not found' — the CLI resolves the payload argument verbatim; check that the name includes the '.json' extension and that the file sits in the payload/ folder.
${force
  ? "- The call ran with the default force=true, so an overwrite was allowed; a conflict message is therefore not the cause here."
  : "- The call ran with force=false. Two failures are expected on that path and mean nothing was written: 'Dashboard module already exists ... Pass options.force=true to overwrite' and \"Cannot change to '<db>' without --force\". In either case tell the user that the existing files are untouched, and offer the two real options: pick a different dashboard name, or regenerate deliberately with overwrite enabled (the previous version is archived to '.restforge/archive/<run>/')."}
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the underlying issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B: CLI success — one-line summary + labeled facts + fenced output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard module created successfully.

Project path: ${projectCwd}
Project: ${project}
Dashboard: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Database: ${dbType}
Overwrite mode: ${force ? 'force (existing module overwritten, previous version archived)' : 'non-overwrite (no conflicting module was present)'}
Endpoint: POST /api/${project}/${name}/dashboard

Generated artefacts (commonly produced by the CLI):
- src/modules/${project}.js (main module — created or refreshed)
- src/modules/${project}/${name}.js (dashboard handler with embedded SQL)
- metadata/${project}/${name}.json (dashboard metadata)
- .restforge/projects.json (registry update)

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user in plain language that the dashboard endpoint was generated. Mention the project, dashboard name, and the resulting URL: POST /api/${project}/${name}/dashboard.
- Do not paste the entire CLI output unless the user explicitly asks; summarise instead.
- Read the CLI output to identify any archive activity (the previous module is copied to '.restforge/archive/<run>/<original relative path>'; the 5 most recent runs are kept). When archives are created, tell the user that the previous version of the dashboard module is preserved in case rollback is needed.
- Suggest natural follow-up actions appropriate to context: review the generated module, run the project to test the new dashboard endpoint, draft a frontend caller, etc. Do not mention internal tool names.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
