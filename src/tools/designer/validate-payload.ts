import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerValidatePayload(server: McpServer): void {
  server.registerTool(
    'designer_validate_payload',
    {
      title: 'Validate Designer Payload',
      description: `Validate a frontend UDF against the schema of the RESTForge Designer plugin it targets, by running npx restforge-designer validate. Read-only, no license needed.

USE WHEN:
- The user asks to validate a UDF or designer payload ("validasi UDF", "cek payload frontend")
- Before previewing or generating frontend code
- After 'codegen_migrate_payload' or after editing a UDF

DO NOT USE FOR:
- A backend RDF vs the database -> 'codegen_validate_payload'
- An SDF file -> 'codegen_dbschema_validate'
- Raw SQL -> 'codegen_validate_sql'
- Writing the frontend -> 'designer_generate'

NOTES:
- Point 'payload' at the aggregator <appCode>.json.
- To fix errors, look up the allowed values with 'designer_get_udf_catalog'.`,
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
        title: 'Validate Designer Payload',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, payload, pluginsDir }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: `npx restforge-designer` must resolve to the binary bundled in the local @restforgejs/platform.
      // Treated as a non-error precondition per the authoring guide §3.4. The probe
      // distinguishes "binary missing" (precondition) from "binary ran and reported
      // something" (which falls through to the real execution below).
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
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before a frontend payload can be validated, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.
- Once it can run, retry validating the payload.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Forward only the arguments the user supplied. The plugins directory is
      // auto-detected by the binary when --plugins-dir is omitted. per §3.5
      const args = ['validate', `--payload=${payload}`];
      if (pluginsDir) args.push(`--plugins-dir=${pluginsDir}`);

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      // D7: this is a read-only tool. The pre-flight already confirmed the binary
      // spawns, so an unexpected crash/timeout (no real exit code -> -1) is the only
      // real error here -> isError: true. Any genuine exit code is a verdict to relay.
      if (result.exitCode === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Designer payload validation did not complete — the command crashed or timed out.

Working directory: ${projectCwd}
Payload: ${payload}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}

--- stderr ---
${result.stderr}
--- end stderr ---

For the assistant:
- The Designer CLI did not finish (likely a crash or timeout), so there is no validation verdict to report.
- Tell the user the check could not be completed and offer to retry. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4 — unexpected crash/timeout
        };
      }

      // D7: single response for ANY real exit code (success branch no longer split on
      // result.success). A non-zero exit means the CLI reported an actionable negative
      // verdict (invalid payload, plugin/file not found), which is a legitimate result
      // to relay — NOT a tool failure. The model classifies from the fenced output.
      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Designer payload validation ran.

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
  (a) Positive result — the payload is VALID against the target plugin schema. Confirm this in plain language. The next step is 'designer_preview_files' and then 'designer_generate' on the same aggregator file. When the user's request already covers generating the frontend, continue with it instead of stopping here; otherwise offer it in one sentence.
  (b) Actionable negative verdict — the payload is INVALID (the output lists structural errors), or the payload file was not found, or the target plugin / plugins directory could not be resolved. These are legitimate results to RELAY to the user, not tool malfunctions. Summarise the concrete problems (which fields, components, or paths are wrong) and offer to re-check after the user fixes them.
- A non-zero exit code here means the CLI reported a negative verdict (case b), NOT that the tool failed. Never tell the user "the tool failed" for case (b).
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
          },
        ],
      };
    }
  );
}
