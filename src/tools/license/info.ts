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
      description: `Show the RESTForge license activation stored on this machine — license key, e-mail, type,
machine id, last validation timestamp and expiry — by running npx restforge license info.
Read-only: it reads the local activation state and does not change it.

USE WHEN:
- A license error has to be diagnosed, e.g. 'setup_validate_config' failed on the license step
  and the cause has to be narrowed down (not activated, wrong machine, expired)
- The user asks things like "cek lisensi", "lisensi saya apa", "license info", "status license",
  "sampai kapan lisensi berlaku", "license key yang aktif apa"
- Before telling the user to re-activate, to confirm what is currently activated

DO NOT USE FOR:
- Validating the database, redis or kafka connections -> use 'setup_validate_config'
- Writing or changing the license key in the config file -> use 'setup_update_env'
- Releasing the activation on this machine -> NOT available through this server, see below

This tool runs: npx restforge license info in the given cwd. The verb takes two tokens and no
flags — it is handled by the runtime parser, not by the generator CLI, so extra flags would be
ignored rather than rejected.

Output: the command only prints a human-readable text block; there is no structured/JSON mode.
This tool passes that text through unchanged, so read it directly rather than expecting fields.

NOT WRAPPED ON PURPOSE — 'license deactivate':
Releasing an activation is a mutation whose effect spans machines (it frees the seat held by
this machine on the license server) and it cannot be undone from here. It is intentionally not
exposed as a tool. When the user wants to deactivate, explain what it does and give them the
command to run themselves in their terminal:
  npx restforge license deactivate
Do not run it through the Bash tool on the user's behalf.

Preconditions:
- The project folder must have @restforgejs/platform installed in node_modules. This tool
  pre-checks that; if the package is missing, the response surfaces a non-error precondition.

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user.
- Summarise the state that answers the user's question (activated or not, type, expiry). Treat
  the license key, e-mail and machine id as sensitive: repeat them only when the user asks for
  them specifically.
- When a precondition is not met, frame it as a question or next-step suggestion.`,
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
