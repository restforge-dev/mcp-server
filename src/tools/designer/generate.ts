import { z } from 'zod';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerDesignerGenerate(server: McpServer): void {
  server.registerTool(
    'designer_generate',
    {
      title: 'Generate Designer Frontend',
      description: `Generate frontend code from a UDF payload, by running npx restforge-designer generate. On an existing app it merges the new output into the files on disk and keeps user customizations.

DESTRUCTIVE only with overwrite=true: every file is recreated and customizations in all files are discarded (old files archived). Confirm with the user first; a normal re-generate never needs it.

USE WHEN:
- The user asks to generate or build the frontend application from a UDF ("generate aplikasi frontend dari UDF")
- Generating a single page/form (scope=form with the page id)
- Bringing UDF changes into an existing app

DO NOT USE FOR:
- Listing the files that would be generated without writing -> 'designer_preview_files'
- Checking the UDF structure -> 'designer_validate_payload'
- Initialising a project from a plugin -> 'designer_init_project'
- Creating a custom plugin -> 'designer_scaffold_plugin'
- No UDF yet but a backend RDF exists -> 'codegen_migrate_payload' first

NOTES:
- Point 'payload' at the aggregator <appCode>.json. Recommended order: validate, preview, generate.
- Without overwrite, files are merged three-way against the snapshot of the last generate in <output parent>/.meta/<output folder>/. A file whose edits clash is left untouched, its conflict version goes to .meta/<app>/conflicts/<path>, and the command exits 1 after the other files are processed: show the conflicts and generate again after they are resolved.
- Modified assets (CSS, vendor bundles, images) are kept with a warning.
- With overwrite, differing files are archived first. index.html without the RESTForge-Designer:LandingGenerated marker is never replaced.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the working directory where the binary is run'),
        payload: z
          .string()
          .min(1)
          .describe('Path to the UDF payload JSON file (relative to cwd or absolute). Required.'),
        output: z
          .string()
          .min(1)
          .describe('Path to the output folder where the frontend files will be written (relative to cwd or absolute). Required.'),
        plugin: z
          .string()
          .min(1)
          .optional()
          .describe('Override the plugin id taken from the payload.'),
        overwrite: z
          .boolean()
          .optional()
          .describe('When true, recreate existing files from scratch instead of merging them (differing files are archived first). Leave unset for a normal re-generate, which keeps user customizations.'),
        scope: z
          .enum(['app', 'form'])
          .optional()
          .describe('What to generate: the whole app or a single form/page. When omitted, the binary defaults to "app".'),
        page: z
          .string()
          .min(1)
          .optional()
          .describe('The page/form id to generate, used with scope "form".'),
        skipShared: z
          .boolean()
          .optional()
          .describe('When true, skip generating the shared/common files.'),
        pluginsDir: z
          .string()
          .min(1)
          .optional()
          .describe('Override path to the plugins folder. When omitted, the binary auto-detects the plugins directory.'),
      },
      annotations: {
        title: 'Generate Designer Frontend',
        destructiveHint: false, // merges into existing files; recreates them (with archive) only when overwrite=true
        idempotentHint: false,  // each call regenerates files
      },
    },
    async ({
      cwd,
      payload,
      output,
      plugin,
      overwrite,
      scope,
      page,
      skipShared,
      pluginsDir,
    }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: `npx restforge-designer` must resolve to the binary bundled in the local @restforgejs/platform.
      // Treated as a non-error precondition per the authoring guide §3.4.
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
Payload: ${payload}
Output: ${output}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Probe command: ${probe.command}
Exit code: ${probe.exitCode}

For the assistant:
- Make sure this project was created with 'npx create-restforge-app' (or the @restforgejs/platform package is installed in the project folder) before frontend code can be generated, then try again.
- When explaining to the user, say something like "the RESTForge Designer tool couldn't run — make sure this project was created with create-restforge-app (or the RESTForge platform package is installed here), then try again". Do not mention internal tool names.
- Once it can run, retry generating the frontend code.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Always send the required flags (--payload, --output) so the binary never drops
      // into interactive prompt mode. Forward optional flags only when supplied; --scope
      // is omitted to keep the binary's "app" default. per §3.5 / D6
      const args = ['generate', `--payload=${payload}`, `--output=${output}`];
      if (plugin) args.push(`--plugin=${plugin}`);
      if (overwrite) args.push('--overwrite');
      if (scope) args.push(`--scope=${scope}`);
      if (page) args.push(`--page=${page}`);
      if (skipShared) args.push('--skip-shared');
      if (pluginsDir) args.push(`--plugins-dir=${pluginsDir}`);

      const result = await execProcess('npx', ['restforge-designer', ...args], {
        cwd: projectCwd,
        timeout: 120_000,
      });

      // Issue #118: exit 1 with a conflict list means every file was processed and only
      // the listed files were left untouched for the user to resolve — not a failure.
      if (result.exitCode === 1 && result.stdout.includes('Conflicts (file kept as-is):')) {
        return {
          content: [
            {
              type: 'text',
              text: `Frontend code generated with merge conflicts.

Working directory: ${projectCwd}
Payload: ${payload}
Output: ${output}
Scope: ${scope ?? 'app (default)'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---

For the assistant:
- All other files were generated or merged. The files listed under "Conflicts" were left exactly as they were, because the user's edits overlap the new generator output.
- For each conflicting file, the version with conflict markers (<<<<<<< current / ======= / >>>>>>> generated) is in the path shown after "->". Explain this to the user and offer to resolve it: apply the intended result to the file in the app folder, then run generate again (without overwrite) to confirm it finishes cleanly.
- Do not suggest overwrite as the default fix: it discards the user's customizations in every file (they are archived, not merged).
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
            },
          ],
          isError: false,
        };
      }

      // D9: write tool. A non-zero exit (incl. -1 crash/timeout) means generation did not
      // complete cleanly — files may be missing or partial, so the model needs to recover
      // -> isError: true.
      if (result.exitCode !== 0) {
        const stderrBlock = result.stderr
          ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
          : '';
        return {
          content: [
            {
              type: 'text',
              text: `Generating the frontend code did not complete.

Working directory: ${projectCwd}
Payload: ${payload}
Output: ${output}
Scope: ${scope ?? 'app (default)'}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- The generation did not finish successfully, so the output files may be missing or partial. Read the CLI output above and explain the most likely cause to the user in plain language. Common causes:
  * The UDF payload is invalid — suggest validating the payload first to pinpoint the structural errors, then retry.
  * The payload relies on 'extends' / 'include' references — soft note: if the same payload passes validation but generation fails with an appConfig/plugin error (e.g. the plugin or app config "not found"), the payload may use 'extends' / 'include' that generate does not appear to merge the way validation does. As a possible workaround, suggest a self-contained payload (inline appConfig and pages) or an already-merged file. This is a tentative hint, not a guaranteed rule — do not state it as certain or tie it to a specific version.
  * The payload file path is wrong / the file was not found — suggest checking the path.
  * The plugin id in the payload (or the plugins directory) could not be resolved — suggest listing the available plugins.
  * Exit code -1 — the command crashed or timed out; offer to retry.
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
            },
          ],
          isError: true, // per §3.4 / D9 — write did not complete
        };
      }

      // D9: success — exit 0. Labeled facts + fenced raw output per §3.5.
      const stderrBlock = result.stderr
        ? `\n--- stderr ---\n${result.stderr}\n--- end stderr ---\n`
        : '';
      return {
        content: [
          {
            type: 'text',
            text: `Frontend code generated successfully.

Working directory: ${projectCwd}
Payload: ${payload}
Output: ${output}
Scope: ${scope ?? 'app (default)'}
Plugins dir: ${pluginsDir ?? 'auto-detect'}
Command: ${result.command}
Exit code: ${result.exitCode}

--- stdout ---
${result.stdout}
--- end stdout ---
${stderrBlock}
For the assistant:
- Confirm to the user that the frontend code was generated. Mention the output location and the scope (whole app, or a single page/form) in plain language.
- Summarise what was produced from the CLI output (how many files, what kind) rather than pasting it. Each file has a status: written, merged (user edits kept, new output applied), unchanged, kept, or skipped.
- If there are warnings about kept files (modified assets, or files without a snapshot), tell the user the new version is in the .meta conflicts folder shown in the warning.
- Suggest a sensible next step, e.g. running or inspecting the generated frontend.
- Do not paste the raw CLI output unless the user explicitly asks. Do not mention internal tool names. Match the user's language.`,
          },
        ],
      };
    }
  );
}
