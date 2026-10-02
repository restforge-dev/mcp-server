import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenGetDashboardCatalog(server: McpServer): void {
  server.registerTool(
    'codegen_get_dashboard_catalog',
    {
      title: 'Get Dashboard Catalog',
      description: `Get the authoritative JSON catalog of the dashboard payload spec: payload shape and discriminator, widget structure with mutex \`query\`/\`queries\`, params contract and allowed types, scalar collapse rules, \`dash-\` naming prefix, URL pattern \`POST /api/{project}/{name}/dashboard\`, file references, and \`:paramName\` placeholders.

USE WHEN:
- The user asks about dashboard payload structure, widgets, params, \`query\` vs \`queries\`, scalar collapse, the \`dash-\` prefix, or placeholders ("bagaimana struktur payload dashboard", "kapan pakai query vs queries")
- Before authoring a dashboard payload by hand, or before validating or generating one
- The user is unsure whether the use case is a dashboard or a CRUD endpoint

DO NOT USE FOR:
- Validating a dashboard payload file -> 'codegen_validate_dashboard_payload'
- Generating a dashboard module -> 'codegen_create_dashboard'
- CRUD field validation rules -> 'codegen_get_field_validation_catalog'
- CRUD query spec (\`datatablesQuery\`, \`viewQuery\`, \`exportQuery\`, \`detailQuery\`) -> 'codegen_get_query_declarative_catalog'
- Widget pattern examples, frontend integration, SQL dialect adaptation, performance notes -> not in catalog scope; use the documentationUrl in the response

This tool runs: npx restforge catalog dashboard in the given cwd. The catalog is sourced from restforge (single source of truth), so it matches the installed runtime version.

NOTES:
- Dashboard vs CRUD discriminator: a \`widgets\` array means dashboard (multi-widget aggregation, POST .../dashboard); \`tableName\` + \`fieldName\` + \`action\` means a CRUD endpoint.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
      },
      annotations: {
        title: 'Get Dashboard Catalog',
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
- The dashboard catalog can only be retrieved once the RESTForge package is installed locally.
- Suggest installing the package first, then retry getting the catalog.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Run subprocess with NODE_ENV=production to suppress legacy banner output
      // (mirrors the pattern used by setup_get_config_schema and other catalog tools).
      const result = await execProcess(
        'npx',
        ['restforge', 'catalog', 'dashboard'],
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
              text: `Failed to retrieve the dashboard catalog.

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
- Tell the user that the dashboard catalog could not be retrieved.
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
              text: `Failed to parse dashboard catalog JSON.

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
      const totalAllowedTopLevelFields =
        typeof summary.totalAllowedTopLevelFields === 'number'
          ? summary.totalAllowedTopLevelFields
          : 'unknown';
      const totalForbiddenFrontendFields =
        typeof summary.totalForbiddenFrontendFields === 'number'
          ? summary.totalForbiddenFrontendFields
          : 'unknown';
      const totalParamTypes =
        typeof summary.totalParamTypes === 'number' ? summary.totalParamTypes : 'unknown';
      const totalScalarCollapseRules =
        typeof summary.totalScalarCollapseRules === 'number'
          ? summary.totalScalarCollapseRules
          : 'unknown';
      const sourceLabel = typeof root.source === 'string' ? root.source : 'dashboard-catalog';

      // Re-stringify for consistent pretty formatting (independent of CLI --pretty flag).
      const prettyJson = JSON.stringify(parsed, null, 2);

      // Success: one-line summary + labeled facts + fenced JSON output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard catalog retrieved successfully.

Project path: ${projectCwd}
Source: restforge (${sourceLabel}) — single source of truth for the installed runtime version
totalAllowedTopLevelFields: ${totalAllowedTopLevelFields}
totalForbiddenFrontendFields: ${totalForbiddenFrontendFields}
totalParamTypes: ${totalParamTypes}
totalScalarCollapseRules: ${totalScalarCollapseRules}

--- Dashboard Catalog (JSON) ---
${prettyJson}
--- end Dashboard Catalog (JSON) ---

For the assistant:
- Confirm to the user that the catalog is available. Summarise in plain language: how many allowed top-level fields, forbidden frontend fields, param types, and scalar collapse rules are included.
- Do not paste the full JSON block unless the user explicitly asks for it. If the user only asked to "see the catalog", offer to drill into a specific aspect (widget structure, params contract, naming convention, scalar collapse rules) instead of dumping everything.
- Use this catalog as ground truth when the user is:
  * Asking "how is a dashboard payload structured?"
  * Authoring a dashboard payload manually (via the Write tool)
  * Confused between dashboard payload (\`widgets\`) and CRUD payload (\`tableName\`)
  * Asking about the \`dash-\` prefix in dashboard names
  * Asking when to use \`query\` vs \`queries\`
  * Asking about response shape (scalar collapse rules)
  * Asking about \`:paramName\` placeholders in widget SQL
- Filter notes for catalog consumers (avoid common pitfalls):
  * \`payloadShape.discriminator\` is the way to tell whether a payload is a dashboard or a CRUD endpoint. \`widgets\` present means dashboard. \`tableName\` present means CRUD. A payload with both is rejected by the validator.
  * \`widgetSpec.exclusiveQueryFields\` is a mutex rule: every widget MUST declare exactly one of \`query\` (singular, response always wraps as \`{ items: [...] }\`) OR \`queries\` (object, per-key shape determined by scalar collapse rules). Both or neither is rejected.
  * \`paramSpec.perEntryFields[0].allowedValues\` is a closed enum of four values: \`string\`, \`number\`, \`boolean\`, \`date\`. Other type strings are rejected by the validator.
  * \`scalarCollapseRules\` apply ONLY to \`widget.queries.<key>\`. For \`widget.query\` (singular) the response is ALWAYS wrapped as \`{ items: [...] }\` regardless of SQL result shape.
  * \`namingConvention.dashboardName.regex\` is \`^dash-[a-zA-Z0-9_-]+$\`. minLength is 6 because \`dash-\` is 5 characters and at least one suffix character is required.
  * \`placeholderConvention.regex\` uses a negative lookbehind \`(?<!:):\` so Postgres cast syntax \`::\` is NOT scanned as a placeholder. Every placeholder used in widget SQL must be declared in the top-level \`params\` object, otherwise the validator rejects the payload.
- Knowledge boundary — the catalog does NOT cover the following; refer the user to \`documentationUrl\` (in the response JSON) instead of fabricating from training data:
  * Common widget patterns with concrete SQL examples (Metric+Donut, Metric+Sparkline, Metric+Goal).
  * Frontend mapping examples — how the response is rendered in Metronic, AdminLTE, or other UI frameworks.
  * Separation of Concerns rationale for the forbidden frontend fields (\`widgetType\`, \`layout\`, \`title\`, \`subtitle\`, \`color\`).
  * Multi-database SQL dialect adaptation inside widget queries.
  * Performance characteristics (Promise.allSettled execution, in-memory SQL embedding, zero disk I/O at request time).
- Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
