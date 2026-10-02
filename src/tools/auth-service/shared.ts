import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execProcess } from '../../lib/exec.js';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

export const CWD_DESCRIPTION =
  'Absolute path of the RESTForge project folder (must contain node_modules/@restforgejs/platform)';

export interface AuthServiceRunOptions {
  cwd: string;
  verb: 'init' | 'bootstrap' | 'link' | 'manifest' | 'provision';
  args: string[];
  /** Short label used in the success and failure messages, e.g. "initialize auth-service". */
  action: string;
  /** Extra guidance for the assistant appended to the success response. */
  successNote: string;
  /** Extra guidance for the assistant appended to the failure response. */
  failureNote: string;
  timeout?: number;
}

/**
 * Menjalankan `npx restforge auth-service <verb> ...` di cwd project. Pola
 * mengikuti project_auth: precondition paket platform tidak dianggap error,
 * kegagalan CLI dikembalikan sebagai isError.
 */
export async function runAuthService(opts: AuthServiceRunOptions): Promise<ToolResult> {
  const projectCwd = resolve(opts.cwd);
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
- The user needs to install the RESTForge package before auth-service can be used. Suggest installing it first, then retry. Do not mention internal tool names.`,
        },
      ],
      isError: false,
    };
  }

  const result = await execProcess('npx', ['restforge', 'auth-service', opts.verb, ...opts.args], {
    cwd: projectCwd,
    timeout: opts.timeout ?? 60_000,
  });

  if (!result.success) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to ${opts.action}.

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
- ${opts.failureNote}
- Do not paste raw output unless asked. Do not mention internal tool names.`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Done: ${opts.action}.

Project path: ${projectCwd}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- ${opts.successNote}
- Do not paste raw output unless the user asks. Do not mention internal tool names.`,
      },
    ],
  };
}
