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
      description: `Generate a multi-widget dashboard endpoint from a dashboard payload (a 'widgets' array of SQL aggregations, no table, no CRUD actions), by running npx restforge dashboard. URL: POST /api/{project}/{name}/dashboard.

DESTRUCTIVE: with the default force=true an existing dashboard module is overwritten (previous module copied to '.restforge/archive/<run>/') and the project is re-registered under the resolved database type. There is no preview; check the payload with 'codegen_validate_dashboard_payload' first and confirm with the user BEFORE calling.

USE WHEN:
- The user asks to generate a dashboard or analytics endpoint ("buatkan dashboard sales di project Y")
- A payload with a 'widgets' array exists and should become runnable, or be regenerated after changes

DO NOT USE FOR:
- A CRUD endpoint (payload with tableName, fieldName, action) -> 'codegen_create_endpoint'
- Checking a dashboard payload without writing -> 'codegen_validate_dashboard_payload'
- The dashboard payload contract -> 'codegen_get_dashboard_catalog'
- A processor -> 'codegen_create_processor'
- Widget presentation (widgetType, layout, color, title): frontend concerns, forbidden in the payload

NOTES:
- Leave 'database' unset unless the user named one: the CLI reads DB_TYPE from the config, and a guessed value overrides it.
- The name must start with 'dash-' (e.g. dash-sales). 'payload' must include .json.
- force=false never prompts: an existing module or a different registered database type stops the run and nothing is written.
- After the run, report the endpoint URL and any archive activity.`,
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
          .describe("Database type for the generated code. LEAVE IT UNSET unless the user explicitly names a database: when unset, no --database flag is sent and the CLI resolves the type itself, in this order — (1) explicit value (this parameter), (2) auto-detection of DB_TYPE from the active config (the one given via 'config', or the recorded default config), (3) fallback 'postgres' when no config can be resolved. Setting this parameter always wins over the project's own config, and the dialect is baked into the generated SQL. Dashboards do not support sqlite: the CLI rejects it, explicit or auto-detected, before writing anything."),
        config: z
          .string()
          .min(1)
          .optional()
          .describe("Optional database config file (.env) whose DB_TYPE sets the dialect when 'database' is unset, e.g. 'config/db-connection.env'. Resolved relative to the project folder. When omitted, the CLI falls back to the config recorded as default; a config path that does not exist makes the CLI stop with 'Config file not found'."),
        skipSqlValidation: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip SQL keyword validation in payload widget queries. Useful when the SQL fragments are intentional but the validator flags them as suspicious.'),
        force: z
          .boolean()
          .default(true)
          .describe("Default true — the existing behaviour: overwrite an existing dashboard module (the CLI first copies the previous module to .restforge/archive/<run>/) and re-register the project under the resolved database type. Set to false for the non-overwrite path: generation still proceeds when nothing conflicts, but an existing dashboard module or a different registered database type makes the CLI stop with a clean error and write nothing. The dashboard command has no interactive prompt, so force=false never hangs the call."),
      },
      annotations: {
        title: 'Create Dashboard Module',
        readOnlyHint: false,    // tool spawns CLI that writes module/metadata files and updates the registry
        destructiveHint: true,  // can overwrite an existing dashboard module file (CLI archives it to .restforge/archive/<run>/ first)
        idempotentHint: false,  // re-running creates new archive files
      },
    },
    async ({ cwd, project, name, payload, database, config, skipSqlValidation, force }) => {
      const projectCwd = resolve(cwd);
      // Database-type resolution belongs to the CLI (generators/cli/dashboard/create.js,
      // "Resolusi tipe database", issue-54): an explicit --database wins, otherwise DB_TYPE
      // is auto-detected from the active config, otherwise it falls back to 'postgres'.
      // The flag is therefore sent only when the caller actually set the parameter;
      // sending it unconditionally would disable the auto-detection step. This label is
      // for reporting only.
      const dbType =
        database ?? 'not specified (resolved by the CLI: DB_TYPE of the active config, else postgres)';

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
      ];
      if (database !== undefined) cliArgs.push(`--database=${database}`);
      if (config !== undefined) cliArgs.push(`--config=${config}`);
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
  * 'Config file not found' — the config path does not exist; check the file name under the project's config/ folder.
  * 'Dashboard does not support database' — dashboards support postgres, mysql and oracle only; a SQLite project cannot host a dashboard module.
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
- Mention the database type only when it is known: either it was passed explicitly, or the CLI output shows it on its 'Database' line (annotated with '(auto-detected ...)' when it came from a config). When the fact block above says it was not specified, read it from the CLI output instead of guessing.
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
