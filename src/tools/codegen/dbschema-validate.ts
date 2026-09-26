import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenDbschemaValidate(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_validate',
    {
      title: 'Validate dbschema-kit Files',
      description: `Validate dbschema-kit schema definition files (single-model + cross-model) by wrapping restforge schema validate. Single-model checks: defineModel structure, field types, length, nullable, primary key, default value compatibility. Cross-model checks: foreign key target table existence, referenced column existence, primary key requirement for belongsTo relations.

Validation also covers the soft-delete contract. The softDelete block is strict: keys other than enabled and reusable are rejected. The three contract columns (is_deleted boolean, deleted_at timestamp, deleted_by string) are biconditional with softDelete.enabled = true — missing columns, wrong types, or columns declared without enabled=true are all ERRORs. Each reusable entry must reference a declared string/text field with a single-column UNIQUE and a physical length >= base length + 38; with soft-delete enabled, composite UNIQUEs and non-string single-column UNIQUEs are rejected. These checks run at schema load (inside defineModel), so they are enforced identically by every schema command that loads SDF files (validate, generate-ddl, migrate), not only by this tool.

USE WHEN:
- The user asks to validate schema files or check defineModel correctness
- Pertanyaan dalam bentuk: "validasi schema saya", "check apakah schema valid", "verify dbschema files", "cek schema definition"
- After authoring or editing schema files (via Write/Edit tools) — to confirm correctness before downstream actions
- Before invoking 'codegen_dbschema_generate_ddl' or 'codegen_dbschema_migrate' — to catch errors early
- The user reports an unclear error message from another dbschema action and wants a focused validation check
- The user asks about FK target validity ("does my FK reference work", "is the relation correct")
- The user wants a sanity check after introspecting from a live database (after 'codegen_dbschema_introspect')
- The user wants one verdict per table that also covers the database ("is my schema valid and in sync with the database?", "cek schema sekaligus kesesuaian dengan database") -> pass config

DO NOT USE FOR:
- Validating CRUD payload files -> use 'codegen_validate_payload'
- Validating dashboard payload -> use 'codegen_validate_dashboard_payload'
- Validating SQL syntax -> use 'codegen_validate_sql'
- Looking up valid syntax -> use 'codegen_get_dbschema_catalog'
- Generating or applying DDL -> use 'codegen_dbschema_generate_ddl' / 'codegen_dbschema_migrate'
- Detailed per-column drift report against the database -> use 'codegen_dbschema_diff'

This tool runs: npx restforge schema validate --schema-path=<path> [--config=<file>] [--table=<name>] [--json] in the given cwd.
The CLI loads each file in the path (file or folder), runs single-model checks first, then cross-model checks, and reports per-file status.

TWO MODES:
- File only (config omitted): validates the SDF files and cross-model relations. The database is not contacted. The project's default config (set via config set-default) is NOT used, so omitting config always means file-only mode.
- File and database (config given): validates the files, then compares each model with the table structure in the database. One verdict per model: [OK] (valid and in sync), [DRIFT] (valid, but columns, types, indexes, uniques, or FKs differ), [ERROR] with a category: table-missing (table not created yet; migrate or apply fixes it) or sdf-invalid (the file failed validation and was not compared; fix the file).

The table parameter limits the report to one table in both modes. All files in the path are still loaded because FK validation needs the target models. Relation issues are reported under the table that owns the relation.

EXIT CODE SEMANTICS:
- Exit 0 = everything OK.
- Exit 1 = validation errors (file-only mode), or at least one DRIFT/ERROR verdict (file and database mode). In file and database mode this is a meaningful result, not a tool failure.
- Exit 2 = config invalid, database connection failed, or the table name is not in the SDF.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The schema path must exist. If the CLI fails because the folder is missing, the failure response surfaces the underlying cause.

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user. Describe actions by what they do (e.g. "validate the schema files", "look up the schema catalog", "generate the DDL").
- Speak in plain language. Summarise the result; do not paste the raw CLI output unless the user explicitly asks.
- Validation covers two layers: single-model (struct, types, constraints) and cross-model (FK target tables and columns). A model can be single-valid but fail cross-model if its FK target does not exist.
- The user must specify --schema-path (e.g. './schema' or 'schema/users.js'). The CLI no longer accepts a positional argument or default. If the user does not mention a path, confirm it before invoking.
- When a precondition is not met, frame it as a question or next-step suggestion rather than an error.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
        schemaPath: z
          .string()
          .min(1)
          .describe('Path to schema file or folder relative to cwd (e.g. "./schema" or "schema/users.js"). Required by the CLI.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Database config file (e.g. "db-connection.env"). When given, the SDF is also compared with the table structure in the database. When omitted, only the files are validated (the default config is not used).'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Report only one table. All models in the schema path are still loaded and validated.'),
        json: z
          .boolean()
          .optional()
          .describe('Request the JSON report ({ schemaVersion, mode, summary, issues, models? }) instead of the human-readable output.'),
      },
      annotations: {
        title: 'Validate dbschema-kit Files',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, schemaPath, config, table, json }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: @restforgejs/platform must be present in node_modules. per §3.4
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
Requested schema path: ${schemaPath}

For the assistant:
- The user needs to install the RESTForge package before schema files can be validated.
- Suggest installing the package first, then retry validating the schema.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // CLI v4+ requires --schema-path as a flag (no positional, no default). Optional
      // flags forwarded only when supplied; config is never defaulted so that file-only
      // mode stays the default. per §3.5
      const cliArgs = ['restforge', 'schema', 'validate', `--schema-path=${schemaPath}`];
      if (config !== undefined) cliArgs.push(`--config=${config}`);
      if (table !== undefined) cliArgs.push(`--table=${table}`);
      if (json === true) cliArgs.push('--json');

      const databaseMode = config !== undefined;
      const context = `Project path: ${projectCwd}
Schema path: ${schemaPath}
Mode: ${databaseMode ? `file and database (config: ${config})` : 'file only'}
Table filter: ${table ?? 'all tables'}`;

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: databaseMode ? 60_000 : 30_000, // database mode introspects every compared table
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Branch B (verdicts): file and database mode, exit 1 — at least one DRIFT or ERROR
      // verdict. A meaningful result, NOT a tool failure. per §3.5
      if (databaseMode && result.exitCode === 1) {
        return {
          content: [
            {
              type: 'text',
              text: `Schema validation against the database completed: some models are not OK (this is a result, not an error).

${context}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Present this as a factual result per table, NOT a failure.
- [DRIFT] means the file is valid but differs from the database (columns, types, indexes, uniques, or FKs). Additive changes can be applied incrementally with the apply action (preview first); for per-column detail, offer the drift check action.
- [ERROR] table-missing means the table has not been created in the database yet. Suggest migrate or apply.
- [ERROR] sdf-invalid means the schema file failed validation and was not compared. Help fix the file using the catalog (do not invent rules from training data).
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names.
- Match the user's language.`,
            },
          ],
        };
      }

      // Branch C: CLI failure — real error per §3.4 (file-mode validation failures and
      // exit 2 system errors land here). per §3.5
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Schema validation failed.

