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

export function registerCodegenValidateDashboardPayload(server: McpServer): void {
  server.registerTool(
    'codegen_validate_dashboard_payload',
    {
      title: 'Validate Dashboard Payload',
      description: `Validate the structure of a dashboard payload WITHOUT generating any file, by wrapping restforge dashboard --validate-only=true. READ-ONLY: no file, database, or registry change; idempotent.

USE WHEN:
- The user asks to check a dashboard payload ("cek dashboard payload saya valid?", "apakah payload dashboard ini OK?")
- A dashboard payload (with a 'widgets' array) was just authored or edited: pre-flight before 'codegen_create_dashboard'
- 'codegen_create_dashboard' failed with a validation error and the payload is being fixed iteratively

DO NOT USE FOR:
- A CRUD payload (with 'tableName' and 'fieldName') -> 'codegen_validate_payload'
- Generating the dashboard module -> 'codegen_create_dashboard'
- Looking up the dashboard contract -> 'codegen_get_dashboard_catalog'
- SQL semantics inside a widget query: only placeholders and structure are checked here; check a query with 'codegen_validate_sql'

CHECKS: the CLI's DashboardValidator checks the widgets array shape, allowed/forbidden fields per level, the 'query' vs 'queries' mutual exclusion, the params contract (each ':placeholder' must be declared in 'params'), 'file:query/<name>.sql' resolution, and that no frontend-only fields (widgetType, layout, title, subtitle, color) leak in.

PLATFORM VERSION: needs a @restforgejs/platform that provides 'dashboard create --validate-only' (added after 5.5.5). On an older platform the CLI answers "Unknown flag: --validate-only"; this tool reports that as an upgrade requirement, not a payload problem. In that case 'codegen_create_dashboard' runs the same validator before writing anything.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules (see the version requirement above).
- The 'payload' value is passed verbatim and must carry '.json': the CLI looks for '<cwd>/payload/<payload>' then '<cwd>/<payload>'.
- The dashboard name MUST start with 'dash-'; the argument parser checks it even in validate-only mode.

NOTES:
- Valid: confirm briefly and continue to generation when the user's request already covers it. Invalid: explain the specific error and help fix it.`,
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
          .describe('Project name. Required by the CLI argument schema even in validate-only mode. Letters/numbers/dash/underscore, max 50 chars.'),
        name: z
          .string()
          .min(6)
          .max(50)
          .regex(/^dash-[a-zA-Z0-9_-]+$/, "must start with 'dash-' prefix and have at least one character after it (e.g. dash-sales, dash-inbound)")
          .describe("Dashboard name. MUST start with 'dash-' prefix (CLI requirement). For validate-only mode, this is checked at the argument-parser level even though the value is not used to write any file. The CLI rejects 'dash-' alone — there must be at least one character after the prefix."),
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
          .describe("Database type. Accepted values match the CLI's own list for this command: postgres, oracle, mysql, sqlite. Optional, and when it is left unset this tool sends '--database=postgres' explicitly, which is also the CLI's own default. The database connection is NOT used in validate-only mode (validation is structural, not drift-based) and the dialect does not change the validation outcome; the parameter is kept for argument-schema parity with codegen_create_dashboard."),
        skipSqlValidation: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip SQL keyword validation in payload widget queries. Useful when the SQL fragments are intentional but the validator flags them as suspicious.'),
      },
      annotations: {
        title: 'Validate Dashboard Payload',
        readOnlyHint: true,    // pure validation, no filesystem write, no DB write
        idempotentHint: true,  // re-running gives same result for same input
      },
    },
    async ({ cwd, project, name, payload, database, skipSqlValidation }) => {
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

For the assistant:
- The dashboard payload validator can only run once the RESTForge package is installed locally.
- Suggest installing the package first, then retry validating the dashboard payload.
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
Requested dashboard: ${name}${extensionHint}

For the assistant:
- The dashboard payload validator needs the payload file to exist before it can run.
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
      // --validate-only=true is hardcoded: this tool is ONLY for validation.
      // --force is NOT passed (not relevant for validate-only — no overwrite scenario).
      // Validation logic itself is delegated to the CLI's DashboardValidator (single source of
      // truth — see refactor 8C).
      const cliArgs = [
        'restforge',
        'dashboard',
        'create',
        `--project=${project}`,
        `--name=${name}`,
        `--payload=${payload}`,
        `--database=${dbType}`,
        '--validate-only=true',
      ];
      if (skipSqlValidation !== undefined) cliArgs.push(`--skip-sql-validation=${skipSqlValidation}`);

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 30_000, // validation is light: no DB connection, no filesystem write
          env: { NODE_ENV: 'production' }, // suppress legacy banner output
          stripFinalNewline: true,
        }
      );

      // Branch C1: the installed platform predates the '--validate-only' flag. The CLI rejects
      // the flag at argument-parser level (exit 2, message on stderr), so nothing was validated
      // at all. Reported separately: it is an environment problem, not a payload problem.
      const unknownFlag = `${result.stdout}\n${result.stderr}`.includes('Unknown flag: --validate-only');
      if (!result.success && unknownFlag) {
        return {
          content: [
            {
              type: 'text',
              text: `Dashboard payload was NOT validated: the installed RESTForge version does not support validate-only mode.

Project path: ${projectCwd}
Project: ${project}
Dashboard: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Command: ${result.command}
Exit code: ${result.exitCode}
Reason: the CLI rejected the flag with "Unknown flag: --validate-only"

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- IMPORTANT: this is NOT a payload error. The payload was never inspected; the command was rejected before validation started.
- Cause: 'dashboard create --validate-only' exists in @restforgejs/platform only from the release published after 5.5.5 onwards. The copy installed in this project is older.
- Two ways forward, offer them in plain language:
  1. Upgrade the RESTForge package in this project to a version that provides validate-only mode, then retry.
  2. Without upgrading, validate by generating the dashboard module instead — the generator runs the very same validator and reports the same errors, but it does write files, so confirm with the user before doing that.
- Do not mention internal tool names or flag names to the user; describe the actions ("upgrade the RESTForge package", "generate the dashboard module"). Match the user's language.`,
            },
          ],
          isError: true, // per §3.4 — the requested work did not happen
        };
      }

      // Branch C2: CLI failure (validation failed or other) — real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Dashboard payload validation failed.

