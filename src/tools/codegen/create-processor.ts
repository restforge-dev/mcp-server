import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Meniru normalisasi nama payload milik CLI. `processor create` memakai
 * ArgumentValidator.validatePayloadName yang sama dengan `endpoint create`:
 * '.json' dibuang bila ada, sisanya di-lowercase, lalu '.json' ditambahkan
 * kembali. Nama ber-path ditolak validator itu, jadi dideteksi terpisah.
 */
function cliPayloadFileName(payload: string): string {
  const base = payload.endsWith('.json') ? payload.slice(0, -5) : payload;
  return `${base.toLowerCase()}.json`;
}

/** Pola nama yang diterima validator CLI setelah ekstensi dibuang. */
const CLI_PAYLOAD_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$/;

/**
 * Meniru daftar kandidat readPayloadFile di generators/cli/processor/create.js.
 * Subprocess berjalan dengan cwd = projectCwd, sehingga workingDir dan
 * process.cwd() milik CLI keduanya menunjuk ke sana; kandidat relatif __dirname
 * menunjuk ke dalam package platform dan sengaja tidak ditiru.
 */
async function resolvePayloadPath(projectCwd: string, fileName: string): Promise<string | null> {
  for (const candidate of [join(projectCwd, 'payload', fileName), join(projectCwd, fileName)]) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export function registerCodegenCreateProcessor(server: McpServer): void {
  server.registerTool(
    'codegen_create_processor',
    {
      title: 'Create Processor Module',
      description: `Generate a processor (custom business-logic handler or background job exposed as an endpoint) from a processor payload, by running npx restforge processor create. The router and metadata are always regenerated; the implementation file holds the custom logic.

USE WHEN:
- The user wants a processor, background job, or custom logic handler ("buat processor", "generate processor")
- A processor payload exists and its code should be generated
- Refreshing a processor's routing while keeping hand-written logic (run without force)

DO NOT USE FOR:
- A standard CRUD endpoint -> 'codegen_create_endpoint'
- A dashboard -> 'codegen_create_dashboard'
- A Kafka consumer -> 'codegen_create_kafka_consumer'
- A payload from a table -> 'codegen_generate_payload'

NOTES:
- Without force, an existing implementation file is skipped ("custom code preserved").
- With force, the implementation file is archived, then replaced by a fresh scaffold; custom code survives only in the archive. Warn the user before using force.
- The payload must exist at <cwd>/payload/<name>.json; .json is optional, the name is lowercased, and path forms are rejected.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the backend project folder (must contain node_modules/@restforgejs/platform)'),
        project: z.string().min(1).describe('Target project name. REQUIRED.'),
        name: z.string().min(1).describe('Processor name (also the endpoint name). REQUIRED.'),
        payload: z
          .string()
          .min(1)
          .describe("File name of the processor payload JSON, WITH or WITHOUT the '.json' extension — both forms are accepted and resolve to the same file, because the CLI strips the extension, lowercases the name, and appends '.json' again. NOT a path: 'payload/order.json' or an absolute path is rejected by the CLI validator. The file is looked up at <cwd>/payload/<name>.json, then <cwd>/<name>.json. Base name max 50 chars, letters/numbers/dash/underscore only, cannot start or end with dash or underscore. REQUIRED."),
        database: z
          .enum(['postgres', 'mysql', 'oracle', 'sqlite'])
          .optional()
          .describe('Database type. When omitted, the CLI uses its default (postgres / auto-detect).'),
        force: z
          .boolean()
          .optional()
          .describe('Archive then overwrite an existing processor implementation file. Without it, the implementation file is preserved (only routing/metadata regenerate).'),
        skipSqlValidation: z
          .boolean()
          .optional()
          .describe('Skip SQL keyword validation. When omitted, the CLI validates SQL as usual.'),
      },
      annotations: {
        title: 'Create Processor Module',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
      },
    },
    async ({ cwd, project, name, payload, database, force, skipSqlValidation }) => {
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
Requested processor: ${name}
Requested payload: ${payload}

For the assistant:
- The user needs to install the RESTForge package before a processor can be generated.
- Suggest installing the package first, then retry. When explaining, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      // Pre-flight payload: the CLI rejects path forms outright and resolves the
      // remaining name to a lowercase '<name>.json'. Mirroring that here turns a late
      // CLI failure into an actionable precondition, without ever changing the value
      // that is sent — the argument below is still passed verbatim.
      if (payload.includes('/') || payload.includes('\\') || !CLI_PAYLOAD_NAME.test(cliPayloadFileName(payload).slice(0, -5))) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: the payload name has a shape the CLI rejects.

Project path: ${projectCwd}
Payload argument: ${payload}
Accepted shape: a bare file name, optionally ending in '.json' — letters, numbers, dash, underscore only, starting with a letter or number, max 50 characters before the extension.

For the assistant:
- The processor generator does not accept a path here, only a file name. It always looks inside the project's payload/ folder (falling back to the project root).
- Retry with just the file name, e.g. 'order-processor.json' instead of 'payload/order-processor.json'.
- When explaining to the user, say something like "the payload has to be given as a file name inside the payload/ folder, not as a path". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const payloadFileName = cliPayloadFileName(payload);
      const payloadPath = await resolvePayloadPath(projectCwd, payloadFileName);
      if (payloadPath === null) {
        return {
          content: [
            {
              type: 'text',
              text: `Precondition not met: payload file not found.

Project path: ${projectCwd}
Payload argument: ${payload}
Resolved file name: ${payloadFileName}
Locations checked: ${join(projectCwd, 'payload', payloadFileName)} and ${join(projectCwd, payloadFileName)}
Requested processor: ${name}

For the assistant:
- The processor generator needs the payload file to exist before it can run.
- The CLI lowercases the payload name and appends '.json', so '${payload}' can only ever match the file '${payloadFileName}'. If a file with different capitalisation exists, rename it to match.
- When explaining to the user, say something like "the payload file '${payloadFileName}' isn't in the payload/ folder yet — do you have one to put there?". Do not mention internal tool names.`,
            },
          ],
          isError: false,
        };
      }

      const args = ['restforge', 'processor', 'create', `--project=${project}`, `--name=${name}`, `--payload=${payload}`];
      if (database) args.push(`--database=${database}`);
      if (force) args.push('--force');
      if (skipSqlValidation) args.push('--skip-sql-validation');

      const result = await execProcess('npx', args, { cwd: projectCwd, timeout: 60_000 });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the processor.

Project path: ${projectCwd}
Project: ${project}
Processor: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user the processor was not generated successfully.
- Summarise the most likely cause from the CLI output in plain language (common causes: the payload file was not found, the payload is invalid, SQL validation failed, or the target project does not exist). Do not paste raw output unless the user asks.
- Offer to retry once the issue is resolved. Do not mention internal tool names.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Processor created.

Project path: ${projectCwd}
Project: ${project}
Processor: ${name}
Payload: ${payload}
Payload file: ${payloadPath}
Force: ${force ? 'yes (old implementation archived then overwritten)' : 'no (existing implementation preserved)'}
Command: ${result.command}

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm the processor was generated. Mention the endpoint routing/metadata was (re)generated.
- If this was a re-run without force, note that any existing custom implementation was preserved. If force was used, note the old implementation was archived before being overwritten.
- Keep the reply concise. Do not paste raw CLI output unless the user explicitly asks. Do not mention internal tool names.`,
          },
        ],
      };
    }
  );
}
