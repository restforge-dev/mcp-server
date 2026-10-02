import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CWD_DESCRIPTION, runAuthService } from './shared.js';

export function registerAuthServiceBootstrap(server: McpServer): void {
  server.registerTool(
    'auth_service_bootstrap',
    {
      title: 'Bootstrap Auth Service Database',
      description: `Create the auth-service tables in schema 'auth' and the initial super admin, by running npx restforge auth-service bootstrap. Only schema 'auth' is touched.

DESTRUCTIVE when reset=true: the tables in schema 'auth' are dropped and re-created even when they contain data. Confirm intent with the user in plain language BEFORE calling with reset=true, e.g. "Saya akan menghapus dan membuat ulang tabel auth-service beserta isinya. Lanjut?". Without reset the command stops when auth data already exists.

USE WHEN:
- auth-service was initialized and its database tables do not exist yet
- The user explicitly asks to reset the auth-service database

DO NOT USE FOR:
- Scaffolding files and env -> 'auth_service_init'
- Registering an application or its permissions -> 'auth_service_link' / 'auth_service_provision'

The super admin password and secrets are shown once in the CLI output. Tell the user to store them; never repeat them outside that first output.`,
      inputSchema: {
        cwd: z.string().min(1).describe(CWD_DESCRIPTION),
        config: z.string().optional().describe('auth-service env file. Default: auth.env'),
        reset: z
          .boolean()
          .optional()
          .describe(
            "Drop and re-create the tables in schema 'auth' even when they already contain data (destructive). Default: false"
          ),
      },
      annotations: {
        title: 'Bootstrap Auth Service Database',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      },
    },
    async ({ cwd, config, reset }) => {
      const args: string[] = [];
      if (config) args.push(`--config=${config}`);
      if (reset === true) args.push('--reset');
      return runAuthService({
        cwd,
        verb: 'bootstrap',
        args,
        action: 'bootstrap auth-service database',
        successNote:
          'Summarise what was created. Show the super admin credentials once if present, tell the user to store them, and do not repeat them later.',
        failureNote:
          'Tell the user the bootstrap did not complete; summarise the likely cause (e.g. auth data already exists and reset was not set, database not reachable).',
      });
    }
  );
}
