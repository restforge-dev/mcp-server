import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerSetupInstallPackage(server: McpServer): void {
  server.registerTool(
    'setup_install_package',
    {
      title: 'Install @restforgejs/platform Package',
      description: `Install the @restforgejs/platform package locally into the project's node_modules, by running npm install @restforgejs/platform@<version>. Default version is 'latest'; 'beta' or an exact version also work.

USE WHEN:
- The project folder exists but @restforgejs/platform is not installed yet (granular setup: after 'setup_create_folder', before 'setup_init_config')
- Updating @restforgejs/platform to a tag or version ("upgrade @restforgejs/platform", "ganti versi restforge")
- The user asks to install RESTForge into a project ("install restforge", "pasang package restforge")

DO NOT USE FOR:
- Creating a project folder -> 'setup_create_folder'
- Generating the config skeleton -> 'setup_init_config'
- Filling in credentials -> 'setup_write_env'
- Validating the configuration -> 'setup_validate_config'
- Installing other project dependencies, e.g. after 'auth_service_init' -> run npm install in the project folder with the shell

NOTES:
- The usual way to start a new project is npx create-restforge-app <name>, which creates the folder, installs the package locally, and bundles the designer in one step. This tool is the step-by-step alternative.
- Global installation is not supported.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must exist before this tool runs)'),
        version: z
          .string()
          .default('latest')
          .describe('npm version or tag: "latest" (default), "beta" for a pre-release, or a specific version (e.g. "1.2.3")'),
      },
      annotations: {
        title: 'Install @restforgejs/platform',
        readOnlyHint: false,
        idempotentHint: true,
      },
    },
    async ({ cwd, version }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: the project folder must exist.
      // Treated as a non-error precondition per the authoring guide §3.4.
      try {
        await access(projectCwd);
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the project folder does not exist yet.

Project path: ${projectCwd}

For the assistant:
- The user is trying to install the RESTForge package into a folder that has not been created yet.
- Suggest creating the project folder first, then retry the installation.
- When explaining to the user, say something like "the project folder isn't there yet — should I create it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      const result = await execProcess(
        'npm',
        ['install', `@restforgejs/platform@${version}`],
        { cwd: projectCwd, timeout: 180_000 }
      );

      // CLI failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to install the RESTForge package.

Project path: ${projectCwd}
Requested version: ${version}
Command: ${result.command}
Exit code: ${result.exitCode}

--- npm output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end npm output ---

For the assistant:
- Tell the user that the installation did not complete successfully.
- Summarise the likely cause from the npm output in plain language (network, registry, version not found, peer dependency); do not paste the raw stdout/stderr unless the user explicitly asks.
- Offer to retry once the underlying issue is resolved. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Success: one-line summary + labeled facts + fenced raw output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `RESTForge package installed successfully.

Project path: ${projectCwd}
Installed version: @restforgejs/platform@${version}
Install location: node_modules/@restforgejs/platform

--- npm output ---
${result.stdout}
--- end npm output ---

For the assistant:
- Confirm to the user that the RESTForge package is installed in this project.
- Suggest the next step in plain words: generating the initial configuration skeleton (config and payload templates) so the project can be configured.
- Keep the reply concise. Do not paste the raw npm output unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
