import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

// Build a short human-readable description of what was requested, for the labeled
// facts block. Keeps the success response self-describing without re-listing every
// raw flag. Mirrors the "labeled facts" convention of the sibling dbschema tools.
function describeRequest(args: {
  domain?: string;
  table?: string;
  category?: string;
  pattern?: string;
  section?: string;
  hasSdf?: boolean;
  noSdf?: boolean;
  show?: boolean;
  example?: boolean;
  lang?: string;
  generate?: boolean;
  schemaPath?: string;
  force?: boolean;
  listDomains?: boolean;
  listCategories?: boolean;
  listSections?: boolean;
  stats?: boolean;
  format?: string;
}): string {
  const parts: string[] = [];
  if (args.generate) parts.push(`generate template '${args.table ?? '(missing table)'}' to '${args.schemaPath ?? '(missing path)'}'`);
  else if (args.show) parts.push(`show template '${args.table ?? '(missing table)'}'${args.example ? ' with example data' : ''}`);
  else if (args.stats) parts.push('collection statistics');
  else if (args.listDomains) parts.push('list domains');
  else if (args.listCategories) parts.push('list categories');
  else if (args.listSections) parts.push('list sections');
  else parts.push('list/browse templates');

  const filters: string[] = [];
  if (args.domain) filters.push(`domain=${args.domain}`);
  if (args.table && !args.show && !args.generate) filters.push(`table=${args.table}`);
  if (args.category) filters.push(`category=${args.category}`);
  if (args.pattern) filters.push(`pattern=${args.pattern}`);
  if (args.section) filters.push(`section=${args.section}`);
  if (args.hasSdf) filters.push('has-sdf');
  if (args.noSdf) filters.push('no-sdf');
  if (filters.length > 0) parts.push(`filters: ${filters.join(', ')}`);
  if (args.lang) parts.push(`lang=${args.lang}`);
  if (args.format) parts.push(`format=${args.format}`);
  if (args.force) parts.push('force=overwrite');
  return parts.join('; ');
}

