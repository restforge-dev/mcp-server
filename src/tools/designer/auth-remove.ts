import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerAuthRemove(server: McpServer): void {
  server.registerTool(
    'designer_auth_remove',
    {
      title: 'Remove Embedded Frontend Auth',
      description: `Remove embedded auth (rfx_auth) from a frontend project, by running npx restforge-designer auth --remove --force. It deletes login.html, signup.html, and js/rfx_auth.js, strips the guard script from every page, and removes the embeddedAuth marker from payload/app-config.json.

DESTRUCTIVE: deletes the auth files and strips the guard from every page; --force skips the CLI prompt. ALWAYS confirm with the user before calling, naming the project and what will be deleted.

USE WHEN:
- The user wants to remove embedded auth ("hapus auth frontend", "uninstall rfx_auth")
- The project has auth installed by 'designer_auth_create'

DO NOT USE FOR:
- Installing embedded auth -> 'designer_auth_create'
- Removing the vanilla-js-auth plugin -> out of scope
- Backend auth removal -> out of scope

NOTES:
- Other page content and other app-config keys are untouched.
- When auth is not installed nothing happens; tell the user clearly.
- Summarise the files deleted, pages unguarded, and marker removed.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        project: z
          .string()
          .min(1)
          .describe('Frontend project name to remove auth from. REQUIRED. Confirm with the user first.'),
        frontendPath: z
          .string()
          .optional()
          .describe('Root folder for frontend apps. Default: ./frontend/apps'),
      },
      annotations: {
        title: 'Remove Embedded Frontend Auth',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: true,
      },
    },
    async ({ cwd, project, frontendPath }) => {
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
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before embedded auth can be removed, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['auth', '--remove', `--project=${project}`, '--force'];
      if (frontendPath) args.push(`--frontend-path=${frontendPath}`);

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
              text: `Failed to remove embedded auth.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Tell the user the embedded auth was not removed; summarise the likely cause from the CLI output
  (e.g. project directory not found, binary error).
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
            text: `Embedded auth removed.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---
${stderrBlock}
For the assistant:
- Summarise what was removed: files deleted, pages unguarded, marker removed.
  If auth was not installed (no-op), tell the user clearly.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
