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
 * Meniru normalisasi nama payload milik CLI, yaitu
 * generators/lib/validators/argument-validator.js `validatePayloadName`:
 * ekstensi '.json' dibuang bila ada, sisanya di-lowercase, lalu '.json'
 * ditambahkan kembali. Karena itu 'Users' dan 'users.json' menghasilkan file
 * yang sama, dan nilai parameter tetap dikirim apa adanya ke CLI.
 */
function cliPayloadFileName(payload: string): string {
  const base = payload.endsWith('.json') ? payload.slice(0, -5) : payload;
  return `${base.toLowerCase()}.json`;
}

/**
 * Meniru daftar kandidat CLI (`PayloadValidator.findPayloadFile`) untuk
 * pemanggilan lewat MCP: subprocess dijalankan dengan cwd = projectCwd,
 * sehingga workingDir dan process.cwd() milik CLI keduanya menunjuk ke sana.
 * Kandidat `rootDir` relatif __dirname menunjuk ke dalam package platform dan
 * sengaja tidak ditiru.
 */
async function resolvePayloadPath(projectCwd: string, fileName: string): Promise<string | null> {
  for (const candidate of [join(projectCwd, 'payload', fileName), join(projectCwd, fileName)]) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export function registerCodegenCreateEndpoint(server: McpServer): void {
  server.registerTool(
    'codegen_create_endpoint',
    {
      title: 'Create Endpoint Module',
      description: `Generate the runnable endpoint module (submodule, model, metadata, demo files, optional audit migration) for a project from an existing RDF payload, by wrapping restforge create. URL pattern produced: /api/{project}/{endpoint}/{action}.

DESTRUCTIVE: with the default force=true an existing module, model, or query folder is overwritten (the CLI first moves the previous files to '.restforge/archive/<run>/'). There is no preview. Confirm intent with the user in plain language BEFORE calling, e.g. "Saya akan generate endpoint <endpoint> di project <project>. Versi lama, bila ada, diarsipkan ke .restforge/archive. Lanjut?". Do not detect conflicts yourself.

USE WHEN:
- The user asks to generate, create, or scaffold an endpoint, resource, or module from a payload ("buatkan endpoint untuk product", "generate kode dari payload ini", "tambahkan endpoint X ke project Y")
- A payload was just generated or validated and the user's request already covers making it runnable
- The user wants to regenerate an endpoint after its payload changed, or bootstrap a new project with its first endpoint

DO NOT USE FOR:
- Producing the payload JSON from a table -> 'codegen_generate_payload'
- Validating or diffing a payload -> 'codegen_validate_payload' / 'codegen_diff_payload'
- Merging schema drift into payload files -> 'codegen_sync_payload'
- A dashboard endpoint -> 'codegen_create_dashboard'; a processor -> 'codegen_create_processor'; a Kafka consumer -> 'codegen_create_kafka_consumer'
- Listing or deleting projects -> 'project_list' / 'project_delete'
- Database DDL changes -> the dbschema tools (the only DDL this tool emits is the audit table for the 'audit' fieldPolicy)

FORCE=FALSE (conflict probe): when nothing conflicts the CLI generates normally. When the module already exists, the CLI prints a conflict summary and stops at its y/N prompt (end-of-input in this context): NOTHING is written and the run is reported as aborted. force=false also refuses to re-register a project under a different database type. Use it when the user wants to know whether a module exists before regenerating.

DATABASE TYPE: resolved by the CLI. (1) 'database' when set always wins; (2) otherwise DB_TYPE from the active config ('config', else the recorded default); (3) otherwise 'postgres'. Do NOT set 'database' just to be explicit: a guessed value silently overrides the project's config. Mention a database type in the confirmation only when the user named one.

SAFETY NET: before overwriting, the CLI moves the previous files to '.restforge/archive/<run>/<original relative path>' (the 5 most recent runs are kept), so a run can be undone by copying that folder back. The CLI writes to 'src/modules/<project>/', 'src/models/<project>/', 'metadata/<project>/', 'examples/<project>/<endpoint>/', and updates '.restforge/projects.json'.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The payload file must exist at <cwd>/payload/<name>.json (or <cwd>/<name>.json). The 'payload' parameter takes the name with or without '.json'; the CLI resolves both to the same lowercase file.
- The CLI rejects reserved project names (src, lib, node_modules, config, utils, models, controllers, middleware, routes) and reserved endpoint names (health, status, admin, api, auth, login, logout, register, index, main, app, config, test, docs, swagger, graphql, websocket, socket). When in doubt, ask the user for a different name first.

NOTES:
- After the run, read the CLI output for archive activity ('.restforge/archive/<run>/'); when archives were created, tell the user the previous versions are kept for rollback.`,
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
        endpoint: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'must start with a letter or number; only letters, numbers, dashes, underscores allowed')
          .describe('Endpoint name (also called "resource" — the URL pattern is /api/{project}/{endpoint}/{action}). Same shape as project. Auto-lowercased by the CLI. Reserved names rejected by the CLI: health, status, admin, api, auth, login, logout, register, index, main, app, config, test, docs, swagger, graphql, websocket, socket. Naming convention: kebab-case or snake-case recommended.'),
        payload: z
          .string()
          .min(1)
          .max(55)
          .regex(
            /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}(\.json)?$/,
            'must start with a letter or number; only letters, numbers, dashes, underscores allowed, with an optional .json extension'
          )
          .describe("Payload file name, WITH or WITHOUT the '.json' extension — both forms are accepted and resolve to the same file, because the CLI strips the extension, lowercases the name, and appends '.json' again. The file must exist at <cwd>/payload/<name>.json or <cwd>/<name>.json. Path forms ('payload/users.json', absolute paths) are rejected by the CLI: pass the bare file name only. Base name max 50 chars, cannot start or end with dash or underscore. Note the lowercasing: a file literally named 'Users.json' is NOT found on a case-sensitive filesystem."),
        database: z
          .enum(['postgres', 'oracle', 'mysql', 'sqlite'])
          .optional()
          .describe("Database type for the generated code. LEAVE IT UNSET unless the user explicitly names a database: when unset, no --database flag is sent and the CLI resolves the type itself, in this order — (1) explicit value (this parameter), (2) auto-detection of DB_TYPE from the active config (the one given via 'config', or the recorded default config), (3) fallback 'postgres' when no config can be resolved. Setting this parameter always wins over the project's own config, so an unnecessary value can generate postgres code for a MySQL/Oracle/SQLite project."),
        createDemo: z
          .boolean()
          .optional()
          .describe("Default true (CLI default). When true, generate example files (curl, Postman, Insomnia) for testing the endpoint, under 'examples/<project>/<endpoint>/'. Maps to the CLI flag '--create-examples'; set it to false to skip those files."),
        skipSqlValidation: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip SQL keyword validation in the payload. Useful when payload includes generated SQL fragments that the validator flags as suspicious.'),
        noAuditMigration: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip executing the audit table migration even if the payload has fieldPolicy.*.strategies containing "audit". The migration SQL file is still written to migrations/audit/ as documentation.'),
        skipSchemaCheck: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, skip validating the payload against the live database schema (escape hatch for an offline or unreachable database). The payload shape itself is still validated. Without it the CLI needs a database config, either the one recorded as default via the config tooling or an explicit one.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe("Optional database config file (.env) used for the payload-vs-database schema validation, e.g. 'config/db-connection.env'. Resolved relative to the project folder. The CLI needs a config for that check unless skipSchemaCheck=true or a default config was recorded via the config tooling; set this when no default is recorded or when a specific config must be used. When omitted, the CLI falls back to its recorded default."),
        verbose: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, the CLI prints verbose diagnostic output. Useful when a previous run failed for an unclear reason; the extra output ends up in this tool result.'),
        force: z
          .boolean()
          .default(true)
          .describe('Default true — the existing behaviour: overwrite an existing module (the CLI first moves the previous files to .restforge/archive/<run>/). Set to false for the non-overwrite path: generation still proceeds when nothing conflicts, but when the module already exists the CLI stops at its confirmation question without writing anything and this tool reports the run as aborted. force=false also blocks switching an already registered project to a different database type.'),
      },
      annotations: {
        title: 'Create Endpoint Module',
        readOnlyHint: false,    // tool spawns CLI that writes module/model/metadata/demo files and updates the registry
        destructiveHint: true,  // can overwrite existing files (CLI archives them to .restforge/archive/<run>/ first)
        idempotentHint: false,  // re-running creates new archive files and may execute audit migration again
      },
    },
    async ({
      cwd,
      project,
      endpoint,
      payload,
      database,
      createDemo,
      skipSqlValidation,
      noAuditMigration,
      skipSchemaCheck,
      verbose,
      force,
      config,
    }) => {
      const projectCwd = resolve(cwd);
      // Database-type resolution belongs to the CLI (generators/cli/endpoint/create.js,
      // "Resolusi tipe database"): an explicit --database wins, otherwise DB_TYPE is
      // auto-detected from the active config, otherwise it falls back to 'postgres'.
      // The flag is therefore sent only when the caller actually set the parameter;
      // sending it unconditionally would make priority 1 always win and permanently
      // disable the auto-detection step. This label is for reporting only.
      const dbTypeLabel =
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
Requested endpoint: ${endpoint}
Requested payload: ${payload}
Requested database: ${dbTypeLabel}

For the assistant:
- The endpoint generator can only run once the RESTForge package is installed locally.
- Suggest installing the package first, then retry generating the endpoint.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Pre-flight 2: payload file must exist. Treated as a non-error precondition per §3.4.
      // The candidate list mirrors the CLI's own resolution (see resolvePayloadPath /
      // cliPayloadFileName above) so this pre-flight can neither accept a payload the CLI
      // will reject, nor reject one the CLI would have found.
      const payloadFileName = cliPayloadFileName(payload);
      const payloadPath = await resolvePayloadPath(projectCwd, payloadFileName);
      if (payloadPath === null) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: payload file not found.

Project path: ${projectCwd}
Payload argument: ${payload}
Resolved file name: ${payloadFileName}
Locations checked: ${join(projectCwd, 'payload', payloadFileName)} and ${join(projectCwd, payloadFileName)}
Requested project: ${project}
Requested endpoint: ${endpoint}
Requested database: ${dbTypeLabel}

For the assistant:
- The endpoint generator needs the payload file to exist before it can run.
- The CLI lowercases the payload name and appends '.json', so '${payload}' can only ever match the file '${payloadFileName}'. If a file with different capitalisation exists, rename it to match.
- Suggest generating or creating the payload first. The payload generator tool can introspect a database table into a payload JSON, or the user can author it manually in the payload/ folder.
- When explaining to the user, say something like "the payload file '${payloadFileName}' isn't in the payload/ folder yet — should I generate it from a database table first, or do you have one to put there?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Build CLI invocation. force defaults to true, which reproduces the previous
      // hardcoded '--force=true': it bypasses the CLI's interactive readline prompt.
      // With force=false the flag is omitted (the CLI's own default is false), so the
      // CLI runs its conflict check first. Conflict detection and archive creation are
      // delegated to the CLI (single source of truth — see conflict-checker.js).
      const cliArgs = [
        'restforge',
        'endpoint',
        'create',
        `--project=${project}`,
        `--name=${endpoint}`,
        `--payload=${payload}`,
      ];
      // Sent only when explicitly requested, so the CLI's own resolution order stays
      // intact when it is not (see the dbTypeLabel comment above).
      if (database !== undefined) cliArgs.push(`--database=${database}`);
      if (force) cliArgs.push('--force=true');
      // The CLI names this flag '--create-examples'; the MCP parameter keeps the older
      // name 'createDemo' for client compatibility.
      if (createDemo !== undefined) cliArgs.push(`--create-examples=${createDemo}`);
      if (skipSqlValidation !== undefined) cliArgs.push(`--skip-sql-validation=${skipSqlValidation}`);
      if (noAuditMigration !== undefined) cliArgs.push(`--no-audit-migration=${noAuditMigration}`);
      if (skipSchemaCheck !== undefined) cliArgs.push(`--skip-schema-check=${skipSchemaCheck}`);
      if (verbose !== undefined) cliArgs.push(`--verbose=${verbose}`);
      if (config !== undefined) cliArgs.push(`--config=${config}`);

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 120_000,
          env: { NODE_ENV: 'production' }, // suppress legacy banner output
          stripFinalNewline: true,
          // Only the non-force path can reach the CLI's y/N readline prompt. Closing
          // stdin there turns the prompt into immediate end-of-input, so the CLI stops
          // instead of waiting for an answer that can never arrive (which would hold the
          // call until the 120s timeout). The force path keeps the previous behaviour.
          ...(force ? {} : { stdin: 'ignore' as const }),
        }
      );

      // Non-force path: the CLI reached its confirmation question and got end-of-input,
      // so it stopped before writing anything. The process still exits 0, hence this
      // check must run before the success branch.
      //
      // Detection keys on the readline question itself, because that is the only part of
      // the conflict phase that reliably reaches the piped stdout. On platform 5.5.5 the
      // console.log lines around the prompt ('CONFLICTS DETECTED', the risk message, the
      // closing 'User cancelled: Operation aborted') never arrive in the pipe, while the
      // readline question always does — the earlier AND-condition therefore never fired
      // and an aborted run was reported as a success.
      //
      // '(y/N)' is used rather than the phrase 'overwrite existing files' because
      // conflict-checker.js asks one of TWO questions: the plain
      // '...proceed and overwrite existing files? (y/N): ' and, when a high severity
      // system conflict is present, '...proceed despite high severity conflicts? (y/N): '.
      // Keying on the first phrase would silently miss the second. '(y/N)' is still
      // specific to this verb's prompt: inside the 'endpoint create' chain the conflict
      // checker holds the only readline interface, so no other question can produce it.
      // 'CONFLICTS DETECTED' stays as an additional OR signal for platform versions where
      // the summary does reach stdout but the question does not.
      const sawConfirmationPrompt = result.stdout.includes('(y/N)');
      const sawConflictSummary = result.stdout.includes('CONFLICTS DETECTED');
      const abortedOnPrompt =
        !force && result.success && (sawConfirmationPrompt || sawConflictSummary);

      if (abortedOnPrompt) {
        return {
          content: [
            {
              type: 'text',
              text: `Aborted: nothing was generated. The endpoint already exists and force=false, so the CLI stopped at its overwrite confirmation.

Project path: ${projectCwd}
Project: ${project}
Endpoint: ${endpoint}
Payload: ${payload}
Payload file: ${payloadPath}
Database: ${dbTypeLabel}
Command: ${result.command}
Outcome: no file was created, overwritten, or archived; the registry was not updated
Detected by: ${sawConflictSummary ? "the CLI's conflict summary" : "the CLI's overwrite confirmation question"} in the output below

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Tell the user that nothing was written, overwritten, or archived: the generator found that this endpoint already exists and stopped at its confirmation step before touching anything.
- The captured output is often just the confirmation question itself — the per-file conflict summary and risk level are printed by the CLI but do not always reach this tool. Summarise the conflicting files or the risk level ONLY if they actually appear in the output above; never invent them. When they are absent, say plainly that the generator reported a conflict without listing details here.
- Offer the two real continuations in plain language: (1) regenerate deliberately with overwriting enabled, in which case the existing files are archived to '.restforge/archive/<run>/' before being replaced, or (2) leave the existing module untouched and change nothing. Generating under a different endpoint name is a variant of option 2 — it creates a new module and leaves the existing one alone. Only regenerate after the user confirms.
- Do not mention internal tool names or parameter names. Match the user's language.`,
            },
          ],
          isError: false, // an expected, non-destructive outcome — not a failure
        };
      }

      // Branch C: CLI failure — real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the endpoint module.

