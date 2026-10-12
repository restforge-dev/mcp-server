import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerLicenseInfo(server: McpServer): void {
  server.registerTool(
    'license_info',
    {
      title: 'Show License Info',
      description: `Show the RESTForge license activation on this machine (key, e-mail, type, machine id, last validation, expiry), by running npx restforge license info. Read-only; the output is plain text.

USE WHEN:
- Diagnosing a license error, e.g. 'setup_validate_config' failed on the license step (not activated, wrong machine, expired)
- The user asks about the license ("cek lisensi", "sampai kapan lisensi berlaku")
- Before telling the user to re-activate

DO NOT USE FOR:
- Database, Redis, or Kafka checks -> 'setup_validate_config'
- Changing the license key in the config -> 'setup_update_env'
- Releasing the activation -> not available as a tool

NOTES:
- 'license deactivate' frees this machine's seat on the license server and cannot be undone from here, so it is not wrapped. Explain it and give the user the command to run themselves: npx restforge license deactivate. Do not run it for the user.
- Answer the question (activated or not, type, expiry). Repeat the key, e-mail, or machine id only when the user asks for them.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
      },
      annotations: {
        title: 'Show License Info',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd }) => {
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
Expected location: node_modules/@restforgejs/platform

For the assistant:
- The user needs to install the RESTForge package before the license state can be read. Suggest installing it first, then retry. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const result = await execProcess('npx', ['restforge', 'license', 'info'], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to read the license info.

Project path: ${projectCwd}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the license state could not be read; summarise the likely cause from the output
  (e.g. no activation on this machine yet). Do not paste raw output unless asked.
  Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `License info read.

Project path: ${projectCwd}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- The block above is the raw CLI text; there is no structured form of it. Read it and answer the
  user's actual question (activated or not, license type, expiry, last check). Treat the license
  key, e-mail and machine id as sensitive and repeat them only on request.
  Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
