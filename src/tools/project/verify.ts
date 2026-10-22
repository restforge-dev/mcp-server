import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerProjectVerify(server: McpServer): void {
  server.registerTool(
    'project_verify',
    {
      title: 'Verify Project Consistency',
      description: `Check a whole RESTForge project, by running npx restforge project verify --json. Checks tenant isolation in SDF, RDF, UDF, processor SQL, and dashboard SQL (TEN), definition files (VAL), and changes since the last successful verification (INT).

USE WHEN:
- After 'project_tenant' activate, or after adding a table, RDF, or processor to a multi-tenant project
- Before deploying, or in CI: "cek project sebelum deploy", "apakah data tenant bisa bocor?"
- The user asks whether the whole project is still consistent

DO NOT USE FOR:
- Only SDF files -> 'codegen_dbschema_validate'; only RDF against the database -> 'codegen_validate_payload'
- Turning multi-tenant mode on or off -> 'project_tenant'
- UDF only -> 'designer_validate_payload'

NOTES:
- Read-only except .restforge/verify-lock.json, written only when there is no error, and its .gitignore entry.
- Without 'config' only files are read; with 'config' the SDF and RDF are also compared with the database (VAL004).
- Errors give exit 1; warnings are reported only, unless strict=true.
- SQL warnings (TEN030-TEN033) are heuristic. A query meant to cross tenants needs '// @restforge-tenant-ignore: <reason>' on the line before it.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the RESTForge project folder (must contain node_modules/@restforgejs/platform)'),
        project: z
          .string()
          .min(1)
          .describe('Project name to verify (passed as --project). REQUIRED.'),
        config: z
          .string()
          .min(1)
          .optional()
          .describe('Database config file. When given, the SDF and RDF are also compared with the database. When omitted, no database connection is opened.'),
        schemaPath: z
          .string()
          .min(1)
          .optional()
          .describe('SDF folder. When omitted, the CLI uses ./schema.'),
        payloadPath: z
          .string()
          .min(1)
          .optional()
          .describe('RDF folder. When omitted, the CLI uses ./payload.'),
        strict: z
          .boolean()
          .optional()
          .describe('Count warnings as errors. Default false.'),
      },
      annotations: {
        title: 'Verify Project Consistency',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, config, schemaPath, payloadPath, strict }) => {
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
- The user needs to install the RESTForge package before the project can be verified. Suggest installing it first, then retry. Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'project', 'verify', `--project=${project}`, '--json'];
      if (config) args.push(`--config=${config}`);
      if (schemaPath) args.push(`--schema-path=${schemaPath}`);
      if (payloadPath) args.push(`--payload-path=${payloadPath}`);
      if (strict === true) args.push('--strict');

      const result = await execProcess('npx', args, {
        cwd: projectCwd,
        timeout: config ? 120_000 : 60_000,
        env: { NODE_ENV: 'production' },
        stripFinalNewline: true,
      });

      // Exit 1 dengan JSON yang valid adalah hasil verifikasi, bukan kegagalan tool.
      let report: { summary?: { errors: number; warnings: number }; exitCode?: number } | null = null;
      try {
        report = JSON.parse(result.stdout);
      } catch {
        report = null;
      }

      if (!report || !report.summary) {
        return {
          content: [
            {
              type: 'text',
              text: `Project verification could not run.

Project path: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the verification did not run; summarise the likely cause from the CLI output (e.g. missing --project, config file not found, database not reachable, older RESTForge version without project verify).
- Do not paste raw output unless asked. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      const passed = report.exitCode === 0;
      return {
        content: [
          {
            type: 'text',
            text: `Project verification ${passed ? 'passed' : 'found problems'} (${report.summary.errors} error(s), ${report.summary.warnings} warning(s)).

Project path: ${projectCwd}
Project: ${project}
Database check: ${config ? `yes (config: ${config})` : 'no (files only)'}
Command: ${result.command}

--- JSON report ---
${result.stdout}
--- end JSON report ---

For the assistant:
- This is a verification result, not a tool failure. Group the findings by file and explain each in plain language: code, level, and the suggested fix from the message.
- Errors block the lock file; warnings from TEN030-TEN033 are heuristic, so ask the user whether a flagged query is meant to cross tenants before suggesting the ignore annotation.
- When the user's request covers fixing, apply fixes through definition files and generators, then verify again. Do not edit generated files in src/modules or src/models by hand.
- Do not paste the raw JSON unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
