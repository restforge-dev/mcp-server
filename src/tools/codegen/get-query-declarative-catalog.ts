import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenGetQueryDeclarativeCatalog(server: McpServer): void {
  server.registerTool(
    'codegen_get_query_declarative_catalog',
    {
      title: 'Get Query Declarative Catalog',
      description: `Get the authoritative JSON catalog of the RDF query declarative spec (5 query properties, 7 endpoint resolution rules, \`file:\` reference convention with database-specific placeholders) used by \`datatablesQuery\`, \`viewQuery\`, \`viewName\`, \`exportQuery\`, and \`masterDetail.detailConfig.detailQuery\`.

USE WHEN:
- Before adding or editing a query property in payload/<name>.json, or writing a custom \`file:query/*.sql\` reference
- The user asks how endpoints resolve queries ("query apa yang dipakai untuk /datatables", "beda viewQuery dan viewName")
- The user asks about placeholders per database (PostgreSQL \`$1\`, MySQL \`?\`, Oracle \`:1\`) or the \`detailQuery\` of a master-detail read

DO NOT USE FOR:
- Validating payload files -> 'codegen_validate_payload'
- Generating or syncing a payload -> 'codegen_generate_payload' / 'codegen_sync_payload' (the base \`datatablesQuery\` is already emitted as a \`file:\` reference)
- Adding JOIN columns from a referenced table -> 'codegen_sync_payload' with expandFk=true
- Field validation rules -> 'codegen_get_field_validation_catalog'
- Auto SQL conversion, subquery wrapping, the full masterDetail structure, or decision guides -> not in catalog scope; use the documentationUrl in the response

This tool runs: npx restforge catalog query-declarative in the given cwd. The catalog is sourced from restforge (single source of truth), so it matches the installed runtime version.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
      },
      annotations: {
        title: 'Get Query Declarative Catalog',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd }) => {
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

For the assistant:
- The query declarative catalog can only be retrieved once the RESTForge package is installed locally.
- Suggest installing the package first, then retry getting the catalog.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Run subprocess with NODE_ENV=production to suppress legacy banner output
      // (mirrors the pattern used by setup_get_config_schema and get_field_validation_catalog).
      const result = await execProcess(
        'npx',
        ['restforge', 'catalog', 'query-declarative'],
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
              text: `Failed to retrieve the query declarative catalog.

Project path: ${projectCwd}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the query declarative catalog could not be retrieved.
- A common cause is an older RESTForge version that does not yet expose this command. If the CLI output mentions an unknown command, suggest upgrading the package as a likely fix.
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
              text: `Failed to parse query declarative catalog JSON.

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

      // Extract summary counts for labeled facts. Use defensive access — if the catalog shape
      // changes upstream, we still produce a sensible response rather than crash.
      const root = (parsed ?? {}) as Record<string, unknown>;
      const summary = (root.summary ?? {}) as Record<string, unknown>;
      const totalQueryProperties =
        typeof summary.totalQueryProperties === 'number' ? summary.totalQueryProperties : 'unknown';
      const totalEndpoints =
        typeof summary.totalEndpoints === 'number' ? summary.totalEndpoints : 'unknown';
      const totalDatabasePlaceholders =
        typeof summary.totalDatabasePlaceholders === 'number' ? summary.totalDatabasePlaceholders : 'unknown';
      const totalFileReferenceCapableProperties =
        typeof summary.totalFileReferenceCapableProperties === 'number'
          ? summary.totalFileReferenceCapableProperties
          : 'unknown';
      const sourceLabel = typeof root.source === 'string' ? root.source : 'query-declarative-catalog';

      // Re-stringify for consistent pretty formatting (independent of CLI --pretty flag).
      const prettyJson = JSON.stringify(parsed, null, 2);

      // Success: one-line summary + labeled facts + fenced JSON output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Query declarative catalog retrieved successfully.

Project path: ${projectCwd}
Source: restforge (${sourceLabel}) — single source of truth for the installed runtime version
totalQueryProperties: ${totalQueryProperties}
totalEndpoints: ${totalEndpoints}
totalDatabasePlaceholders: ${totalDatabasePlaceholders}
totalFileReferenceCapableProperties: ${totalFileReferenceCapableProperties}

--- Query Declarative Catalog (JSON) ---
${prettyJson}
--- end Query Declarative Catalog (JSON) ---

For the assistant:
- Confirm to the user that the catalog is available. Summarise in plain language: how many query properties, endpoints, and database placeholders are included.
- Do not paste the full JSON block unless the user explicitly asks for it. If the user only asked to "see the catalog", offer to drill into a specific property or endpoint instead of dumping everything.
- When the user is generating or editing query-related properties in a payload (\`datatablesQuery\`, \`viewQuery\`, \`viewName\`, \`exportQuery\`, \`masterDetail.detailConfig.detailQuery\`), use this catalog as ground truth to:
  * Validate property names spelling (e.g. reject typos like \`viewQueryName\`, \`dataTablesQuery\`).
  * Validate \`supportsFileReference\` when the user uses a \`file:\` prefix. \`viewName\` does NOT support \`file:\` prefix because it holds a database VIEW name, not SQL content. Only the four properties listed in \`fileReferenceConvention.applicableProperties\` accept \`file:\`.
  * Validate endpoint resolution priority when the user is unsure which query a given endpoint uses (e.g. \`/lookup\` does NOT use \`viewQuery\` — only \`viewName\` or \`tableName\`).
  * Validate database placeholders when the user uses file mode. There is no auto-conversion in file mode: PostgreSQL \`$1\`, MySQL \`?\`, Oracle \`:1\` must be native to the target database.
- Filter notes for catalog consumers (avoid common pitfalls):
  * \`queryProperties[].name\` is the last segment of the property path. For nested properties such as \`detailQuery\`, use the \`nestedPath\` field for the full path (\`masterDetail.detailConfig.detailQuery\`). The four top-level properties have \`nestedPath: null\`.
  * \`endpointResolution[]\` has two entries for \`/read-composite\`: \`"/read-composite (header)"\` and \`"/read-composite (detail)"\`. Pick the one matching the user's question context.
  * \`fileReferenceConvention.applicableProperties\` lists the four properties that accept the \`file:\` prefix. \`viewName\` is intentionally excluded.
  * \`fileReferenceConvention.placeholderConversionRules\` distinguishes inline mode (auto-converts \`$1\` -> \`?\` / \`:1\` for backward compatibility) from file mode (no auto-conversion — placeholders must be native to the target database).
  * Each property has a \`requires\` array listing prerequisites that must be met for the property to be active — \`exportQuery\` requires \`action.export = true\`, \`detailQuery\` requires \`masterDetail.enabled = true\` AND \`action.readComposite = true\`.
- Knowledge boundary — the catalog does NOT cover the following; refer the user to \`documentationUrl\` (in the response JSON) instead of fabricating from training data:
  * Auto SQL conversion behavior (PostgreSQL syntax adapted to MySQL / Oracle).
  * Auto subquery wrapping for JOIN / CTE queries.
  * \`\${tableName}\` placeholder substitution inside query strings.
  * Interaction with \`fieldName\` whitelisting (JOIN columns absent from \`fieldName\` get dropped).
  * Concrete use case examples (when to pick \`viewName\` vs \`viewQuery\` vs \`tableName\`).
- Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
