import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';
import { configArgs, configLabel } from '../../lib/default-config.js';

export function registerCodegenSyncPayload(server: McpServer): void {
  server.registerTool(
    'codegen_sync_payload',
    {
      title: 'Sync Payload',
      description: `Apply schema drift to existing RDF payload files, by running npx restforge payload sync. Each changed file is archived to '.restforge/archive/<run>/' first (5 most recent runs kept); files in sync are untouched. With expandFk=true it also adds JOIN columns from referenced tables to datatables.

USE WHEN:
- The user wants payload files synced with the database ("samakan payload dengan database", "terapkan perubahan schema")
- 'codegen_diff_payload' showed differences the user wants applied, or a table was altered
- The user wants columns of a referenced table in datatables ("tampilkan nama supplier di datatables") -> expandFk=true with 'table'

DO NOT USE FOR:
- Only checking which payloads drifted -> 'codegen_validate_payload'
- Per-column differences without applying -> 'codegen_diff_payload'
- A table with no payload yet -> 'codegen_generate_payload'

NOTES:
- expandFk requires 'table'. It writes query/<table>-join.sql and points datatablesQuery/viewQuery at it; this is the only way to get JOIN columns.
- fkColumns takes qualified 'table.column' values; when omitted, one display column per FK is picked (name/nama, code/kode, number/no, title/label, then the first UNIQUE text column; never the PK). expandFkSkip leaves out 'ref_table' or 'local_fk_col:ref_table'.
- "No natural display column found for referenced table ..." means the user must choose: ask which column to show or whether to skip the relation, then retry with fkColumns or expandFkSkip. Do not choose for the user.
- CHECK constraints from the SDF (default folder 'schema', or 'schemaPath') are derived into fieldValidation and checkConstraints, even for payloads otherwise in sync.
- A failed run restores the archived file.`,
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
          .describe('Specific table name to sync (e.g. supplier or core.supplier). When omitted, all payload files in the payload/ directory are synced.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe("Schema definition (SDF) location, file or folder, used to derive CHECK constraints into the payload. Omit to use the CLI default ('schema')."),
        expandFk: z
          .enum(['both', 'datatables-only'])
          .optional()
          .describe("Opt-in FK expansion mode. 'both': write query/<table>-join.sql and point both datatablesQuery and viewQuery at it. 'datatables-only': same but viewQuery is left unchanged (use when viewQuery already points to a custom SQL file). REQUIRES table. When omitted, sync only applies schema drift."),
        fkColumns: z
          .string()
          .min(1)
          .optional()
          .describe("Override display columns for specific FKs. Format: 'ref_table.column' for unambiguous FKs, or 'local_fk_col:ref_table.column' to disambiguate when the same table is referenced by multiple FK columns (e.g. 't_group_id:t_group.nama,t_group_id_d1:t_group.kode'). FKs not listed here are auto-resolved. When omitted entirely, all FKs are auto-resolved; duplicate FK targets are auto-disambiguated using the local FK column name as prefix."),
        expandFkSkip: z
          .string()
          .min(1)
          .optional()
          .describe("Referenced tables to leave out of the FK expansion. Format: 'ref_table', or 'local_fk_col:ref_table' to skip only one of several FKs to the same table (e.g. 'shift_pattern,approver_id:employee'). The other FKs are still expanded. A relation must not appear in both fkColumns and expandFkSkip. REQUIRES expandFk."),
      },
      annotations: {
        title: 'Sync Payload',
        readOnlyHint: false,    // tool menulis ulang file payload + membuat file archive
        idempotentHint: false,  // memanggil ulang dapat menambah file archive baru jika DB berubah lagi di antara panggilan
      },
    },
    async ({ cwd, config, table, schemaPath, expandFk, fkColumns, expandFkSkip }) => {
      const projectCwd = resolve(cwd);

      // FK expansion requires a single-table target. Guard before touching the
      // package / spawning the CLI, mirroring the CLI's own upfront check.
      // Treated as a non-error precondition per the authoring guide §3.4.
      if (expandFk && !table) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: FK expansion needs a specific table.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Requested: expandFk without a table

For the assistant:
- FK expansion (expandFk) only works on a single table, so a 'table' must be provided.
- Ask the user which table to expand, then retry with that table.
- Do not mention internal tool names in the reply to the user.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // expandFkSkip hanya bermakna bersama expandFk; CLI juga menolaknya.
      if (expandFkSkip && !expandFk) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: skipping FK relations needs FK expansion.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Requested: expandFkSkip without expandFk

For the assistant:
- expandFkSkip only applies when FK expansion (expandFk) is enabled.
- Ask the user whether FK expansion should be enabled for this table, then retry with both expandFk and expandFkSkip.
- Do not mention internal tool names in the reply to the user.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

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
- The user needs to install the RESTForge package before payload files can be synced with the database schema.
- Use the appropriate package-installation tool to do this, then retry syncing the payload.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. Defaults inside restforge
      // (e.g. payload/ as the default output dir, all files when --table is omitted)
      // should remain in effect when the user does not specify them. per §3.5
      const args = ['restforge', 'payload', 'sync', ...configArgs(config)];
      if (table) args.push(`--table=${table}`);
      if (schemaPath) args.push(`--schema-path=${schemaPath}`);
      if (expandFk) {
        args.push(`--expand-fk=${expandFk}`);
        if (fkColumns) args.push(`--fk-columns=${fkColumns}`);
        if (expandFkSkip) args.push(`--expand-fk-skip=${expandFkSkip}`);
      }

      // Timeout raised to 60s (vs 30s for validate/diff): sync writes payload files
      // and renames each previous version to a sequential archive, which can take
      // longer than read-only operations on projects with many payload files.
      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 60_000 });

      // CLI failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to sync payload.

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
- Tell the user that updating the payload files did not complete successfully.
- Summarise the likely cause from the CLI output in plain language (common causes: the config file is missing or has incomplete credentials, the database is unreachable, the requested table does not exist, or the payload directory is empty). Do not paste the raw stdout/stderr unless the user explicitly asks.
- If the output contains "No natural display column found for referenced table", FK expansion could not decide which column of that referenced table to show. Relay the table name and the listed available columns, ask the user which column to show or whether to leave that relation out, then retry with fkColumns ('ref_table.column') or expandFkSkip ('ref_table'). Do not choose the column yourself.
- Reassure the user: when a sync run fails, the CLI automatically restores any payload file that was just archived back to its original name, so the active payload files are not left in a corrupted state.
- Offer to retry once the underlying issue is resolved. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Success: one-line summary + labeled facts + fenced raw output per §3.5.
      // The CLI prints per-file status lines ([SKIP] / [ARCHIVE] / [SYNCED]) and a
      // Summary section with totals. The model should extract the counts and the
      // archive filenames from stdout when talking to the user. per §5.2 cross-ref
      // back to validate/diff.
      return {
        content: [
          {
            type: 'text',
            text: `Payload sync completed.

Project path: ${projectCwd}
Config: ${configLabel(config)}
Table: ${table ?? 'all'}
FK expansion: ${expandFk ? `on${fkColumns ? ` (fk-columns: ${fkColumns})` : ' (auto-resolved display columns)'}${expandFkSkip ? ` (skipped: ${expandFkSkip})` : ''}` : 'off'}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Read the Summary section in the CLI output above and tell the user how many payload files were SYNCED and how many were SKIPPED (already in sync). Do not paste the raw CLI output unless the user explicitly asks.
- If FK expansion was on, tell the user that a JOIN query file (query/<table>-join.sql) was generated from the table's foreign keys and datatablesQuery/viewQuery now reference it, so columns from the referenced tables appear in datatables. If the CLI output reports the table has no foreign keys, relay that no JOIN was applied.
- For each file that was updated, the previous version of the file was moved to '.restforge/archive/<run>/<original relative path>'. Mention this to the user in plain language so they know the old version is still on disk and available for manual rollback if needed. If the CLI output lists specific archive filenames, you may relay them to the user.
- Important: warn the user that any module or endpoint that was previously generated from the older payload still reflects the old schema. To bring those endpoints in line with the new schema, the user needs to regenerate the endpoint code from the updated payload as a follow-up step. Describe this in plain language; do not name the internal tool.
- If no files were synced (every file was SKIPPED because it was already in sync), confirm in plain language that the payload files already match the database and no changes were applied.
- Keep the reply concise. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
