import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Nama file mengikuti renderLauncherFiles di generators/lib/launcher/launcher-writer.js
// platform. CLI belum punya output yang menyebut nama file tanpa menulisnya.
function getLauncherFiles(runner: 'terminal' | 'pm2', os: 'windows' | 'linux' | 'both'): string[] {
  const exts = os === 'both' ? ['bat', 'sh'] : [os === 'windows' ? 'bat' : 'sh'];
  const files = exts.map((ext) => `launch-${runner}.${ext}`);
  if (runner === 'pm2') {
    files.push('ecosystem.config.js');
  }
  return files;
}

export function registerRuntimeCheckLauncherExists(server: McpServer): void {
  server.registerTool(
    'runtime_check_launcher_exists',
    {
      title: 'Check Launcher File Existence',
      description: `Check whether the launcher files that 'runtime_generate_launcher' would write already exist in the project root. Read-only — does not create or overwrite anything.

USE WHEN:
- Before invoking 'runtime_generate_launcher' — to detect potential overwrites and ask the user for confirmation
- The user wants to know which files would be created without committing
- The user is debugging an existing setup and wants to confirm what files exist

DO NOT USE FOR:
- Generating launcher files -> use 'runtime_generate_launcher'
- Reading the content of an existing launcher -> use generic Read tools
- Checking if the server is currently running -> use 'runtime_check_status'

The list of files depends on runner + os:
- terminal: launch-terminal.bat (windows), launch-terminal.sh (linux)
- pm2:      launch-pm2.bat or launch-pm2.sh, plus ecosystem.config.js
- os=both checks the .bat and the .sh file.

NOTES:
- When at least one file already exists, ask the user whether to overwrite (then call generate with force=true).`,
      inputSchema: {
        cwd: z.string().min(1).describe('Absolute path of the project folder root'),
        runner: z.enum(['terminal', 'pm2']).default('terminal').describe('Runner passed to generate'),
        os: z.enum(['windows', 'linux', 'both']).describe('Target OS passed to generate'),
      },
      annotations: {
        title: 'Check Launcher Files',
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ cwd, runner, os }) => {
      const projectCwd = resolve(cwd);
      const files = getLauncherFiles(runner, os);
      const checked = await Promise.all(
        files.map(async (f) => {
          const path = join(projectCwd, f);
          let exists = false;
          try {
            await access(path);
            exists = true;
          } catch {
            exists = false;
          }
          return { path, exists };
        })
      );
      const anyExists = checked.some((c) => c.exists);

      const envelope = {
        cwd: projectCwd,
        runner,
        os,
        files: checked,
        any_exists: anyExists,
      };
      const prettyJson = JSON.stringify(envelope, null, 2);

      const summary = anyExists
        ? 'One or more launcher files already exist in the project root.'
        : 'No conflicting launcher files. Safe to generate.';

      return {
        content: [
          {
            type: 'text',
            text: `${summary}

Project path: ${projectCwd}
Runner: ${runner}
OS: ${os}

--- Existence Check (JSON) ---
${prettyJson}
--- end Existence Check (JSON) ---

For the assistant:
- ${
              anyExists
                ? 'Some files would be overwritten. Ask the user whether to overwrite (then call generate with force: true).'
                : 'No files would be overwritten. The user can proceed to generate.'
            }
- Pass the same runner and os to generate.
- Match the user's language.`,
          },
        ],
        isError: false,
      };
    }
  );
}
