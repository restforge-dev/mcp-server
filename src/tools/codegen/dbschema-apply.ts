import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

// Pull one labelled block (e.g. 'Warnings:' or 'Summary:') out of the structured
// human-readable stdout. The CLI prints the header on its own line and the block
// ends at the first blank line. Defensive: returns null when the header is absent
// or the shape is unexpected — the caller then falls back to the full stdout.
function extractBlock(stdout: string, header: string): string | null {
  const lines = stdout.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) return null;
  const block = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') break;
    block.push(lines[i]);
  }
  return block.join('\n');
}

// Compose the Warnings + Summary excerpt for the opt-in branch. Falls back to a
// pointer line when neither block is found, so the response never loses signal.
function extractWarningsAndSummary(stdout: string): string {
  const parts: string[] = [];
  const warnings = extractBlock(stdout, 'Warnings:');
  if (warnings) parts.push(warnings);
  const summary = extractBlock(stdout, 'Summary:');
  if (summary) parts.push(summary);
  if (parts.length === 0) {
    return '(no Warnings:/Summary: blocks recognised — see the full CLI output above)';
  }
  return parts.join('\n\n');
}

export function registerCodegenDbschemaApply(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_apply',
    {
      title: 'Apply Schema Drift Incrementally via ALTER',
      description: `Apply schema drift from SDF files to the live database with incremental ALTER statements, by running npx restforge schema apply. It is the safe alternative to 'codegen_dbschema_migrate' with drop=true. By default it is additive only (ADD COLUMN, CREATE INDEX, ADD UNIQUE, ADD FOREIGN KEY); drops need allowDrop and column length/nullable or FK action changes need allowModify.

DESTRUCTIVE when dryRun=false: runs ALTER statements on the live database. Run 'codegen_dbschema_diff', then this tool with dryRun=true, show the preview, and apply only after the user confirms. Pass allowDrop/allowModify ONLY when the user explicitly asked for that change; never retry with them automatically.

USE WHEN:
- 'codegen_dbschema_diff' reported drift and the user wants the database in sync ("sinkronkan database dengan schema")
- Evolving a populated database without recreating tables
- Previewing the ALTER statements (dryRun=true)

DO NOT USE FOR:
- Detecting drift only -> 'codegen_dbschema_diff'
- Initial setup of an empty database -> 'codegen_dbschema_migrate'
- Type, precision, primary key, default value, or CHECK changes -> never applied (reported as deferred); suggest a manual SQL migration
- Validating SDF files -> 'codegen_dbschema_validate'

NOTES:
- Exit 0: all applicable drift applied or previewed. Exit 1: some drift was skipped because it needs allowDrop/allowModify; this is a normal result, the additive part was applied. Report what was applied and what was skipped, then ask the user about the skipped part. Exit 2: system error; ROLLBACK means the database is unchanged, PARTIAL means some statements ran and the database needs inspection.
- SQLite also skips column modify/drop and all foreign key changes.
- Soft-delete CHECK drift is reported as a warning only.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and the config file)'),
        config: z
          .string()
          .min(1)
          .default('db-connection.env')
          .describe('Config file name relative to the project, used by the CLI to connect to the database'),
        schemaPath: z
          .string()
          .min(1)
          .describe('Path to schema file or folder relative to cwd (e.g. "./schema" or "schema/users.js"). Required by the CLI.'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('Apply only one specific table. When omitted, all models in the schema path are processed.'),
        dryRun: z
          .boolean()
          .default(false)
          .describe('Default false. When true, preview the ALTER statements without applying. Safe path: prefer this on the first call.'),
        allowDrop: z
          .boolean()
          .default(false)
          .describe('Default false. Opt-in for DROP COLUMN/INDEX/UNIQUE/FOREIGN KEY (destroys data or constraints). Require explicit user confirmation before passing true.'),
        allowModify: z
          .boolean()
          .default(false)
          .describe('Default false. Opt-in for ALTER COLUMN length/nullable and FOREIGN KEY action changes (potential data loss). Require explicit user confirmation before passing true.'),
      },
      annotations: {
        title: 'Apply Schema Drift Incrementally via ALTER',
        destructiveHint: true,  // mutates the live database; with opt-in flags also drops columns/constraints
        idempotentHint: false,  // re-running applies whatever drift remains; state-dependent
      },
    },
    async ({ cwd, config, schemaPath, table, dryRun, allowDrop, allowModify }) => {
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
Requested config: ${config}
Requested schema path: ${schemaPath}
Requested table filter: ${table ?? 'all tables'}
Requested dryRun: ${dryRun}

For the assistant:
- The user needs to install the RESTForge package before drift can be applied to the database.
- Suggest installing the package first, then retry the apply.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Boolean flags are only forwarded when true, following the migrate/introspect
      // pattern. There is no JSON output mode for schema apply. per §3.5
      const cliArgs = [
        'restforge',
        'schema',
        'apply',
        `--schema-path=${schemaPath}`,
        `--config=${config}`,
      ];
      if (table !== undefined) cliArgs.push(`--table=${table}`);
      if (dryRun === true) cliArgs.push('--dry-run');
      if (allowDrop === true) cliArgs.push('--allow-drop');
      if (allowModify === true) cliArgs.push('--allow-modify');

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 120_000, // introspection + ALTER execution on a populated DB can be slow
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Exit code semantics are part of the CLI spec: 0 = all applicable drift
      // applied (or no drift), 1 = some drift skipped pending opt-in (a meaningful
      // result, NOT an error), 2 = system error. Deliberately NO "exit 2 = dry-run
      // success" sentinel here: a successful apply dry-run exits 0 or 1.
      const optInRequired = result.exitCode === 1;

      // Branch C: system error (exit 2 or any other non-0/1 exit). per §3.4
      if (!result.success && !optInRequired) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to apply schema drift to the database.

Project path: ${projectCwd}
Config: ${config}
Schema path: ${schemaPath}
Table filter: ${table ?? 'all tables'}
Mode: ${dryRun ? 'dry-run' : 'apply'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the apply could not complete. This is a system error, not a drift result.
- Check the CLI output for ROLLBACK or PARTIAL status first:
  * ROLLBACK applied — the database state is UNCHANGED; the failed statement is reported. Safe to fix the cause and retry.
  * Partial apply detected — SOME statements were applied before the failure and were NOT reverted. The user must inspect the database state manually before any retry.
- Other common causes, in plain language:
  * Config file not found or invalid — suggest verifying the config path and its content.
  * Database connection failed — suggest verifying credentials, host, and port.
  * Schema path not found or no models in it — suggest verifying the folder or file name passed via --schema-path.
  * SDF load error — a schema file has invalid syntax or violates the defineModel contract. Suggest running the validate action first.
  * Table filter not found in SDF — the --table value does not match any model.
  * Unsupported dialect — schema apply does not support sqlite. Suggest checking DB_TYPE in the config.
  * Unknown command 'schema apply' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.
- Offer to retry once the underlying issue is resolved (after manual inspection in the PARTIAL case).`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B (opt-in required): exit 1 — part of the drift was skipped because
      // it needs --allow-drop / --allow-modify. A meaningful result, NOT an error.
      if (optInRequired) {
        const excerpt = extractWarningsAndSummary(result.stdout);
        return {
          content: [
            {
              type: 'text',
              text: `Schema apply ${dryRun ? 'dry-run ' : ''}completed with skipped drift: some changes require explicit opt-in (this is a result, not an error).

Project path: ${projectCwd}
Config: ${config}
Schema path: ${schemaPath}
Table filter: ${table ?? 'all tables'}
Mode: ${dryRun ? 'dry-run (nothing applied)' : 'apply (additive statements WERE applied)'}

--- Warnings and Summary (from the CLI) ---
${excerpt}
--- end Warnings and Summary ---

--- Full CLI output ---
${result.stdout}
--- end Full CLI output ---

For the assistant:
- Present this as a two-part factual result: (1) what was ${dryRun ? 'previewed' : 'applied'} — see the ${dryRun ? 'DDL preview' : 'progress lines'} in the full output; (2) what was SKIPPED — the Warnings above list each skipped item with its reason ('requires --allow-drop' or 'requires --allow-modify').
- ${dryRun ? 'This was a preview only. Nothing was applied to the database.' : 'The additive statements were applied to the live database; only the skipped items remain outstanding.'}
- Do NOT retry with allowDrop/allowModify on your own. Those options drop columns/constraints or alter existing columns — explain to the user what would be dropped or modified, and only proceed after the user explicitly confirms.
- Warnings with reason 'deferred', 'detection-only', or 'sqlite limitation' cannot be resolved by opt-in flags at all — those need a manual migration or a full recreate; say so plainly.
- Do not paste the full CLI output unless the user asks; the Warnings/Summary excerpt is usually enough.
- Match the user's language.`,
            },
          ],
          isError: false, // exit 1 = drift pending opt-in, a normal result per CLI spec
        };
      }

      // Branch B (dry-run success): exit 0 with --dry-run — preview only.
      if (dryRun) {
        return {
          content: [
            {
              type: 'text',
              text: `Schema apply dry-run completed (no changes applied).

Project path: ${projectCwd}
Config: ${config}
Schema path: ${schemaPath}
Table filter: ${table ?? 'all tables'}
Mode: dry-run

--- DDL preview ---
${result.stdout}
--- end DDL preview ---

For the assistant:
- Confirm to the user that this was a preview only. No ALTER statement was applied to the database.
- The statements shown above are exactly what would run if the same action is repeated without dry-run. "No applicable ALTER statements." means schema and database are already in sync for the applicable operations.
- If a Warnings block is present, relay it: warnings with reason 'deferred', 'detection-only', or 'sqlite limitation' are operations the platform cannot apply incrementally yet (they do not block the rest).
- Encourage the user to review the preview, then confirm before running the real apply.
- Match the user's language.`,
            },
          ],
        };
      }

      // Branch B (apply success): exit 0 — every applicable drift applied (or no drift).
      return {
        content: [
          {
            type: 'text',
            text: `Schema apply completed successfully: all applicable drift was applied.

Project path: ${projectCwd}
Config: ${config}
Schema path: ${schemaPath}
Table filter: ${table ?? 'all tables'}
Mode: apply
allowDrop: ${allowDrop}
allowModify: ${allowModify}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that the incremental changes were applied to the live database. "No drift to apply." means schema and database were already in sync.
- Read the Summary in the CLI output and mention the number of statements applied in plain language.
- If skipped warnings are present (reason 'deferred', 'detection-only', or 'sqlite limitation'), relay them: those operations cannot be applied incrementally yet and need a manual migration or a full recreate. They did not block this apply.
- Suggest verifying the result with a drift check (read-only) if the user wants confirmation that everything is now in sync.
- Do not paste the raw CLI output unless the user explicitly asks.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
