import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenSyncPayload(server: McpServer): void {
  server.registerTool(
    'codegen_sync_payload',
    {
      title: 'Sync Payload',
      description: `Apply schema drift to existing RDF payload files, archiving the previous version of each updated file, by running restforge payload sync. With expandFk=true it also adds JOIN columns from referenced tables to datatables.

USE WHEN:
- The user asks to sync payload files with the database or apply schema drift ("sinkronisasi payload", "samakan payload dengan database", "terapkan perubahan schema")
- After 'codegen_diff_payload' showed differences the user wants applied, or after a table was altered
- The user wants columns from a referenced table in datatables ("tampilkan nama supplier di datatables", "kolom join di datatables", "expand foreign key") -> expandFk=true with table
- Consider 'codegen_diff_payload' first so the user sees what will change; sync overwrites the active payload and archives the old one

DO NOT USE FOR:
- Only checking which payloads drifted -> 'codegen_validate_payload'
- Per-column differences without applying them -> 'codegen_diff_payload'
- A table with no payload yet -> 'codegen_generate_payload'
- Cleaning up archived files in '.restforge/archive/' (manual task; the 5 most recent runs are kept automatically)

FK EXPANSION (expandFk):
- Opt-in and REQUIRES 'table'. Without it, sync is pure schema drift.
- The CLI builds a JOIN from the table's foreign keys, writes query/<table>-join.sql, and repoints datatablesQuery/viewQuery at it. The generator never produces join columns; this is the path.
- 'fkColumns' (optional): QUALIFIED 'table.column' list (e.g. 'supplier.supplier_code,supplier.supplier_name'). Omitted: the display column per FK is auto-resolved (name/nama -> code/kode -> number/nomor/no/num -> title/judul/label -> first UNIQUE text column). The PK is never a display column.
- 'expandFkSkip' (optional): referenced tables to leave out ('ref_table', or 'local_fk_col:ref_table' for one of several FKs to the same table).
- When a referenced table has no display candidate, the CLI fails with "No natural display column found for referenced table ..." and lists the columns. Ask the user which column to show or whether to skip that relation, then retry with 'fkColumns' or 'expandFkSkip'. Do not pick a column for the user.
- A table without foreign keys gets no JOIN; relay that.

CHECK CONSTRAINTS (schemaPath):
- The CLI reads the SDF files (default folder 'schema') and derives CHECK constraints into fieldValidation (enum, min, max, notEqual) plus the checkConstraints registry. A payload already in sync with the database is still updated when these derived values are missing ("CHECK constraints derived from SDF").
- Pass 'schemaPath' only when the SDF is not in 'schema'. Without an SDF this derivation is skipped and existing values are kept.

This tool runs: npx restforge payload sync --config=<config> [--table=<table>] [--schema-path=<path>] [--expand-fk [--fk-columns=table.col,table.col] [--expand-fk-skip=table,table]] in the given cwd. Each drifted payload is first moved to '.restforge/archive/<run>/<original relative path>' (the 5 most recent runs are kept); files in sync are not touched. The CLI prints per-file status ([SKIP], [ARCHIVE], [SYNCED]) and a Summary. If a run fails partway, the CLI restores the archived file so the active payload is not left corrupted.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The config file (default 'db-connection.env') must exist with valid database credentials; a CLI failure surfaces the cause.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform and the config file)'),
        config: z
          .string()
          .min(1)
          .default('db-connection.env')
          .describe('Config file name (relative to project) used by the CLI to connect to the database'),
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
Config: ${config}
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
Config: ${config}
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
Requested config: ${config}

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
      const args = ['restforge', 'payload', 'sync', `--config=${config}`];
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
Config: ${config}
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
Config: ${config}
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
