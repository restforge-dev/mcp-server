import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CWD_DESCRIPTION, runAuthService } from './shared.js';

export function registerAuthServiceLink(server: McpServer): void {
  server.registerTool(
    'auth_service_link',
    {
      title: 'Link Application to Auth Service',
      description: `Connect an application project to the auth-service (shared JWT key, authGuard on its endpoints), by running npx restforge auth-service link.

USE WHEN:
- An application project must accept tokens issued by the auth-service
- The user asks "hubungkan aplikasi ke auth service", "link app ke auth"

DO NOT USE FOR:
- Creating the auth-service itself -> 'auth_service_init'
- Registering permissions in the auth database -> 'auth_service_manifest' then 'auth_service_provision'

The application endpoints must already exist: endpoint create has to run before link, and again after link so that authGuard takes effect on the generated endpoints.`,
      inputSchema: {
        cwd: z.string().min(1).describe(CWD_DESCRIPTION),
        project: z.string().min(1).describe('Application project name. REQUIRED.'),
        appCode: z
          .string()
          .min(1)
          .describe('App code in auth-service. Uppercase letters, digits, and underscore. REQUIRED.'),
        config: z.string().optional().describe('Application env file. Default: db-connection.env'),
        authConfig: z
          .string()
          .optional()
          .describe('auth-service env file, source of JWT_SECRET or the public key. Default: auth.env'),
      },
      annotations: {
        title: 'Link Application to Auth Service',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, appCode, config, authConfig }) => {
      const args = [`--project=${project}`, `--app-code=${appCode}`];
      if (config) args.push(`--config=${config}`);
      if (authConfig) args.push(`--auth-config=${authConfig}`);
      return runAuthService({
        cwd,
        verb: 'link',
        args,
        action: 'link application to auth-service',
        successNote:
          'Summarise what was changed in the application. Remind that endpoint create must be run again so authGuard applies to the endpoints.',
        failureNote:
          'Tell the user the link did not complete; summarise the likely cause (e.g. project not found, env file missing, invalid app code).',
      });
    }
  );
}