export function registerCodegenDbschemaTemplate(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_template',
    {
      title: 'Browse / Preview / Generate Schema Templates',
      description: `Access the RESTForge Schema Reference collection (87 ready-made templates across 30+ domains: ERP, finance, inventory, e-commerce, CRM, HR, POS, and more) by wrapping restforge schema template: browse and filter the catalog, preview a template's SDF or SQL, list domains/categories/sections, and scaffold schema files from a template.

USE WHEN the user explicitly asks for the template collection:
- An example schema, a ready-made template, or "what templates are available" ("ada template schema untuk sales order?", "buatkan schema inventory dari template", "template apa saja untuk domain ERP")
- Exploring the catalog by domain/category/pattern, or SDF gap analysis (noSdf=true)
- Previewing a template's SDF or SQL before writing it to a file

DO NOT USE FOR:
- A plain request to create a table that does not mention a template or example ("buatkan tabel product") -> ask for the fields and types when they are not stated (the user may leave the design to the assistant), then write schema/<table>.js with the file tools, grounded by 'codegen_get_dbschema_catalog'. Never substitute a template for the user's own structure.
- An explicit draft / skeleton file request -> 'codegen_dbschema_init'
- Editing an existing schema file -> Edit/Write tools
- Reverse-engineering from a live database -> 'codegen_dbschema_introspect'
- Validating a schema or generating DDL -> 'codegen_dbschema_validate' / 'codegen_dbschema_generate_ddl'

FOUR MODES:
- LIST / BROWSE (default, no show/generate/utility flag): filtered catalog. Filters combine: domain (csv), table (wildcard glob like "sales*"), category, pattern, section, hasSdf, noSdf.
- SHOW (show=true, needs a SPECIFIC table name, no wildcard): prints the template. lang=sdf (default) prints the dbschema-kit factory; lang=sql prints raw DDL. example=true adds sample data (only with show).
- GENERATE (generate=true, needs a SPECIFIC table AND path): writes the template to disk. A master-detail template writes TWO files (e.g. sales_order.js + sales_order_item.js). force=true overwrites existing files; without force the CLI refuses.
- UTILITY (stats / listDomains / listCategories / listSections): collection statistics and the lookup lists for the filters.

PLATFORM DEPENDENCY: the collection is backed by a WINDOWS-ONLY native binary (sdf-tools.exe). On another host, or when the binary is missing, the CLI exits with code 3 and this tool reports the collection as unavailable on this platform. That is NOT a user error: explain it plainly and offer to author the SDF by hand (grounded by 'codegen_get_dbschema_catalog') or introspect an existing database.

This tool runs: npx restforge schema template [filters/mode flags] in the given cwd. Boolean flags (show, generate, stats, hasSdf, noSdf, example, force, listDomains, listCategories, listSections) are sent bare only when true; string/enum flags (domain, table, category, pattern, section, lang, path, format) are sent as --flag=value when supplied.

OUTPUT: the CLI text is relayed as-is. --format=json is honoured by list/stats/listDomains/listCategories/listSections but NOT by show (schema code) or generate (written-files summary). Pass format=json only when the JSON form of a list/utility result is needed.

CLI constraints (enforced by the CLI; this tool forwards its error): show and generate need a specific table name; generate needs path; example only works with show; force only matters with generate.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The Windows-only sdf-tools.exe binary must ship with the package (exit 3 otherwise).

NOTES:
- For generate: confirm the files written and their paths (a master-detail template creates two files), then suggest validating the schema.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
        // Filters (list/browse).
        domain: z
          .string()
          .min(1)
          .optional()
          .describe('Filter by domain, comma-separated (e.g. "erp" or "erp,finance"). Look up valid values via listDomains.'),
        table: z
          .string()
          .min(1)
          .optional()
          .describe('For list: wildcard glob filter on table name (e.g. "sales*", "*_invoice"). For show/generate: the EXACT template/table name (no wildcard).'),
        category: z
          .enum(['master-data', 'transactional'])
          .optional()
          .describe('Filter by category.'),
        pattern: z
          .enum(['single-table', 'master-detail'])
          .optional()
          .describe('Filter by pattern. master-detail templates generate two files on generate.'),
        section: z
          .string()
          .min(1)
          .optional()
          .describe('Filter by section code. Look up valid values via listSections.'),
        hasSdf: z
          .boolean()
          .optional()
          .describe('When true, only templates that already have an SDF version. Sent as --has-sdf.'),
        noSdf: z
          .boolean()
          .optional()
          .describe('When true, only templates without an SDF version (gap analysis). Sent as --no-sdf.'),
        // Display (show).
        show: z
          .boolean()
          .optional()
          .describe('When true, print the template schema. Requires a specific table name (no wildcard).'),
        example: z
          .boolean()
          .optional()
          .describe('When true, include a sample-data section. Only meaningful together with show.'),
        lang: z
          .enum(['sdf', 'sql'])
          .optional()
          .describe('Schema language for show/generate: sdf (default, the dbschema-kit factory function) or sql (raw DDL).'),
        // Generate.
        generate: z
          .boolean()
          .optional()
          .describe('When true, write the template to the filesystem. Requires a specific table name AND schemaPath. WRITES FILES.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe('Destination directory (or file) for generate, relative to cwd or absolute.'),
        force: z
          .boolean()
          .optional()
          .describe('When true, overwrite existing destination files during generate. Without it, the CLI refuses to overwrite. Sent as --force.'),
        // Utility.
        listDomains: z
          .boolean()
          .optional()
          .describe('When true, list all available domains. Sent as --list-domains.'),
        listCategories: z
          .boolean()
          .optional()
          .describe('When true, list all template categories. Sent as --list-categories.'),
        listSections: z
          .boolean()
          .optional()
          .describe('When true, list all sections with their category. Sent as --list-sections.'),
        stats: z
          .boolean()
          .optional()
          .describe('When true, show collection statistics (counts per category, pattern, domain, section).'),
        format: z
          .enum(['table', 'plain', 'json'])
          .optional()
          .describe('Output format: table (default), plain, or json. json is honoured by list/stats/list* modes only, not by show/generate.'),
      },
      annotations: {
        title: 'Browse / Preview / Generate Schema Templates',
        destructiveHint: false, // generate writes new files; force overwrites, but it never drops database data
        idempotentHint: false,  // generate writes to the filesystem; output also depends on the live catalog state
      },
    },
    async ({
      cwd,
      domain,
      table,
      category,
      pattern,
      section,
      hasSdf,
      noSdf,
      show,
      example,
      lang,
      generate,
      schemaPath,
      force,
      listDomains,
      listCategories,
      listSections,
      stats,
      format,
    }) => {
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

For the assistant:
- The user needs to install the RESTForge package before the schema template collection can be used.
- Suggest installing the package first, then retry.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the flags that were supplied. Booleans become bare flags when
      // true (mirrors the platform forwarder buildBinaryArgs: BOOLEAN_FLAGS only when
      // === true); string/enum flags become --flag=value. CLI flag names are
      // kebab-case (--has-sdf, --no-sdf, --list-domains, ...). per §3.5
      const cliArgs = ['restforge', 'schema', 'template'];
      if (domain !== undefined) cliArgs.push(`--domain=${domain}`);
      if (table !== undefined) cliArgs.push(`--table=${table}`);
      if (category !== undefined) cliArgs.push(`--category=${category}`);
      if (pattern !== undefined) cliArgs.push(`--pattern=${pattern}`);
      if (section !== undefined) cliArgs.push(`--section=${section}`);
      if (hasSdf === true) cliArgs.push('--has-sdf');
      if (noSdf === true) cliArgs.push('--no-sdf');
      if (show === true) cliArgs.push('--show');
      if (example === true) cliArgs.push('--example');
      if (lang !== undefined) cliArgs.push(`--lang=${lang}`);
      if (generate === true) cliArgs.push('--generate');
      if (schemaPath !== undefined) cliArgs.push(`--schema-path=${schemaPath}`);
      if (force === true) cliArgs.push('--force');
      if (listDomains === true) cliArgs.push('--list-domains');
      if (listCategories === true) cliArgs.push('--list-categories');
      if (listSections === true) cliArgs.push('--list-sections');
      if (stats === true) cliArgs.push('--stats');
      if (format !== undefined) cliArgs.push(`--format=${format}`);

      const requestSummary = describeRequest({
        domain,
        table,
        category,
        pattern,
        section,
        hasSdf,
        noSdf,
        show,
        example,
        lang,
        generate,
        schemaPath,
        force,
        listDomains,
        listCategories,
        listSections,
        stats,
        format,
      });

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 30_000, // native binary; list/show/stats are fast, generate writes a couple of files
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Branch: exit 3 — the template feature is unavailable on this platform. NOT a
      // user error: the CLI returns exit 3 when the host is non-Windows OR the
      // sdf-tools.exe binary is missing from the installed package (template.js:185-200). per §3.4
      if (result.exitCode === 3) {
        return {
          content: [
            {
              type: 'text',
              text: `The schema template collection is unavailable on this platform.

Project path: ${projectCwd}
Requested: ${requestSummary}
Command: ${result.command}
Exit code: 3

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- This is NOT a mistake by the user and NOT a bug in the request. The template feature is backed by a native binary (sdf-tools.exe) that currently only runs on Windows; exit 3 means either the host is not Windows, or the binary is missing from the installed package.
- Do not retry the same call — it will fail again on this host. Instead, offer the alternatives:
  * Author the schema by hand: look up the defineModel syntax, field types, and constraints (the schema catalog is the ground truth), then create the file and validate it.
  * Reverse-engineer the schema from an existing database table, if one already exists.
- Explain plainly to the user that the ready-made template collection is not available on this platform, then propose one of the alternatives above. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch: exit 1 (binary spawn failure) / exit 2 (usage error) / any other
      // non-zero — a real error. Relay full output plus likely causes. per §3.4
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to run the schema template command.

Project path: ${projectCwd}
Requested: ${requestSummary}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the template command did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * Usage error (exit 2) — an invalid flag combination. Recall the CLI constraints: show/generate need a specific table name (no wildcard); generate also needs path; example only works with show; an unknown enum value for category/pattern/lang/format is rejected.
  * Binary spawn failure (exit 1) — sdf-tools.exe could not be launched; suggest re-checking the installed package integrity.
  * For generate specifically: the destination file already exists and force was not set (the CLI refuses to overwrite) — suggest a different path or passing force=true after confirming with the user.
  * Unknown command 'schema template' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch: success (exit 0) — relay the CLI text output as-is. The output shape
      // varies by mode (table/plain/json for list/stats; schema code for show; a
      // written-files summary for generate); the tool does not parse it. per §3.5
      const generated = generate === true;
      return {
        content: [
          {
            type: 'text',
            text: `Schema template command completed successfully.

Project path: ${projectCwd}
Requested: ${requestSummary}
${format ? `Format: ${format}\n` : ''}
--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
${generated
  ? `- Confirm to the user which files were written and their paths — the CLI output above lists each generated file. A master-detail template writes two files (the master plus its detail/line table).
- Suggest opening the generated file(s) and then validating the schema as a sanity check (without naming the internal tool).
- The generated schema is a real, fleshed-out starting point from the reference collection, not an empty skeleton; the user may still want to adjust field names/sizes to their exact domain.`
  : show === true
    ? `- This is a preview only; nothing was written to the filesystem.
- Read the schema above and summarise it in plain language if the user asked a question. If they want to keep it, offer to generate it to a file (which would write the actual file).`
    : `- Read the output above and summarise it for the user (e.g. how many templates matched, the ones relevant to their task, or the requested list/statistics).
- Do not paste the entire table or JSON if it is long; surface only what the user needs. If they then want a specific template, offer to preview it (show) or scaffold it to a file (generate).`}
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
