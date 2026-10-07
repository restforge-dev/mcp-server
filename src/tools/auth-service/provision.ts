import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CWD_DESCRIPTION, runAuthService } from './shared.js';

export function registerAuthServiceProvision(server: McpServer): void {
  server.registerTool(
    'auth_service_provision',
    {
      title: 'Provision Permissions and Owner',
      description: `Write the permission manifest into the auth-service database and create the application owner user, by running npx restforge auth-service provision.

USE WHEN:
- A manifest exists and its permissions and the app owner must be created in the auth database
- The user asks "provision permission", "buat owner aplikasi"

DO NOT USE FOR:
- Generating the manifest -> 'auth_service_manifest'
- Creating the auth tables -> 'auth_service_bootstrap'

Public self-registration (register.html) is closed by default. Only allowSelfRegister=true opens it, and running provision without it closes it again, so pass it on every run that should keep registration open. Register needs SMTP configured in auth.env.

Run with dryRun=true first and show the plan to the user, then run again without dryRun after the user agrees. ownerEmail is required: ask the user for it instead of inventing one. After a new owner is created, the CLI emails the owner a sign-in notification without the password; if SMTP in auth.env is not configured it prints a warning and provisioning still completes. A generated owner password is shown in the CLI output and saved as plain text to data-storage/credential/<app-code>-owner.txt; tell the user to store it in a secure place and delete that file, and never repeat it outside that first output.`,
      inputSchema: {
        cwd: z.string().min(1).describe(CWD_DESCRIPTION),
        manifest: z.string().min(1).describe('Permission manifest file. REQUIRED.'),
        authConfig: z
          .string()
          .optional()
          .describe('auth-service env file, source of the database connection. Default: auth.env'),
        ownerUsername: z
          .string()
          .optional()
          .describe('Owner username. Default: <app-code in lowercase>-owner'),
        ownerEmail: z
          .string()
          .email()
          .describe('Owner user email. REQUIRED. Ask the user for an address the owner can receive email at; the owner gets a sign-in notification there and uses it for "Forgot password?".'),
        ownerPassword: z
          .string()
          .optional()
          .describe('Owner password. When omitted a random password is generated, shown, and saved to data-storage/credential/<app-code>-owner.txt'),
        dryRun: z
          .boolean()
          .optional()
          .describe('Show the plan without writing to the database. Default: false'),
        allowSelfRegister: z
          .boolean()
          .optional()
          .describe('Open public self-registration for this application; each registrant becomes the owner of a new tenant. Without it registration is closed. Registration also needs SMTP configured in auth.env. Default: false'),
      },
      annotations: {
        title: 'Provision Permissions and Owner',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, manifest, authConfig, ownerUsername, ownerEmail, ownerPassword, dryRun, allowSelfRegister }) => {
      const args = [`--manifest=${manifest}`];
      if (authConfig) args.push(`--auth-config=${authConfig}`);
      if (ownerUsername) args.push(`--owner-username=${ownerUsername}`);
      args.push(`--owner-email=${ownerEmail}`);
      if (ownerPassword) args.push(`--owner-password=${ownerPassword}`);
      if (allowSelfRegister === true) args.push('--allow-self-register');
      if (dryRun === true) args.push('--dry-run');
      return runAuthService({
        cwd,
        verb: 'provision',
        args,
        action: dryRun === true ? 'preview provisioning plan' : 'provision permissions and owner',
        successNote:
          'Summarise the plan or result, including whether the owner notification email was sent or the SMTP warning. Show a generated owner password once, tell the user to store it, and never repeat it later.',
        failureNote:
          'Tell the user provisioning did not complete; summarise the likely cause (e.g. manifest missing, auth tables not bootstrapped, database not reachable).',
      });
    }
  );
}
