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

Run link right after bootstrap, before the first endpoint exists. Once AUTH_APP_CODE is in the application env, payload generate adds authGuard to new RDF files and endpoint create adds the resource to config/auth-manifest.json, so new tables need no further auth-service step except provision. When link updates RDF files of existing endpoints, run endpoint create again for those endpoints. An authGuard with enabled false is kept disabled.`,
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
          'Summarise what was changed in the application. When the project has no endpoint yet, say that new tables get authGuard automatically from payload generate and endpoint create. When RDF files of existing endpoints were updated, remind that endpoint create must be run again for them.',
        failureNote:
          'Tell the user the link did not complete; summarise the likely cause (e.g. project not found, env file missing, invalid app code).',
      });
    }
  );
}
