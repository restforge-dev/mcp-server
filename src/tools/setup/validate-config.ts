import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerSetupValidateConfig(server: McpServer): void {
  server.registerTool(
    'setup_validate_config',
    {
      title: 'Validate RESTForge Config',
      description: `Validate the RESTForge license and the database, Redis, and Kafka connections from a config file, by running npx restforge validate. Read-only unless autoCreateDb is set.

USE WHEN:
- The config was just written or updated, to verify the credentials work
- Before codegen or runtime work that takes 'config' (once per session)
- The user asks to test the connection or license ("tes koneksi", "cek license", "apakah config sudah benar")
- Diagnosing configuration problems

DO NOT USE FOR:
- Writing the config -> 'setup_write_env'; changing single keys -> 'setup_update_env'
- Payload files vs the database -> 'codegen_validate_payload'
- License details on this machine -> 'license_info'

NOTES:
- When the user refers to a recent change ("cek apakah license barunya valid"), read the config with 'setup_read_env' first.
- autoCreateDb (PostgreSQL/MySQL) creates a missing database, a write on the database server: ask the user first. The DB user needs CREATE DATABASE. After creation the CLI asks for a re-run, so validate again. It has no effect on SQLite or Oracle.
- The output may contain license fragments, hosts, or user names. Never echo license keys, passwords, or connection URIs; report the status only.`,
      inputSchema: {
        cwd: z.string().min(1).describe('Absolute path of the project folder'),
        configFile: z
          .string()
          .default('db-connection.env')
          .describe('Config file name in the config/ folder. Default: db-connection.env'),
        autoCreateDb: z
          .boolean()
          .optional()
          .describe('Default false (CLI default). When true, the CLI creates the target database if it does not exist yet (postgres/mysql only, requires the CREATE DATABASE privilege). This writes to the database server, so confirm with the user first. Ignored for sqlite and oracle. After a creation the CLI asks for a re-run, so validation must be repeated.'),
      },
      annotations: {
        title: 'Validate Config',
        readOnlyHint: true,   // read-only in the default call; autoCreateDb=true is the opt-in write path
        idempotentHint: true,
      },
    },
    async ({ cwd, configFile, autoCreateDb }) => {
      const projectCwd = resolve(cwd);
      const configPath = join(projectCwd, 'config', configFile);

      // Precondition check: the config file must exist before it can be validated.
      // Treated as a non-error precondition per the authoring guide §3.4.
      try {
        await access(configPath);
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the configuration file does not exist yet.

Project path: ${projectCwd}
Expected file: ${configPath}

For the assistant:
- The user is trying to validate a configuration that has not been created and filled in yet.
- Suggest generating the initial RESTForge configuration first, then filling in the license and database credentials, and finally retrying the validation.
- When explaining to the user, say something like "there's no configuration to validate yet — should I set up the initial config first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // The runtime parser matches '--auto-create-db' as a bare token (no '=value' form),
      // and the flag is only appended when explicitly requested, so the default call
      // produces exactly the same CLI invocation as before.
      const cliArgs = ['restforge', 'validate', `--config=${configFile}`];
      if (autoCreateDb === true) cliArgs.push('--auto-create-db');

      const result = await execProcess('npx', cliArgs, { cwd: projectCwd, timeout: 30_000 });

      // Validation failure: real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Configuration validation did not pass.

Project path: ${projectCwd}
Config file: ${configPath}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout || '(empty)'}

stderr:
${result.stderr || '(empty)'}
--- end CLI output ---

For the assistant:
- Tell the user that the validation reported one or more problems.
- Summarise the likely failing component in plain language (license, database, redis, kafka) based on the CLI output; do not paste the raw stdout/stderr unless the user explicitly asks.
- Do not echo license keys, passwords, or full connection URIs from the output into chat.
- Suggest reviewing or updating the relevant credentials and retrying. Do not mention internal tool names.`,
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
            text: `Configuration validation passed.

Project path: ${projectCwd}
Config file: ${configPath}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
${result.stdout || '(empty)'}
--- end CLI output ---

For the assistant:
- Confirm to the user that the license and external connections checked out.
- Summarise in plain language which components were checked and passed (license, database, optional redis/kafka), based on what appears in the CLI output.
- Read the CLI output before claiming everything passed: when the database did not exist, the CLI either reports that it created the database and asks for a re-run (autoCreateDb=true), or skips the creation and prints a hint about the auto-create flag (default). In the first case say the database was created and validate again; in the second case ask the user whether the database should be created.
- Do not paste the raw CLI output unless the user explicitly asks. Do not echo license keys or credentials. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
