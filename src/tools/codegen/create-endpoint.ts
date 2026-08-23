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
      description: `Generate a project + endpoint module (submodule, model, metadata, demo files, optional audit migration) from an existing payload spec by wrapping restforge create. URL pattern produced: /api/{project}/{endpoint}/{action}.

This tool is DESTRUCTIVE BY DEFAULT: it spawns the CLI which writes / overwrites files in 'src/modules/<project>/', 'src/models/<project>/', 'metadata/<project>/', 'examples/<project>/<endpoint>/', and updates '.restforge/projects.json'. Single-call semantics: the tool always executes; there is no preview mode that reports what would change.

The 'force' parameter controls the overwrite gate and defaults to TRUE, which means an existing module IS overwritten (the CLI archives the previous version first — see the safety net below). Passing force=false gives a non-overwrite path:
- When nothing conflicts, the CLI generates normally — same result as force=true.
- When the module already exists, the CLI prints a conflict summary and then asks its interactive y/N question. In this non-interactive context the question receives end-of-input immediately, so the CLI stops right there: NOTHING is written or overwritten, and the tool reports the run as aborted. This is the closest thing to a dry run for conflict detection: it tells you what already exists without touching it.
- force=false also makes the CLI refuse to register a project under a different database type than the one already recorded in the registry, instead of silently switching it.
Use force=false when the user wants to know whether a module already exists before committing to a regeneration; use the default force=true for a deliberate regeneration.

Database type is resolved by the CLI, not by this tool. Order of priority: (1) the 'database' parameter when it is set — it is passed through as '--database=<value>' and always wins; (2) auto-detection of DB_TYPE from the active config (the file named by 'config', otherwise the recorded default config) when 'database' is not set — no '--database' flag is sent at all in that case; (3) fallback 'postgres' inside the CLI when neither applies. Practical consequence: do NOT set 'database' just to be explicit. Leaving it unset lets a MySQL, Oracle, or SQLite project be generated for its own database type; setting it to a guessed value overrides the project's config silently.

Safety net: when the CLI overwrites an existing module, model, or query directory, it FIRST renames the previous version to '<name>.archive.NNN' (NNN is a sequential generation number starting at 001) inside the same folder. Rollback by restoring the most recent archive is always possible.

AI responsibility — IMPORTANT: because this tool executes immediately and, with the default force=true, may overwrite generated files, you MUST confirm intent with the user in plain language BEFORE invoking the tool. You do NOT need to detect file conflicts programmatically — the CLI handles that and the archive mechanism keeps the previous version safe. Just confirm intent. Examples of good confirmation phrasing in user-facing chat:
- "Saya akan generate endpoint <endpoint> di project <project>. Kalau modul/model lama sudah ada, versi sebelumnya akan disimpan sebagai '.archive.NNN'. Lanjut?"
- "I will generate <endpoint> under project <project>. Existing files will be archived as .archive.NNN before being overwritten. Proceed?"
- Mention a database type in that confirmation only when the user named one (i.e. when the 'database' parameter is set). When it is left unset, do not guess a type — the CLI takes it from the project's own config.

USE WHEN:
- The user asks to generate, create, or scaffold an endpoint, resource, or module from a payload (e.g. "buatkan endpoint untuk product", "generate resource users", "create endpoint dari payload X", "scaffold a new endpoint")
- The user mentions "endpoint", "resource", "module" or the URL pattern /api/{project}/{resource}/{action} and wants to register it as runnable code
- The user has authored a payload file (e.g. via 'codegen_generate_payload' or manually) and now wants to materialise it as runnable code in the project
- Pertanyaan dalam bentuk: "tambahkan endpoint X ke project Y", "buat module baru di project Z", "scaffold endpoint baru pakai payload ini", "generate kode dari payload ini"
- The user asks to add a new endpoint to an existing project (registry already has the project, just adding more endpoints)
- The user asks to bootstrap a brand-new project together with its first endpoint
- The user asks about regenerating an existing endpoint after the payload changed (this triggers overwrite + archive flow inside the CLI; previous versions become '.archive.NNN' in place)
- After 'codegen_validate_payload' confirmed the payload is valid — this is the natural follow-up that turns a verified payload into runnable code

DO NOT USE FOR:
- Generating the payload JSON itself from a database table -> use 'codegen_generate_payload'
- Validating a payload before generation -> use 'codegen_validate_payload'
- Inspecting per-column differences between payload and database -> use 'codegen_diff_payload'
- Syncing payload changes back into existing payload files after schema drift -> use 'codegen_sync_payload'
- Looking up the field validation catalog before authoring the payload -> use 'codegen_get_field_validation_catalog'
- Looking up the query declarative catalog before authoring the payload -> use 'codegen_get_query_declarative_catalog'
- Deleting a project or endpoint — out of scope; the user must run 'npx restforge drop' manually
- Generating a processor (Kafka consumer, etc.) — out of scope; the CLI has separate 'processor' and 'consumer-create' subcommands not covered by this MCP server yet
- Generating a dashboard endpoint — out of scope; the CLI has a separate 'dashboard' subcommand
- Listing all registered projects in the registry — out of scope here; use the CLI's 'list' subcommand directly
- Database DDL changes (CREATE TABLE, ALTER TABLE) — not in this tool's scope. The audit migration sub-step DOES create a single audit table when the payload uses the 'audit' fieldPolicy strategy, but that is the only DDL it touches.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The payload file must exist at <cwd>/payload/<name>.json (or <cwd>/<name>.json) before calling this tool. The 'payload' parameter takes the file name with or without the '.json' extension — the value is passed to the CLI verbatim, and the CLI resolves both forms to the same lowercase '<name>.json' file.
- The CLI itself rejects reserved project names (src, lib, node_modules, config, utils, models, controllers, middleware, routes) and reserved endpoint names (health, status, admin, api, auth, login, logout, register, index, main, app, config, test, docs, swagger, graphql, websocket, socket). When in doubt, ask the user to pick a different name before invoking this tool.

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user. Describe actions by what they do (e.g. "the endpoint generator", "the project generator", "generate the payload first", "validate the payload first").
- Speak in plain language. Summarise the result; do not paste raw CLI output unless the user explicitly asks.
- This tool is destructive: it can overwrite existing module / model / query files. BEFORE invoking this tool, ALWAYS confirm with the user in plain language. Example: "Saya akan generate endpoint <endpoint> di project <project>. Kalau file lama sudah ada, akan ditimpa (versi lama disimpan sebagai .archive.NNN). Lanjut?". Do not detect conflicts programmatically; the CLI handles that and creates the archive.
- After the tool runs, summarise the result. Read the CLI output and identify any archive activity (the CLI uses the '.archive.NNN' naming convention in the filesystem and reports archive activity in its output, but the exact wording may evolve). When archives are created, tell the user that previous versions are preserved in case rollback is needed.
- When a precondition is not met, frame it as a question or next-step suggestion rather than an error.`,
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
          .describe('Default true — the existing behaviour: overwrite an existing module (the CLI archives the previous version as .archive.NNN first). Set to false for the non-overwrite path: generation still proceeds when nothing conflicts, but when the module already exists the CLI stops at its confirmation question without writing anything and this tool reports the run as aborted. force=false also blocks switching an already registered project to a different database type.'),
      },
      annotations: {
        title: 'Create Endpoint Module',
        readOnlyHint: false,    // tool spawns CLI that writes module/model/metadata/demo files and updates the registry
        destructiveHint: true,  // can overwrite existing files (CLI archives them as .archive.NNN first)
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
- Offer the two real continuations in plain language: (1) regenerate deliberately with overwriting enabled, in which case the existing files are archived as '.archive.NNN' before being replaced, or (2) leave the existing module untouched and change nothing. Generating under a different endpoint name is a variant of option 2 — it creates a new module and leaves the existing one alone. Only regenerate after the user confirms.
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
- Read the CLI output to identify any archive activity. The CLI uses the '.archive.NNN' naming convention in the filesystem; it also reports archive activity in its output, though the exact phrasing may evolve. When archives are created, tell the user that the previous version of each overwritten file is preserved as an archive file in the same folder, and explain where to find them if rollback is needed.
- Read the CLI output to identify any audit migration activity (the CLI reports it when the payload uses a fieldPolicy 'audit' strategy). When present, summarise it briefly to the user (e.g. that the audit table for the related table was created or updated).
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