Project path: ${projectCwd}
Project: ${project}
Dashboard: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the dashboard payload validation did not pass. Surface the error message from the CLI output (typically a single 'Error: ...' line) in plain language.
- Common validation errors and suggested fixes:
  * 'must not contain tableName' — the payload has CRUD shape; remove 'tableName' or use the CRUD payload validator instead (do not mention internal tool name; describe the action).
  * 'must have widgets array' — payload is missing the 'widgets' field; suggest adding it with at least one entry.
  * 'must declare either query or queries' — a widget is missing both fields; pick one based on whether the widget needs single SQL or multi-SQL.
  * 'undeclared placeholder' — SQL uses ':param_name' that is not declared in 'params'; add it to 'params' or remove the placeholder from SQL.
  * 'forbidden frontend field' (widgetType, layout, title, subtitle, color) — those belong in the frontend code; remove them from the payload.
  * 'invalid type' for params — the param type must be one of: string, number, boolean, date.
  * 'duplicate widget id' — two widgets share the same id; pick distinct ids.
  * 'Payload file not found' — the CLI resolves the payload argument verbatim; check that the name includes the '.json' extension and that the file sits in the payload/ folder.
- Offer to help fix the payload and retry validation.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B: CLI success (validation passed) — one-line summary + labeled facts + fenced output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard payload validation passed.

Project path: ${projectCwd}
Project: ${project}
Dashboard: ${name}
Payload: ${payload}
Payload file: ${payloadPath}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user in plain language that the dashboard payload structure is valid.
- This validation does NOT touch the database or write any file. It only checks payload structure (widgets array shape, allowed/forbidden fields, params contract, file:reference resolution, placeholder declaration).
- If the user requested validation as a precursor to generation, the next step is to generate the dashboard module. Do not mention internal tool names; describe the action ("generate the dashboard module").
- If the CLI output mentions warnings (lines starting with '! Warning'), surface them to the user — these are non-fatal but worth knowing.
- Do not paste the full CLI output unless the user explicitly asks; summarise instead.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