Project path: ${projectCwd}
Project: ${project}
Endpoint: ${endpoint}
Payload: ${payload}
Payload file: ${payloadPath}
Database: ${dbTypeLabel}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that creating the endpoint module did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Reserved name rejected by the validator (project or endpoint name is in the reserved list) — suggest picking a different name.
  * Database mismatch with the existing project registry entry — the CLI refuses to switch the database for an existing project. Suggest sticking with the originally registered database, or confirm with the user that switching is really intended.
  * Payload validation failed (e.g. SQL keywords flagged) — suggest validating the payload first to surface the specific issue, or rerunning with skipSqlValidation=true if the SQL fragments are intentional.
  * Audit migration failed (e.g. cannot connect to the database) — suggest checking the database connection config, or rerunning with noAuditMigration=true to skip the live migration (the SQL file will still be written for manual execution).
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the underlying issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch D: CLI success — one-line summary + labeled facts + fenced output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Endpoint module created successfully.

Project path: ${projectCwd}
Project: ${project}
Endpoint: ${endpoint}
Payload: ${payload}
Payload file: ${payloadPath}
Database: ${dbTypeLabel}
Overwrite mode: ${force ? 'force (existing files overwritten, previous versions archived)' : 'non-overwrite (force=false; the CLI ran to completion without stopping at an overwrite confirmation)'}

