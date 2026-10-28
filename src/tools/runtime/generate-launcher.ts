import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

/**
 * Ambil daftar file dan proses dari output `launcher create`. Nama file dan
 * proses ditentukan CLI dari isi project, sehingga MCP tidak menyimpan daftar
 * kedua. Bentuk output ada di generators/cli/launcher/create.js platform.
 */
function parseLauncherOutput(stdout: string): { files: string[]; processes: { name: string; url: string }[] } {
  const files: string[] = [];
  const processes: { name: string; url: string }[] = [];
  let section: 'none' | 'files' | 'processes' = 'none';
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('Launcher created')) {
      section = 'files';
      continue;
    }
    if (line.startsWith('Processes:')) {
      section = 'processes';
      continue;
    }
    const indented = /^ {2}(\S.*)$/.exec(line);
    if (!indented) {
      if (line.trim() !== '') section = 'none';
      continue;
    }
    if (section === 'files') {
      files.push(indented[1].trim());
    } else if (section === 'processes') {
      const [name, url] = indented[1].trim().split(/\s+/);
      processes.push({ name, url: url ?? '' });
    }
  }
  return { files, processes };
}

export function registerRuntimeGenerateLauncher(server: McpServer): void {
  server.registerTool(
    'runtime_generate_launcher',
    {
      title: 'Generate RESTForge Launcher Script',
      description: `Write one launcher in the project root that starts and stops every app process (auth-service when present, backend, frontend when present), by running npx restforge launcher create. This tool does NOT run anything: the user runs the launcher, so the processes outlive the AI session.

USE WHEN:
- The user asks to run, stop, or restart the server ("jalankan server", "start RESTForge")
- After the project and config are settled and 'runtime_check_launcher_exists' found no conflict, or the user confirmed overwrite
- After the port or config file changed (call with force)

DO NOT USE FOR:
- Starting or stopping processes -> the user runs the launcher
- A Kafka consumer -> 'runtime_generate_consumer_launcher'
- A separate auth-service launcher -> the same launcher already runs it

NOTES:
- Files: launch-terminal.bat/.sh for runner=terminal; launch-pm2.bat/.sh plus ecosystem.config.js for runner=pm2. Ports come from SERVER_PORT in the config files.
- Actions: launch-terminal start|stop|restart|status|logs (same for launch-pm2). Without an action the launcher starts.
- runner=terminal on Linux supports only Ubuntu 22.04 or later (tmux); pick pm2 for other distros.
- PM2 must be installed globally by the user; do not install it.
- Tell the user the assistant does not run the launcher, then give the file and the start and stop commands.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder root (must contain node_modules/@restforgejs/platform). Output goes here.'),
        project: z
          .string()
          .min(1)
          .describe('Backend project name registered in .restforge/projects.json. Passed as --project=<name>.'),
        runner: z
          .enum(['terminal', 'pm2'])
          .default('terminal')
          .describe('terminal opens one console window (Windows) or tmux window (Ubuntu 22.04+) per process; pm2 runs them under PM2 via ecosystem.config.js.'),
        os: z
          .enum(['windows', 'linux', 'both'])
          .optional()
          .describe('Target OS: windows writes .bat, linux writes .sh, both writes both. When omitted, the CLI uses the OS it runs on.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Backend env file in config/ (e.g. db-connection.env). When omitted, the CLI uses the default config from .restforge/defaults.json.'),
        frontendPort: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .optional()
          .describe('Frontend port, used only when frontend/apps/<project>/ exists. CLI default 8000.'),
        force: z
          .boolean()
          .default(false)
          .describe('Overwrite existing launcher files. Without it, the CLI refuses and names the existing files.'),
      },
      annotations: {
        title: 'Generate Launcher Script',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      },
    },
    async ({ cwd, project, runner, os, config, frontendPort, force }) => {
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
- The launcher is written by the RESTForge CLI, so the package must be installed first.
- Suggest installing the package, then retry. Match the user's language. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'launcher', 'create', `--project=${project}`, `--runner=${runner}`];
      if (os) args.push(`--os=${os}`);
      if (config) args.push(`--config=${config}`);
      if (frontendPort !== undefined) args.push(`--frontend-port=${frontendPort}`);
      if (force) args.push('--force');

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 60_000, stdin: 'ignore' });

      if (!result.success) {
        const exists = /already exists/i.test(`${result.stdout}\n${result.stderr}`);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the launcher.

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
- ${
                exists
                  ? 'Launcher files already exist. Ask the user whether to overwrite them, then call again with force: true.'
                  : 'Explain the CLI error in plain words: an unregistered project, no config given while no default config is set, a missing config file, or an empty SERVER_PORT are the usual causes.'
              }
- Match the user's language. Do not mention internal tool names.`,
            },
          ],
          isError: !exists,
        };
      }

      const { files, processes } = parseLauncherOutput(result.stdout);
      const launchers = files.filter((f) => f.startsWith('launch-'));
      const envelope = {
        cwd: projectCwd,
        project,
        runner,
        os: os ?? 'current',
        files: files.map((f) => join(projectCwd, f)),
        processes,
      };
      const usage = launchers
        .map((f) => (f.endsWith('.sh') ? `./${f}` : f))
        .map((f) => `${f} start | ${f} stop`)
        .join('; ');

      return {
        content: [
          {
            type: 'text',
            text: `Launcher created for project '${project}' (runner: ${runner}).

--- Generation Result (JSON) ---
${JSON.stringify(envelope, null, 2)}
--- end Generation Result (JSON) ---

For the assistant:
- Tell the user the launcher is in the project root and the assistant does not run it. Start and stop: ${usage || 'see the CLI output'}. Other actions: restart, status, logs.
- List the processes and their URLs.${
              runner === 'pm2'
                ? '\n- Warn the user that PM2 must be installed globally (npm install -g pm2) before running the launcher.'
                : ''
            }
- Match the user's language. Do not mention internal tool names.`,
          },
        ],
        isError: false,
      };
    }
  );
}
