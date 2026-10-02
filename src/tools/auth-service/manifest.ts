import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CWD_DESCRIPTION, runAuthService } from './shared.js';

export function registerAuthServiceManifest(server: McpServer): void {
  server.registerTool(
    'auth_service_manifest',
    {
      title: 'Generate Permission Manifest',
      description: `Write the permission manifest of an application project (resources and actions derived from its endpoints), by running npx restforge auth-service manifest. Writes one JSON file; the database is not touched.

USE WHEN:
- Permissions of an application must be registered in the auth-service and the manifest file does not exist or is outdated
- The user asks "buat manifest permission"

DO NOT USE FOR:
- Writing the manifest into the auth database -> 'auth_service_provision'
- Linking the application to the auth-service -> 'auth_service_link'

Overwrites the output file when it exists.`,
      inputSchema: {
        cwd: z.string().min(1).describe(CWD_DESCRIPTION),
        project: z.string().min(1).describe('Application project name. REQUIRED.'),
        output: z
          .string()
          .optional()
          .describe('Manifest file location. Default: config/auth-manifest.json'),
      },
      annotations: {
        title: 'Generate Permission Manifest',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, output }) => {
      const args = [`--project=${project}`];
      if (output) args.push(`--output=${output}`);
      return runAuthService({
        cwd,
        verb: 'manifest',
        args,
        action: 'generate permission manifest',
        successNote: 'Summarise where the manifest was written and how many resources and permissions it holds.',
        failureNote:
          'Tell the user the manifest was not generated; summarise the likely cause (e.g. project not found, no endpoints yet).',
      });
    }
  );
}
