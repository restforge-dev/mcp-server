import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerProjectSdkGenerate(server: McpServer): void {
  server.registerTool(
    'project_sdk_generate',
    {
      title: 'Generate Project JavaScript SDK',
      description: `Generate the JavaScript SDK source for one RESTForge project — a thin client layer over the
generated REST API so a frontend can call client.<resource>.<verb>(payload) instead of
hand-writing fetch/$.ajax boilerplate. Wraps npx restforge project sdk --generate.

USE WHEN:
- The user wants a JavaScript/TypeScript client for an already generated backend project
- The user asks things like "generate SDK", "buatkan SDK untuk project", "bikin client SDK",
  "generate JS client", "SDK untuk frontend"
- The endpoint list or the auth status of the project changed and the SDK must be regenerated
  (in that case pass force=true)

DO NOT USE FOR:
- Generating the backend endpoint module itself -> use 'codegen_create_endpoint' first;
  the SDK is derived from what that command registered
- Generating a frontend application -> use 'designer_generate'
- Installing backend auth -> use 'project_auth' (run it BEFORE generating the SDK if the
  project needs auth, see below)

This tool runs: npx restforge project sdk --generate --project=<project> [optional flags],
in the given cwd. The --generate flag is always passed (the CLI requires it as the trigger;
without it the command exits with code 2). Optional flags (sdkPath, baseUrl, force) are
forwarded only when supplied.

What this command does:
1. Reads metadata/<project>.json and keeps only endpoints of type "module"; the primary key of
   each resource comes from payload/<slug>.json. If a registered endpoint has no payload file,
   the whole generation is aborted before anything is written.
2. Writes buildable SDK SOURCE into <sdkPath> (default: <cwd>/sdk): package.json,
   tsup.config.js, deploy.mjs, sdk-client.js (with the base URL baked in), README.md and
   src/ (core/, resources/ — one file per resource — and index.js with createClient()).
3. Detects the backend auth extension (src/modules/<project>/rfx_auth.js). When present, the
   SDK also gets client.auth (login/register/refresh/logout/getMe) plus core/auth-client.js
   and core/storage.js, and attaches the bearer token to every resource call automatically.

It only WRITES SOURCE — it does not run npm install or a build. Building and deploying stay
with the user: cd <sdkPath> && npm install && npm run build && npm run deploy.

Defaults:
- sdkPath: <project root>/sdk (relative paths are resolved against cwd)
- baseUrl: derived from the project's default config (SERVER_ADDRESS + SERVER_PORT +
  /api/<project>, with 0.0.0.0 or empty mapped to 127.0.0.1). With no config found, it falls
  back to http://127.0.0.1:3000/api/<project>.

Overwrite behaviour (force):
- The command guards on a single marker file, <sdkPath>/src/index.js. If that file exists and
  force is not set, the CLI stops with exit code 1 and the message "An SDK already exists at
  <dir> (found src/index.js). Use --force to overwrite." Nothing is written in that case.
- With force=true the SDK files are rewritten IN PLACE, with NO archive backup (unlike
  'codegen_create_endpoint', which archives). Local edits inside the SDK folder are lost.
  Resource files of endpoints that no longer exist are NOT deleted, so stale resource files
  can survive a forced regeneration; mention that when the resource list shrank.

Preconditions:
- The project folder must have @restforgejs/platform installed in node_modules. This tool
  pre-checks that; if the package is missing, the response surfaces a non-error precondition.
- The project must already be generated (metadata/<project>.json must exist). This tool does
  NOT pre-check that; the CLI error surfaces the cause and lists the paths it looked in.

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user.
- Summarise the output folder, the base URL, whether auth was included, and the resources
  covered, then state the build/deploy steps the user has to run themselves.
- If the CLI reports that an SDK already exists, present force as an explicit choice and
  mention that existing files in that folder are overwritten without a backup.
- When a precondition is not met, frame it as a question or next-step suggestion.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the RESTForge project folder (must contain node_modules/@restforgejs/platform)'),
        project: z
          .string()
          .min(1)
          .describe('Name of the existing project to generate the SDK for (also becomes the SDK package name). REQUIRED.'),
        sdkPath: z
          .string()
          .optional()
          .describe('Output folder for the SDK source, absolute or relative to cwd. Default: <project root>/sdk'),
        baseUrl: z
          .string()
          .optional()
          .describe('API base URL baked into sdk-client.js (e.g. https://api.example.com/api/myapp). Default: derived from the project config, falling back to http://127.0.0.1:3000/api/<project>'),
        force: z
          .boolean()
          .optional()
          .describe('Overwrite an existing SDK source folder. Without it the CLI refuses when <sdkPath>/src/index.js exists. No backup is made. Default: false'),
      },
      annotations: {
        title: 'Generate Project JavaScript SDK',
        readOnlyHint: false,   // writes the SDK source tree
        destructiveHint: true, // force=true overwrites existing SDK files in place, without an archive backup
        idempotentHint: false, // a second run without force fails; with force it rewrites files and can leave stale resource files behind
      },
    },
    async ({ cwd, project, sdkPath, baseUrl, force }) => {
      const projectCwd = resolve(cwd);
      try {
        await access(join(projectCwd, 'node_modules', '@restforgejs', 'platform'));
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the RESTForge package is not installed in this project.

Project path: ${projectCwd}
Project: ${project}
Expected location: node_modules/@restforgejs/platform

For the assistant:
- The user needs to install the RESTForge package before an SDK can be generated. Suggest installing it first, then retry. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'project', 'sdk', '--generate', `--project=${project}`];
      if (sdkPath) args.push(`--sdk-path=${sdkPath}`);
      if (baseUrl) args.push(`--base-url=${baseUrl}`);
      if (force === true) args.push('--force');

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 60_000 });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to generate the project SDK.

Project path: ${projectCwd}
Project: ${project}
Output folder: ${sdkPath ?? '<project root>/sdk (default)'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the SDK was not generated; summarise the likely cause from the CLI output
  (e.g. the project has no metadata yet, a registered endpoint has no payload file, or an SDK
  already exists and force was not set). Nothing was written when generation aborted.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Project SDK source generated.

Project path: ${projectCwd}
Project: ${project}
Output folder: ${sdkPath ?? '<project root>/sdk (default)'}
Overwrite requested: ${force === true ? 'yes (--force)' : 'no'}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Summarise the output folder, the base URL that was baked in, whether auth was included, and
  the resources covered. Then state that building and deploying are the user's own steps:
  cd into the SDK folder, npm install, npm run build, npm run deploy.
  Do not paste raw output unless the user asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
