import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerInspectPlugin(server: McpServer): void {
  server.registerTool(
    'designer_inspect_plugin',
    {
      title: 'Inspect Designer Plugin',
      description: `Show the metadata of one RESTForge Designer plugin (declared schema, fields, components, configuration), by running npx restforge-designer plugins inspect. Read-only, no license needed.

USE WHEN:
- The user asks about one plugin ("apa isi plugin vanilla-js-auth", "schema plugin designer")
- Learning which fields and components a plugin expects before writing a UDF for it

DO NOT USE FOR:
- Listing all plugins -> 'designer_list_plugins'
- Validating a UDF -> 'designer_validate_payload'
- Previewing files -> 'designer_preview_files'
- UDF rules (field types, required appConfig fields, enums, limits) -> 'designer_get_udf_catalog'

NOTES:
- This returns the identity of one plugin, not the UDF rules. Do not infer valid field types or required fields from it; use 'designer_get_udf_catalog' for that.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        plugin: z
          .string()
          .min(1)
          .describe('The plugin id to inspect (e.g. vanilla-js-auth)'),
        pluginsDir: z
          .string()
          .min(1)
          .optional()
          .describe('Override path to the plugins folder. When omitted, the binary auto-detects the plugins directory.'),
      },
      annotations: {
        title: 'Inspect Designer Plugin',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, plugin, pluginsDir }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: `npx restforge-designer` must resolve to the binary bundled in the local @restforgejs/platform.
      // Treated as a non-error precondition per the authoring guide §3.4.
      const probe = await execProcess('npx', ['restforge-designer', '--version'], {
        cwd: projectCwd,
        timeout: 10_000,
      });
      if (!probe.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the RESTForge Designer command-line tool could not be run via npx (the @restforgejs/platform package may not be installed in this folder).

Working directory: ${projectCwd}
Plugin: ${plugin}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Probe command: ${probe.command}
Exit code: ${probe.exitCode}

For the assistant:
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before a plugin can be inspected, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.
- Once it can run, retry inspecting the plugin.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. per §3.5 / D6
      const args = ['plugins', 'inspect', `--plugin=${plugin}`];
      if (pluginsDir) args.push(`--plugins-dir=${pluginsDir}`);

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 15_000,
      });

      // D7: read-only tool. Pre-flight confirmed the binary spawns, so only an
      // unexpected crash/timeout (no real exit code -> -1) is a real error.
      if (result.exitCode === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Inspecting the Designer plugin did not complete — the command crashed or timed out.

Working directory: ${projectCwd}
Plugin: ${plugin}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}

--- stderr ---
${result.stderr}
--- end stderr ---

For the assistant:
- The Designer CLI did not finish (likely a crash or timeout), so there is no plugin metadata to report.
- Tell the user the inspection could not be completed and offer to retry. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4 — unexpected crash/timeout
        };
      }

      // D7: single response for ANY real exit code. A non-zero exit (e.g. the plugin id
      // does not exist) is an actionable negative verdict to relay, not a tool failure.
      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Inspecting the Designer plugin ran.

Working directory: ${projectCwd}
Plugin: ${plugin}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- The Designer CLI ran to completion. Read the CLI output above and classify the result:
  (a) Positive result — the output is the plugin's metadata (its schema, fields, components). Summarise it in plain language so the user understands what the plugin expects, and offer the next step (e.g. author or validate a payload for it).
  (b) Actionable negative verdict — the named plugin id does not exist, or the plugins directory override could not be resolved. These are legitimate results to RELAY to the user, not tool malfunctions. Tell the user the plugin id was not found (note: a "plugin not found" verdict often comes with a non-zero exit code, which is expected here) and suggest listing the available plugins to pick a valid id.
- A non-zero exit code here means the CLI reported a negative verdict (case b), NOT that the tool failed. Never tell the user "the tool failed" for case (b).
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
          },
        ],
      };
    }
  );
}
