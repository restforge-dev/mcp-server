import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenMigratePayload(server: McpServer): void {
  server.registerTool(
    'codegen_migrate_payload',
    {
      title: 'Migrate Payload (RDF backend -> UDF frontend)',
      description: `Convert an existing backend RDF payload into a frontend UDF for RESTForge Designer, by running npx restforge payload migrate. Output is a split set in the output directory (default frontend/payload/): app-config.json, pages/<pageId>.json, and the aggregator <appCode>.json. JOINed tables are discovered, so one RDF can produce several pages. This is the primary way to create a UDF: start here whenever an RDF exists; hand-author a UDF only when there is no RDF.

DESTRUCTIVE only with overwrite=true: existing pages are recreated from the RDF and their customizations are discarded (old files archived). Confirm with the user first; a normal re-run never needs it.

USE WHEN:
- The user wants a frontend UDF or designer payload and a backend RDF exists ("buat UDF dari payload backend", "migrate payload ke frontend")
- Adding another table/page to an existing frontend app (run once per RDF with the same output and project)
- Bringing RDF changes into existing pages

DO NOT USE FOR:
- Generating the frontend application from a UDF -> 'designer_generate'
- Validating an RDF against the database -> 'codegen_validate_payload'
- A table with no RDF yet -> 'codegen_generate_payload'

NOTES:
- Without overwrite, existing pages, the aggregator, and app-config.json are merged: user edits are kept and RDF changes are applied, using snapshots in <output>/.meta/pages/ (commit them, never edit them). dateFormat and dateTimeFormat always follow the backend config.
- The command stops before writing when app-config.json belongs to a different appCode.
- authAppCode + authApiUrl write the auth block (auth-service flow, plugin vanilla-js-auth); give both or neither.
- Next steps: validate the aggregator, preview, then generate. Point designer tools at <appCode>.json, not at page files.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the backend project folder (must contain node_modules/@restforgejs/platform; the RDF payload is read from here)'),
        name: z
          .string()
          .min(1)
          .describe('Backend RDF payload file name (e.g. visitors.json). Resolved relative to cwd or cwd/payload/. REQUIRED.'),
        project: z
          .string()
          .min(1)
          .describe('Project name in kebab-case, used as the path segment in apiBaseUrl (http://{host}:{port}/api/{project}). REQUIRED.'),
        output: z
          .string()
          .min(1)
          .optional()
          .describe('Output directory for the split UDF files, relative to cwd. When omitted, the CLI uses its default (frontend/payload/). A value ending in .json is reduced to its parent directory.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Database config file (.env) read for SERVER_ADDRESS/SERVER_PORT (backend host/port). When omitted, the CLI falls back to the default config.'),
        appName: z
          .string()
          .min(1)
          .optional()
          .describe('Value for appConfig.appName in the UDF output. When omitted, derived from project in Title Case (e.g. visitors-app -> "Visitors App").'),
        appCode: z
          .string()
          .min(1)
          .optional()
          .describe('Value for appConfig.appCode in the UDF output (kebab-case). Also used as the aggregator file name (<appCode>.json). When omitted, follows project.'),
        plugin: z
          .string()
          .min(1)
          .optional()
          .describe('Designer plugin ID written to appConfig.plugin. When omitted, the CLI uses its default (vanilla-js-basic).'),
        port: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .optional()
          .describe('Frontend application port written to appConfig.port. Independent of the backend port used in apiBaseUrl. When omitted, the CLI uses its default (8000).'),
        overwrite: z
          .boolean()
          .optional()
          .describe('Recreate existing page files under pages/ from scratch, discarding customization (and replace app-config.json when no aggregator exists yet). Not needed to add a new table or to bring RDF changes into an existing page, because existing pages are merged by default. The aggregator and app-config.json of an existing app are always merged, never replaced.'),
        authAppCode: z
          .string()
          .min(1)
          .optional()
          .describe('Auth app code registered in the auth-service (auth_service_link), written to auth.appCode in the aggregator. Requires authApiUrl. Without both, no auth block is written.'),
        authApiUrl: z
          .string()
          .min(1)
          .optional()
          .describe('Auth-service API endpoint written to auth.authApiUrl (e.g. http://localhost:3100/api/auth-service). Requires authAppCode.'),
        idleTimeout: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Idle minutes before auto-logout, written to auth.idleTimeoutMinutes. Only with authAppCode and authApiUrl. When omitted, the CLI uses 30.'),
      },
      annotations: {
        title: 'Migrate Payload (RDF backend -> UDF frontend)',
        readOnlyHint: false,
        idempotentHint: false, // re-running merges existing pages, or recreates them with --overwrite
        destructiveHint: false,
      },
    },
    async ({ cwd, name, project, output, config, appName, appCode, plugin, port, overwrite, authAppCode, authApiUrl, idleTimeout }) => {
      const projectCwd = resolve(cwd);

      // Same contract as the CLI (buildAuthBlock): the auth block needs both values,
      // and idleTimeout is meaningless without them. Rejected before the CLI runs.
      if (Boolean(authAppCode) !== Boolean(authApiUrl) || (idleTimeout !== undefined && !authAppCode)) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid auth parameters: authAppCode and authApiUrl must be given together, and idleTimeout only together with both.

authAppCode: ${authAppCode ?? '(not set)'}
authApiUrl: ${authApiUrl ?? '(not set)'}
idleTimeout: ${idleTimeout ?? '(not set)'}

For the assistant:
- Nothing was written. For an auth-service frontend, supply both the app code linked in the auth-service and its API URL (e.g. http://localhost:3100/api/auth-service), then retry. For a frontend without auth, omit all three.
- Do not mention internal tool names.`,
            },
          ],
          isError: false,
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
Requested RDF: ${name}
Requested project: ${project}

For the assistant:
- The user needs to install the RESTForge package before a backend payload can be migrated into a frontend payload.
- Suggest installing the package first, then retry the migration.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. CLI defaults
      // (frontend/payload/ output, vanilla-js-basic plugin, port 8000, etc.)
      // stay in effect when the user does not specify them. per §3.5
      const args = ['restforge', 'payload', 'migrate', `--name=${name}`, `--project=${project}`];
      if (output) args.push(`--output=${output}`);
      if (config) args.push(`--config=${config}`);
      if (appName) args.push(`--app-name=${appName}`);
      if (appCode) args.push(`--app-code=${appCode}`);
      if (plugin) args.push(`--plugin=${plugin}`);
      if (port !== undefined) args.push(`--port=${port}`);
      if (overwrite) args.push('--overwrite');
      if (authAppCode) args.push(`--auth-app-code=${authAppCode}`);
      if (authApiUrl) args.push(`--auth-api-url=${authApiUrl}`);
      if (idleTimeout !== undefined) args.push(`--idle-timeout=${idleTimeout}`);

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 60_000 });

      // Branch C: CLI failure — real error per §3.4. A failed or partial migration
      // needs recovery, so this is isError: true. Structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to migrate the backend payload into a frontend payload.

