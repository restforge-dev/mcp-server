import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerRbacCreate(server: McpServer): void {
  server.registerTool(
    'designer_rbac_create',
    {
      title: 'Create RBAC Editor Pages',
      description: `Create the RBAC editor pages (users, roles, role permissions) for an auth-service application and add the Administration group to the UDF navigation, by running npx restforge-designer rbac --create. Requires the vanilla-js-auth plugin.

USE WHEN:
- A frontend project uses an auth-service and the user wants pages to manage users, roles, and role permissions
- The user asks "buat halaman RBAC", "editor role dan permission", "halaman kelola user"

DO NOT USE FOR:
- Login and signup pages only -> 'designer_auth_create' / 'designer_auth_attach'
- The auth-service backend -> 'auth_service_init'
- Generating the other application pages -> 'designer_generate'

With overwrite=true existing RBAC pages are overwritten; the CLI first archives the previous files.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        project: z
          .string()
          .min(1)
          .describe('Project name: frontend app folder (<frontendPath>/<project>) and UDF file (<payloadPath>/<project>.json). REQUIRED.'),
        frontendPath: z
          .string()
          .optional()
          .describe('Frontend apps root folder. Default: frontend/apps'),
        payloadPath: z
          .string()
          .optional()
          .describe('UDF folder. Default: frontend/payload'),
        overwrite: z
          .boolean()
          .optional()
          .describe('Overwrite existing RBAC pages (previous files are archived). Default: false'),
      },
      annotations: {
        title: 'Create RBAC Editor Pages',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, frontendPath, payloadPath, overwrite }) => {
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
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder), then try again. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['rbac', '--create', `--project=${project}`];
      if (frontendPath) args.push(`--frontend-path=${frontendPath}`);
      if (payloadPath) args.push(`--payload-path=${payloadPath}`);
      if (overwrite === true) args.push('--overwrite');

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';

      if (result.exitCode !== 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create RBAC editor pages.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Tell the user the RBAC pages were not created; summarise the likely cause (e.g. UDF file or app folder not found, vanilla-js-auth plugin missing, pages already exist and overwrite was not set).
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
            text: `RBAC editor pages created.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---
${stderrBlock}
For the assistant:
- Summarise which pages were written and that the Administration group was added to the navigation.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
