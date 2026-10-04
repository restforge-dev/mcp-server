import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenGetDbschemaCatalog(server: McpServer): void {
  server.registerTool(
    'codegen_get_dbschema_catalog',
    {
      title: 'Get dbschema-kit Catalog',
      description: `Get the authoritative JSON catalog of the dbschema-kit defineModel API (the SDF syntax): defineModel options, field types and modifiers, constraints, relations (belongsTo, hasMany, hasOne), referential actions, check operations, audit columns, the soft-delete contract, shorthand syntax, naming rules, and dialect support (postgres/mysql/oracle/sqlite).

USE WHEN:
- Before writing or editing schema/<table>.js, once its fields are settled with the user (or the design was handed over): request only the sections the file needs (e.g. section=fieldTypes, shorthandSyntax, auditColumns, relationTypes), once per session
- The user asks about SDF syntax: \`defineModel\`, shorthand like \`string:36 pk\` or \`decimal:15,2 default:0\`, field types, relations, \`unique\`/\`checks\`, \`onDelete\`/\`onUpdate\`, the legacy \`fk:\` token ("bagaimana sintaks defineModel", "field type apa saja")
- The user asks about audit columns (created_at, created_by, updated_at, updated_by) or soft-delete in the schema layer (section=softDelete)
- The user asks which dialects are supported

DO NOT USE FOR:
- Validating a schema file -> 'codegen_dbschema_validate'
- Listing models, generating DDL, migrating, or introspecting -> 'codegen_dbschema_models' / 'codegen_dbschema_generate_ddl' / 'codegen_dbschema_migrate' / 'codegen_dbschema_introspect'
- RDF payload rules -> 'codegen_get_field_validation_catalog' / 'codegen_get_query_declarative_catalog'; dashboard spec -> 'codegen_get_dashboard_catalog'
- Live database tables -> 'codegen_list_tables' / 'codegen_describe_table'

PK/FK CONVENTION: UUID primary keys and the foreign keys that reference them are string:36 (the uuid type only appears in SDF introspected from native UUID columns). Foreign keys are declared in relations as belongsTo entries (localKey, references, onDelete); never write the inline fk: shorthand, which the parser still accepts only for existing schema files.

SOFT-DELETE SECTION: documents the three contract columns (is_deleted/deleted_at/deleted_by, biconditional with softDelete.enabled), the reusable unique-column rules (string/text + single-column UNIQUE + physical length >= base length + 38), the UNIQUE eligibility gate (composite and non-string UNIQUEs rejected), the emitted DDL (CHECK chk_<table>_soft_delete_consistency and PostgreSQL partial indexes), and dialect support (Phase 1: PostgreSQL only).

This tool runs: npx restforge catalog dbschema [--section=<X>] [--name=<Y>] [--kind=<Z>] in the given cwd. The catalog is sourced from restforge (single source of truth), so it matches the installed dbschema-kit version. Use it as ground truth: do not invent flags or behaviour that are not in the catalog.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
        section: z
          .enum([
            'defineModelOptions',
            'fieldTypes',
            'constraints',
            'relationTypes',
            'referentialActions',
            'checkOperations',
            'auditColumns',
            'softDelete',
            'shorthandSyntax',
            'namingRules',
            'dialectSupport',
          ])
          .optional()
          .describe('Filter to a single catalog section. When omitted, the full catalog is returned.'),
        name: z
          .string()
          .min(1)
          .optional()
          .describe('Filter array sections by exact name (e.g. "string", "belongsTo", "cascade"). Only valid together with one of: section=defineModelOptions, fieldTypes, constraints, relationTypes, referentialActions, checkOperations, dialectSupport. The CLI rejects it for the other sections (auditColumns, softDelete, shorthandSyntax, namingRules).'),
        kind: z
          .enum(['standalone', 'value'])
          .optional()
          .describe('Filter constraints by kind. Only valid with section=constraints.'),
      },
      annotations: {
        title: 'Get dbschema-kit Catalog',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, section, name, kind }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: @restforgejs/platform must be installed before this CLI command can run.
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
Requested section: ${section ?? 'all'}
Requested name filter: ${name ?? 'none'}
Requested kind filter: ${kind ?? 'none'}

For the assistant:
- The dbschema-kit catalog can only be retrieved once the RESTForge package is installed locally.
- Suggest installing the package first, then retry getting the catalog.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. CLI defaults remain in
      // effect when the user does not specify them. per §3.5
      const cliArgs = ['restforge', 'catalog', 'dbschema'];
      if (section !== undefined) cliArgs.push(`--section=${section}`);
      if (name !== undefined) cliArgs.push(`--name=${name}`);
      if (kind !== undefined) cliArgs.push(`--kind=${kind}`);

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 15_000,
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // CLI failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to retrieve the dbschema-kit catalog.

Project path: ${projectCwd}
Section filter: ${section ?? 'all'}
Name filter: ${name ?? 'none'}
Kind filter: ${kind ?? 'none'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the schema catalog could not be retrieved.
- A common cause is an older RESTForge version that does not yet expose this command. If the CLI output mentions an unknown command, suggest upgrading the package as a likely fix.
- Another common cause is an invalid filter combination (e.g. kind without section=constraints). The CLI surfaces the rule in its error message.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Validate JSON output. Parse failure is a real error per §3.4 (CLI succeeded but produced invalid output).
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to parse dbschema-kit catalog JSON.

Project path: ${projectCwd}
Reason: ${msg}

--- Raw stdout ---
${result.stdout}
--- end Raw stdout ---

For the assistant:
- The CLI returned output that is not valid JSON.
- Summarise this to the user in plain language; do not paste the raw stdout unless they explicitly ask.
- Suggest checking that the installed package version is compatible. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Defensive labeled facts: tolerate shape changes upstream.
      const root = (parsed ?? {}) as Record<string, unknown>;
      const summary = (root.summary ?? {}) as Record<string, unknown>;
      const totalFieldTypes =
        typeof summary.totalFieldTypes === 'number' ? summary.totalFieldTypes : 'unknown';
      const totalConstraints =
        typeof summary.totalConstraints === 'number' ? summary.totalConstraints : 'unknown';
      const totalRelationTypes =
        typeof summary.totalRelationTypes === 'number' ? summary.totalRelationTypes : 'unknown';
      const totalReferentialActions =
        typeof summary.totalReferentialActions === 'number'
          ? summary.totalReferentialActions
          : 'unknown';
      const totalCheckOperations =
        typeof summary.totalCheckOperations === 'number' ? summary.totalCheckOperations : 'unknown';
      const totalAuditColumns =
        typeof summary.totalAuditColumns === 'number' ? summary.totalAuditColumns : 'unknown';
      const totalDialects =
        typeof summary.totalDialects === 'number' ? summary.totalDialects : 'unknown';
      const sourceLabel = typeof root.source === 'string' ? root.source : 'dbschema-catalog';

      const prettyJson = JSON.stringify(parsed, null, 2);

      // Success: one-line summary + labeled facts + fenced JSON output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `dbschema-kit catalog retrieved successfully.

Project path: ${projectCwd}
Source: restforge (${sourceLabel}) — single source of truth for the installed runtime version
Section filter: ${section ?? 'all'}
Name filter: ${name ?? 'none'}
Kind filter: ${kind ?? 'none'}
totalFieldTypes: ${totalFieldTypes}
totalConstraints: ${totalConstraints}
totalRelationTypes: ${totalRelationTypes}
totalReferentialActions: ${totalReferentialActions}
totalCheckOperations: ${totalCheckOperations}
totalAuditColumns: ${totalAuditColumns}
totalDialects: ${totalDialects}

--- dbschema-kit Catalog (JSON) ---
${prettyJson}
--- end dbschema-kit Catalog (JSON) ---

For the assistant:
- Confirm to the user that the catalog is available. Summarise in plain language: how many field types, constraints, relation types, referential actions, check operations, and dialects are listed.
- Do not paste the full JSON unless the user explicitly asks. If the user only asked to "see the catalog", offer to drill into a specific section (field types, constraints, relations, shorthand syntax, naming rules) instead of dumping everything.
- Use this catalog as ground truth when the user is:
  * Asking "how is a schema file structured?" or "what does defineModel accept?"
  * Authoring a schema file manually (via the Write/Edit tools)
  * Asking about a specific construct (a field type, a constraint, a relation, a referential action, a check operation)
  * Asking about shorthand syntax like \`string:36 pk\` or \`decimal:15,2 default:0\`
  * Asking which dialects are supported and what differs between them
- The catalog is dialect-agnostic (it describes the API). Dialect-specific differences (column type rendering, identifier quoting, FK syntax) are applied at DDL generation time, not at schema authoring time.
- Match the API exactly. Do not invent flags, options, or behaviors that are not present in the catalog. If something the user wants is not in the catalog, say so honestly rather than fabricating.
- After grounding from the catalog, the natural next step depends on user intent:
  * Author a new file -> the schema-init action.
  * Validate existing files -> the schema-validate action.
  * Apply schema to DB -> dry-run first, then migrate.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