Project path: ${projectCwd}
RDF name: ${name}
Project: ${project}
Output: ${output ?? 'default (frontend/payload/)'}
Config: ${config ?? 'default config'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that the payload migration did not complete successfully, and that any partially written output may need cleanup.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * The named RDF payload was not found — it is resolved relative to cwd or cwd/payload/. Suggest checking the file name and location.
  * The database config could not be read (missing or incomplete SERVER_ADDRESS/SERVER_PORT), or no default config is set. Suggest pointing at a valid config file.
  * An existing page file could not be parsed — suggest fixing the JSON file, or re-running with overwrite enabled to recreate the page from scratch (customization in that page is lost).
  * app-config.json exists without its aggregator and --overwrite was not set — suggest re-running with overwrite enabled or choosing a different output directory.
  * app-config.json in the output directory belongs to a different app (appCode mismatch) — suggest a different output directory, or using the existing app's code as project/appCode to add the page to that app.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.`,
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
            text: `Payload migration completed (RDF backend -> UDF frontend).

Project path: ${projectCwd}
RDF name: ${name}
Project: ${project}
Output dir: ${output ?? 'default (frontend/payload/)'}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that the backend payload was converted into a frontend payload. Mention that the output is a split multi-file set (a shared app-config file, one file per page under pages/, and an aggregator file) written into the output directory above.
- Read the CLI output for the number of pages and the file list; mention how many pages were produced (auto-discovered JOINs can produce more than one page from a single RDF).
- The next steps are 'designer_validate_payload', 'designer_preview_files', and 'designer_generate', always on the aggregator file, not the page fragments. When the user's request already covers generating the frontend, continue with them instead of stopping here; otherwise offer them in one sentence.
- Keep the reply concise. Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