Generated artefacts (commonly produced by the CLI):
- src/modules/${project}/${endpoint}.js (submodule)
- src/models/${project}/${endpoint}.js (model)
- src/models/${project}/query/ (if payload uses file reference queries)
- metadata/${project}/${endpoint}.json (and related metadata)
- examples/${project}/${endpoint}/* (if createDemo=true)
- migrations/audit/<table>_audit.sql (if payload uses fieldPolicy 'audit' strategy)
- .restforge/projects.json (registry update)

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user in plain language that the project and endpoint were generated. Mention the project and the endpoint. Mention the database type only when it is known: either it was passed explicitly, or the CLI reported the resolved type in its output (it prints a 'Database: <type>' line, annotated with '(auto-detected ...)' when it came from a config, in verbose runs). When the fact block above says the database was not specified, do not invent a type.
- Do not paste the entire CLI output unless the user explicitly asks; summarise instead.
- Suggest natural follow-up actions appropriate to context: review the generated files, run the project to test the new endpoint, generate a processor or test, etc. Do not mention internal tool names.
- Read the CLI output to identify any archive activity. Overwritten files are moved to '.restforge/archive/<run>/<original relative path>' (the 5 most recent runs are kept). When archives are created, tell the user the previous versions are kept there and can be copied back for a rollback.
- Read the CLI output to identify any audit migration activity (the CLI reports it when the payload uses a fieldPolicy 'audit' strategy). When present, summarise it briefly to the user (e.g. that the audit table for the related table was created or updated).
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
