import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerProjectTenant(server: McpServer): void {
  server.registerTool(
    'project_tenant',
    {
      title: 'Activate or Deactivate Multi-Tenant Mode',
      description: `Turn multi-tenant data separation on or off for a RESTForge project, by running npx restforge project tenant --activate|--deactivate.

DESTRUCTIVE: activate adds a tenant_id column to the business tables in the database, moves existing rows to the DEFAULT tenant, makes unique constraints per tenant, changes SDF and RDF files, and regenerates the scoped endpoints. ALWAYS call with dryRun=true first, show the user the plan, and get confirmation before the real run.

USE WHEN:
- The user wants each tenant (company, store, organization) to see only its own data, e.g. "pisahkan data per tenant", "aktifkan multi-tenant", "SaaS multi-tenant"
- Auth-service flow with public registration where each new account gets its own tenant
- The user wants to turn tenant separation off again (mode=deactivate, a soft disable: TENANT_MODE=single, the column stays)

DO NOT USE FOR:
- Installing the auth-service or public registration -> 'auth_service_init' and 'auth_service_provision'
- Backend auth for a single project -> 'project_auth'
- Changing tables by hand -> SDF files and 'codegen_dbschema_migrate'

NOTES:
- Activate writes TENANT_MODE=multi to the config; deactivate writes TENANT_MODE=single.
- The running server must be restarted by the user afterwards.
- Tables added later get tenant scope from 'codegen_dbschema_migrate' and 'codegen_generate_payload'. Run activate again only for a table already in the database without tenant_id.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the RESTForge project folder (must contain node_modules/@restforgejs/platform)'),
        project: z
          .string()
          .min(1)
          .describe('Project name whose scoped endpoints are regenerated (passed as --project). REQUIRED.'),
        mode: z
          .enum(['activate', 'deactivate'])
          .describe('activate turns multi-tenant mode on (TENANT_MODE=multi); deactivate turns it off (TENANT_MODE=single).'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Connection config file read for the database and updated with TENANT_*. When omitted, the CLI uses config/db-connection.env.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe('SDF folder to scan and update. When omitted, the CLI uses ./schema.'),
        payloadPath: z
          .string()
          .min(1)
          .optional()
          .describe('RDF payload folder whose requestScope is injected or removed. When omitted, the CLI uses ./payload.'),
        defaultTenant: z
          .string()
          .min(1)
          .optional()
          .describe('Id or code of an existing tenant that receives the existing rows on activate. When omitted, the CLI uses the tenant with code DEFAULT, creating it when needed.'),
        dryRun: z
          .boolean()
          .optional()
          .describe('Only print the plan (config, SDF, database, and endpoint changes) without writing anything. Run this first and show the plan to the user.'),
        force: z
          .boolean()
          .optional()
          .describe('Run even when the config is already in the requested mode, rewriting existing SDF and requestScope. Default false.'),
      },
      annotations: {
        title: 'Activate or Deactivate Multi-Tenant Mode',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      },
    },
    async ({ cwd, project, mode, config, schemaPath, payloadPath, defaultTenant, dryRun, force }) => {
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
- The user needs to install the RESTForge package before tenant mode can be changed. Suggest installing it first, then retry. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'project', 'tenant', `--${mode}`, `--project=${project}`];
      if (config) args.push(`--config=${config}`);
      if (schemaPath) args.push(`--schema-path=${schemaPath}`);
      if (payloadPath) args.push(`--payload-path=${payloadPath}`);
      if (defaultTenant) args.push(`--default-tenant=${defaultTenant}`);
      if (dryRun === true) args.push('--dry-run');
      if (force === true) args.push('--force');

      // Aktivasi memigrasi database dan membuat ulang endpoint, sehingga butuh waktu lebih lama.
      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 180_000 });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to ${mode} multi-tenant mode${dryRun ? ' (dry run)' : ''}.

Project path: ${projectCwd}
Project: ${project}
Mode: ${mode}
Dry run: ${dryRun === true}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the tenant change did not complete; summarise the likely cause from the CLI output (e.g. config file missing, database not reachable, SDF or payload folder not found, migration error).
- When it failed after writing started, the CLI output shows which steps already ran; mention them so the user can check the database and files.
- Do not paste raw output unless asked. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      const nextStep = dryRun
        ? '- This was a dry run: nothing was written. Summarise the plan (config change, tables that get the tenant column, unique constraints, endpoints to regenerate) and ask the user to confirm before running again without dryRun.'
        : mode === 'activate'
          ? '- Summarise what changed: TENANT_MODE=multi, tables scoped by tenant, existing rows moved to the default tenant, endpoints regenerated. Tell the user to restart the server with their launcher.'
          : '- Summarise what changed: TENANT_MODE=single and requestScope removed from the payloads; the tenant column stays in the tables. Tell the user to restart the server with their launcher.';

      return {
        content: [
          {
            type: 'text',
            text: `Multi-tenant ${mode} ${dryRun ? 'plan (dry run)' : 'completed'}.

Project path: ${projectCwd}
Project: ${project}
Mode: ${mode}
Dry run: ${dryRun === true}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
${nextStep}
- Do not paste raw output unless the user asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
