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
      description: `Generate the JavaScript SDK source for a RESTForge project, a client layer over the generated REST API (client.<resource>.<verb>(payload)), by running npx restforge project sdk --generate.

DESTRUCTIVE only with force=true: the SDK folder is rewritten in place with NO archive backup, so local edits there are lost. Without force an existing SDK (src/index.js present) stops the run and nothing is written. Present force as an explicit choice to the user.

USE WHEN:
- The user wants a JavaScript client for an already generated backend project ("generate SDK", "buatkan client SDK")
- The endpoint list or the auth status of the project changed and the SDK must be regenerated (force=true, after the user agrees)

DO NOT USE FOR:
- Generating the endpoint module itself -> 'codegen_create_endpoint' first; the SDK is derived from it
- Generating a frontend application -> 'designer_generate'
- Installing backend auth -> 'project_auth', run BEFORE the SDK when the project needs auth

NOTES:
- Reads metadata/<project>.json (module endpoints only) and payload/<slug>.json for primary keys; a registered endpoint without a payload file aborts the run before writing.
- Writes source only into sdkPath (default <cwd>/sdk). Building and deploying stay with the user: cd <sdkPath> && npm install && npm run build && npm run deploy.
- When the backend auth extension exists, the SDK also gets client.auth and attaches the bearer token automatically.
- baseUrl defaults to SERVER_ADDRESS + SERVER_PORT + /api/<project> from the default config, fallback http://127.0.0.1:3000/api/<project>.
- A forced run does not delete resource files of removed endpoints; mention that when the resource list shrank.
- Summarise the output folder, base URL, auth inclusion, and resources, then the build steps.`,
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
