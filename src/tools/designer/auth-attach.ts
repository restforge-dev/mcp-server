import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerAuthAttach(server: McpServer): void {
  server.registerTool(
    'designer_auth_attach',
    {
      title: 'Retrofit Frontend Auth Scaffold',
      description: `Retrofit the full auth scaffold onto a frontend app whose pages are already generated, without touching page files, by running npx restforge-designer auth --attach. This is the path for switching auth on afterwards.

USE WHEN:
- The pages already exist and auth must be switched on afterwards ("pasang auth di app yang sudah jadi", "retrofit auth")
- 'designer_generate' warned that the auth artifacts are missing
- The UDF enables the auth block on 'vanilla-js-auth' or 'vanilla-js-custom' but the auth files were never rendered

DO NOT USE FOR:
- A standalone rfx_auth login/signup overlay -> 'designer_auth_create'
- Removing embedded auth -> 'designer_auth_remove'
- Backend auth -> 'project_auth'
- Generating pages -> 'designer_generate'
- An auth-service app ('vanilla-js-auth' with the auth block from payload migrate): the plugin already sends the token, so that flow ends at 'designer_generate' without this tool

NOTES:
- Always installs js/rfx_auth.js, injects its script tag into existing pages (not the login page), and writes the embeddedAuth marker to payload/app-config.json.
- When the UDF has an auth block on an auth-capable plugin, it also renders the plugin login (js/auth.js, login.html, js/login.js) and adds the appCode/authBaseUrl block to js/config.js; rfx_auth login.html/signup.html are not written in that case.
- Idempotent. Existing files are skipped unless overwrite is set (archived first).
- Defaults: frontendPath ./frontend/apps; apiBaseUrl from payload/app-config.json, fallback http://127.0.0.1:3000/api/<project>.
- Summarise the files written, the pages that got the guard, and whether plugin login artifacts were rendered.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        project: z
          .string()
          .min(1)
          .describe('Frontend project name. Target app directory = <frontendPath>/<project>. REQUIRED.'),
        frontendPath: z
          .string()
          .optional()
          .describe('Root folder for frontend apps. Default: ./frontend/apps'),
        apiBaseUrl: z
          .string()
          .optional()
          .describe('API base URL (e.g. http://localhost:3032/api). If omitted, resolved from payload/app-config.json; fallback: http://127.0.0.1:3000/api/<project>'),
        overwrite: z
          .boolean()
          .optional()
          .describe('Overwrite existing auth files (archive backup is created). Default: false'),
      },
      annotations: {
        title: 'Retrofit Frontend Auth Scaffold',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, frontendPath, apiBaseUrl, overwrite }) => {
      const projectCwd = resolve(cwd);

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
Project: ${project}
Probe command: ${probe.command}
Exit code: ${probe.exitCode}

For the assistant:
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before the auth scaffold can be retrofitted, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['auth', '--attach', `--project=${project}`];
      if (frontendPath) args.push(`--frontend-path=${frontendPath}`);
      if (apiBaseUrl) args.push(`--api-base-url=${apiBaseUrl}`);
      if (overwrite) args.push('--overwrite');

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      if (result.exitCode !== 0) {
        const stderrBlock = result.stderr
          ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
          : '';
        return {
          content: [
            {
              type: 'text',
              text: `Failed to retrofit the auth scaffold.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Tell the user the auth scaffold was not retrofitted; summarise the likely cause from the CLI
  output (e.g. project directory not found, files already exist and overwrite was not set).
  Do not paste raw output unless asked. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Auth scaffold retrofitted.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---
${stderrBlock}
For the assistant:
- Summarise what was retrofitted: auth files written, pages with the guard injected, marker
  status, and whether the plugin login artifacts were rendered as well. Point out that the
  existing pages were left untouched.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