${context}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the schema validation surfaced one or more issues (or could not run at all).
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Single-model error — a field has an invalid type, constraint, or shorthand. Suggest reviewing the offending file and consulting the schema catalog for valid syntax.
  * Cross-model error — a foreign key references a table or column that does not exist in any sibling schema file. Suggest checking the FK target name and that the referenced model is included in the same path.
  * Schema folder not found — the CLI cannot locate the path. Suggest verifying the folder name passed via --schema-path.
  * Missing required flag --schema-path — the CLI now requires this flag explicitly. Confirm the path with the user.
  * Exit code 2 — the config file is missing or invalid, the database connection failed, or the table name is not in the schema files. Suggest verifying the config, credentials, and table name.
  * Unsupported dialect — the database comparison does not support sqlite yet. Suggest file-only validation (without config) or a postgres/mysql/oracle config.
  * Unknown command 'schema validate' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Read the per-file error report in the CLI output to identify the failing file and field. Help the user fix it by referencing the catalog (do not invent rules from training data).
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the issue is resolved.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B: success — labeled facts + fenced raw output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Schema validation passed.

${context}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that all schema files are valid. If the CLI output lists per-file status lines or [OK] verdicts, count them and mention the count in plain language.
- The validation covers both single-model (type, length, nullable, primary key, default value) and cross-model (FK target table existence, referenced column existence). All layers passed.
- In file and database mode, every compared table also matches the database structure.
- Suggest the next step depending on user intent: list models for an overview, generate DDL for review, or apply via migrate.
- Do not paste the raw CLI output unless the user explicitly asks.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
