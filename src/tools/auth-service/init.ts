import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CWD_DESCRIPTION, runAuthService } from './shared.js';

export function registerAuthServiceInit(server: McpServer): void {
  server.registerTool(
    'auth_service_init',
    {
      title: 'Initialize Auth Service',
      description: `Scaffold the RBAC auth-service (roles, permissions, users, OAuth, invitations) in a project folder and create its auth env file, by running npx restforge auth-service init. PostgreSQL only.

USE WHEN:
- The user needs roles, permissions, or user management for an application and no auth-service exists yet in this project
- The user asks "buat auth service", "siapkan RBAC", "setup role dan permission"

DO NOT USE FOR:
- Simple login without roles -> 'project_auth'
- Creating the auth tables or the super admin -> 'auth_service_bootstrap'
- Registering an application in an existing auth-service -> 'auth_service_link'

Writes the auth-service files, config/<config> (DB_* and LICENSE copied from the application env file, random JWT secret or RS256 keypair), and records runtime dependencies.
With force=true existing auth-service files are overwritten; the CLI first archives the old files, and an existing JWT key is preserved. Never repeat the JWT secret to the user.`,
      inputSchema: {
        cwd: z.string().min(1).describe(CWD_DESCRIPTION),
        appConfig: z
          .string()
          .optional()
          .describe('Application env file, source of DB_* and LICENSE values. Default: db-connection.env'),
        config: z
          .string()
          .optional()
          .describe('auth-service env file to create in the config/ folder. Default: auth.env'),
        port: z
          .number()
          .int()
          .optional()
          .describe('SERVER_PORT of the auth service. Default: 3100'),
        jwtAlgorithm: z
          .enum(['HS256', 'RS256'])
          .optional()
          .describe('JWT algorithm. RS256 creates a keypair in config/keys/. Default: HS256'),
        force: z
          .boolean()
          .optional()
          .describe('Overwrite existing auth-service files (old files are archived first). Default: false'),
      },
      annotations: {
        title: 'Initialize Auth Service',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, appConfig, config, port, jwtAlgorithm, force }) => {
      const args: string[] = [];
      if (appConfig) args.push(`--app-config=${appConfig}`);
      if (config) args.push(`--config=${config}`);
      if (port !== undefined) args.push(`--port=${port}`);
      if (jwtAlgorithm) args.push(`--jwt-algorithm=${jwtAlgorithm}`);
      if (force === true) args.push('--force');
      return runAuthService({
        cwd,
        verb: 'init',
        args,
        action: 'initialize auth-service',
        successNote:
          'Summarise which files were written or skipped and the auth env file location. Never repeat the JWT secret.',
        failureNote:
          'Tell the user auth-service was not initialized; summarise the likely cause (e.g. non-PostgreSQL dialect, app env file missing).',
      });
    }
  );
}
