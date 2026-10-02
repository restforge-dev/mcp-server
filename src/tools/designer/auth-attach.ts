import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerAuthAttach(server: McpServer): void {
  server.registerTool(
    'designer_auth_attach',
    {
      title: 'Retrofit Frontend Auth Scaffold',
      description: `Retrofit the full auth scaffold onto a frontend project whose pages are ALREADY generated,
without touching the page files and without breaking customisations. This is the "turn auth on
afterwards" path for a running application.

USE WHEN:
- The frontend project already has generated pages and auth has to be switched on afterwards
- 'designer_generate' warned that the auth artifacts are missing
- The project payload enables the auth block on an auth-capable plugin ('vanilla-js-auth' or
  'vanilla-js-custom') but the auth files were never rendered
- The user asks things like "pasang auth di app yang sudah jadi", "retrofit auth", "attach auth",
  "aktifkan auth belakangan", "lengkapi kerangka auth"

DO NOT USE FOR:
- Adding a standalone rfx_auth login/signup overlay to any app -> use 'designer_auth_create'
- Removing/uninstalling embedded auth -> use 'designer_auth_remove'
- Backend auth installation -> use 'project_auth'
- Generating or re-generating frontend pages -> use 'designer_generate'
- An auth-service app ('vanilla-js-auth' with the auth block from payload migrate): the plugin
  already sends the token, so the auth-service flow ends at 'designer_generate' (after
  'designer_rbac_create') without this tool

CHOOSING BETWEEN 'designer_auth_create' AND THIS TOOL:
- 'designer_auth_create' (--create) installs the standalone embedded overlay: it renders
  login.html, signup.html and js/rfx_auth.js and injects the guard. Reach for it when the app
  simply needs a login/signup UI and there is no auth-capable plugin in play.
- 'designer_auth_attach' (--attach) completes the auth scaffold of an already generated project.
  Reach for it when the pages already exist, when the plugin is 'vanilla-js-auth' or
  'vanilla-js-custom', or when the generator reported missing auth artifacts.
- The two modes are mutually exclusive per invocation; the CLI accepts exactly one of
  --create / --attach / --remove.

This tool wraps: npx restforge-designer auth --attach --project=<project> [optional flags],
run in the given cwd.

What this command does — two layers, depending on the project state:
1. window.Auth scaffold (always): installs js/rfx_auth.js, injects
   <script src="js/rfx_auth.js"> into the existing pages (except the login page), and writes the
   embeddedAuth marker to payload/app-config.json. Generated pages call this contract to add the
   Authorization header to every API request.
2. Plugin login artifacts (only when applicable): when the project UDF payload contains an auth
   block and its plugin is 'vanilla-js-auth' or 'vanilla-js-custom', it also renders js/auth.js,
   login.html and js/login.js in the plugin flavour, and injects the appCode/authBaseUrl block
   into js/config.js idempotently (an existing config file is not overwritten, only extended
   with a marked block). In this mode the rfx_auth login.html/signup.html are NOT written — the
   plugin login is used instead, and the rfx_auth storage key is aligned with the plugin login so
   both sides read the same session.

Page files are never touched: the application pages and their customisations stay intact.

Idempotent: safe to re-run. Existing files are skipped unless overwrite is set (an archive backup
is created first); script-tag injection and the config block are never duplicated.

Defaults:
- frontendPath: ./frontend/apps (target app dir = <frontendPath>/<project>)
- apiBaseUrl: resolved from payload/app-config.json; fallback http://127.0.0.1:3000/api/<project>

Preconditions:
- RESTForge Designer is invoked via 'npx restforge-designer' (the binary is bundled with the
  @restforgejs/platform package). This tool pre-checks that by running
  'npx restforge-designer --version'; if it cannot run, the response surfaces a non-error
  precondition.

Note: Google Sign-In and @restforgejs/auth (auth+RBAC backend) are out of scope for this command.
Server-side protection is configured separately through the backend payload authGuard block.

NOTES:
- Summarise what was retrofitted: which files were written, which pages got the auth guard, and
  whether the plugin login artifacts were rendered as well.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        project: z
          .string()
          .min(1)
          .describe('Frontend project name. Target app directory = <frontendPath>/<project>. REQUIRED.'),
        frontendPath: z
          .string()
          .optional()
          .describe('Root folder for frontend apps. Default: ./frontend/apps'),
        apiBaseUrl: z
          .string()
          .optional()
          .describe('API base URL (e.g. http://localhost:3032/api). If omitted, resolved from payload/app-config.json; fallback: http://127.0.0.1:3000/api/<project>'),
        overwrite: z
          .boolean()
          .optional()
          .describe('Overwrite existing auth files (archive backup is created). Default: false'),
      },
      annotations: {
        title: 'Retrofit Frontend Auth Scaffold',
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, frontendPath, apiBaseUrl, overwrite }) => {
      const projectCwd = resolve(cwd);

      const probe = await execProcess('npx', ['restforge-designer', '--version'], {
        cwd: projectCwd,
        timeout: 10_000,
      });
      if (!probe.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the RESTForge Designer command-line tool could not be run via npx (the @restforgejs/platform package may not be installed in this folder).

Working directory: ${projectCwd}
Project: ${project}
Probe command: ${probe.command}
Exit code: ${probe.exitCode}

For the assistant:
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before the auth scaffold can be retrofitted, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['auth', '--attach', `--project=${project}`];
      if (frontendPath) args.push(`--frontend-path=${frontendPath}`);
      if (apiBaseUrl) args.push(`--api-base-url=${apiBaseUrl}`);
      if (overwrite) args.push('--overwrite');

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 30_000,
      });

      if (result.exitCode !== 0) {
        const stderrBlock = result.stderr
          ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
          : '';
        return {
          content: [
            {
              type: 'text',
              text: `Failed to retrofit the auth scaffold.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Tell the user the auth scaffold was not retrofitted; summarise the likely cause from the CLI
  output (e.g. project directory not found, files already exist and overwrite was not set).
  Do not paste raw output unless asked. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Auth scaffold retrofitted.

Working directory: ${projectCwd}
Project: ${project}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---
${stderrBlock}
For the assistant:
- Summarise what was retrofitted: auth files written, pages with the guard injected, marker
  status, and whether the plugin login artifacts were rendered as well. Point out that the
  existing pages were left untouched.
  Do not paste raw output unless asked. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
