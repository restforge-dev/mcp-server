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
      description: `Validate the RESTForge license and connections to database, redis, and kafka based on the config file.

USE WHEN:
- The db-connection.env file has been filled in (license + DB credentials)
- After credentials have been written or updated, to verify they actually work
- Before starting runtime or codegen operations
- Verifying license and access to external services before deploy
- Diagnosing configuration issues
- The user asks things like "test connection", "cek license", "validate config",
  "apakah config sudah benar", "is the database reachable", "tes koneksi",
  "verify the configuration", "cek apakah license valid"
- Before validating, consider calling 'setup_read_env' to confirm what is
  currently set — especially when the user describes the validation relative
  to a recent change (e.g. "cek apakah license barunya valid"). // per §5.3
- The user wants to validate CONFIGURATION (license, database connection, kafka, redis), not payload files

DO NOT USE FOR:
- Writing the config file -> use 'setup_write_env'
- Adjusting individual fields -> use 'setup_update_env'
- Generating module code -> use codegen_* domain tools
- Checking if payload JSON files are still in sync with the database schema -> use 'codegen_validate_payload'

Often called as the final step after 'setup_write_env' or 'setup_update_env'
has filled in or changed credentials, to confirm that they actually work. // per §5.2

This tool runs: npx restforge validate --config=<configFile> [--auto-create-db] in the given cwd.
Without 'autoCreateDb' this tool is READ-ONLY and safe to call repeatedly.

About 'autoCreateDb' (postgres/mysql only): when the target database does not exist yet, the CLI normally offers to create it. In this non-interactive context the CLI skips the creation and prints a hint that names the --auto-create-db flag. Setting autoCreateDb=true makes the CLI create the database instead, which is a WRITE operation on the database server — ask the user before enabling it. After a successful creation the CLI asks for a re-run, so validation has to be repeated to confirm the remaining components. The flag has no effect for sqlite (the file is created on first connect) or oracle (a service name, not a database), and the DB_USER needs the CREATE DATABASE privilege.

NOTES:
- The CLI output may contain license fragments, host names, or user names. Do not echo license keys, passwords, or full connection URIs into chat. Confirm validation status only.`,
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
