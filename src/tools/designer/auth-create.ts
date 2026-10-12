import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerAuthCreate(server: McpServer): void {
  server.registerTool(
    'designer_auth_create',
    {
      title: 'Install Embedded Frontend Auth',
      description: `Install embedded auth (rfx_auth) into an existing frontend project, by running npx restforge-designer auth --create. It writes login.html, signup.html, and js/rfx_auth.js, injects the guard script into existing pages, and writes the embeddedAuth marker to payload/app-config.json.

USE WHEN:
- The user wants a login/signup UI on an existing frontend ("pasang auth frontend", "tambah login ke aplikasi", "install rfx_auth")
- The frontend was generated without an auth plugin and needs auth now

DO NOT USE FOR:
- Removing embedded auth -> 'designer_auth_remove'
- Backend auth -> 'project_auth'
- Pages already generated with 'vanilla-js-auth' or 'vanilla-js-custom', or a missing-auth-artifacts warning -> 'designer_auth_attach'
- RBAC (roles, permissions) -> auth-service with the 'vanilla-js-auth' plugin, not this tool
- Generating pages -> 'designer_generate'

NOTES:
- Idempotent: existing files are skipped unless overwrite is set.
- With no pages yet, guard injection is skipped with a warning; 'designer_generate' injects it into pages created later.
- No Google Sign-In.
- Summarise the files written and the pages that got the guard.`,
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
        title: 'Install Embedded Frontend Auth',
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
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before embedded auth can be installed, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['auth', '--create', `--project=${project}`];
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
              text: `Failed to install embedded auth.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Tell the user the embedded auth was not installed; summarise the likely cause from the CLI output
  (e.g. project directory not found, files already exist and overwrite was not set).
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
            text: `Embedded auth installed.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---
${stderrBlock}
For the assistant:
- Summarise what was installed: auth files written, pages with guard injected, marker status.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
