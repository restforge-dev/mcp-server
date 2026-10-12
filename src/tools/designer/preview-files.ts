import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerPreviewFiles(server: McpServer): void {
  server.registerTool(
    'designer_preview_files',
    {
      title: 'Preview Designer Files',
      description: `List the frontend files RESTForge Designer would generate from a UDF, by running npx restforge-designer preview. Nothing is written.

USE WHEN:
- The user asks which files would be generated, or wants a dry run ("preview output frontend designer", "tunjukkan hasil generate tanpa menulis file")
- Before 'designer_generate', to confirm the planned output

DO NOT USE FOR:
- Checking the UDF structure -> 'designer_validate_payload'
- Writing the files -> 'designer_generate'
- Listing plugins or inspecting one -> 'designer_list_plugins' / 'designer_inspect_plugin'

NOTES:
- Point 'payload' at the aggregator <appCode>.json.
- The list is the generator output only. Preview does not read the output folder, so it cannot tell which files a re-generate will merge, keep, or skip; 'designer_generate' reports that per file.
- Read-only and needs no license.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        payload: z
          .string()
          .min(1)
          .describe('Path to the UDF payload JSON file (relative to cwd or absolute)'),
        pluginsDir: z
          .string()
          .min(1)
          .optional()
          .describe('Override path to the plugins folder. When omitted, the binary auto-detects the plugins directory.'),
      },
      annotations: {
        title: 'Preview Designer Files',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, payload, pluginsDir }) => {
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
Payload: ${payload}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Probe command: ${probe.command}
Exit code: ${probe.exitCode}

For the assistant:
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before the generated files can be previewed, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.
- Once it can run, retry the preview.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. per §3.5 / D6
      const args = ['preview', `--payload=${payload}`];
      if (pluginsDir) args.push(`--plugins-dir=${pluginsDir}`);

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      // D7: read-only tool. Pre-flight confirmed the binary spawns, so only an
      // unexpected crash/timeout (no real exit code -> -1) is a real error.
      if (result.exitCode === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Designer preview did not complete — the command crashed or timed out.

Working directory: ${projectCwd}
Payload: ${payload}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}

--- stderr ---
${result.stderr}
--- end stderr ---

For the assistant:
- The Designer CLI did not finish (likely a crash or timeout), so there is no preview to report.
- Tell the user the preview could not be completed and offer to retry. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4 — unexpected crash/timeout
        };
      }

      // D7: single response for ANY real exit code. A non-zero exit is an actionable
      // negative verdict (invalid payload, plugin/file not found) to relay, not a failure.
      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Designer preview ran.

Working directory: ${projectCwd}
Payload: ${payload}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- The Designer CLI ran to completion. Read the CLI output above and classify the result:
  (a) Positive result — the output lists the files that would be generated. Summarise the planned files in plain language (how many, what kinds) and offer the next step: generate the frontend code for real.
  (b) Actionable negative verdict — the payload is invalid, the payload file was not found, or the target plugin / plugins directory could not be resolved. These are legitimate results to RELAY to the user, not tool malfunctions. Summarise the concrete problem (which path or field is wrong) and offer to retry after the user fixes it; validating the payload first can help pinpoint structural errors.
- A non-zero exit code here means the CLI reported a negative verdict (case b), NOT that the tool failed. Never tell the user "the tool failed" for case (b).
- Soft note: if preview fails with an appConfig/plugin error (e.g. the plugin or app config "not found") while the SAME payload passes validation, the payload may rely on 'extends' / 'include' references that preview does not appear to merge the way validation does. As a possible workaround, suggest pointing the preview at a self-contained payload (inline appConfig and pages) or an already-merged file. This is a tentative hint, not a guaranteed rule — do not state it as certain or tie it to a specific version.
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
          },
        ],
      };
    }
  );
}
