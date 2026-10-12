import { z } from 'zod';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execProcess } from '../../lib/exec.js';

export function registerCodegenDbschemaInit(server: McpServer): void {
  server.registerTool(
    'codegen_dbschema_init',
    {
      title: 'Init dbschema-kit Skeleton File',
      description: `Create a DRAFT schema file holding the generic dummy template (dummy_id primary key, one sample column per field type, audit columns), by running npx restforge schema init. It has no domain fields; the user edits it afterwards.

USE ONLY WHEN the user explicitly asks for a draft, initial, or skeleton file:
- "draft schema", "inisial table", "file schema awal", "skeleton schema", "starter file untuk saya isi sendiri"

DO NOT USE FOR:
- A request to create a real table ("buatkan tabel product", "I need a customer_invoice table") -> not a draft request. If fields and types are not stated, ask first (the user may leave the design to the assistant), then ground with 'codegen_get_dbschema_catalog', write schema/<table>.js with the file tools, and run 'codegen_dbschema_validate'. Never call this tool as a first step for a real table.
- A ready-made template on explicit request -> 'codegen_dbschema_template'
- Editing a schema file -> file tools
- Schema files from a live database -> 'codegen_dbschema_introspect'
- An RDF payload -> 'codegen_generate_payload'

NOTES:
- The path must end with .js, the file must not exist, and its parent folder must exist. There is no overwrite option.
- Needs the Windows-only binary sdf-tools.exe; exit 3 means it is unavailable on this host, not a user error.
- One call writes one file. Tell the user to rename the table and replace the sample columns.`,
      inputSchema: {
        cwd: z
          .string()
          .min(1)
          .describe('Absolute path of the project folder (must contain node_modules/@restforgejs/platform)'),
        schemaPath: z
          .string()
          .min(1)
          .describe('Target file path relative to cwd (must end with .js, file must NOT already exist). Examples: "schema/supplier.js", "db/models/inventory/products.js".'),
      },
      annotations: {
        title: 'Init dbschema-kit Skeleton File',
        destructiveHint: false, // creates a new file; CLI refuses to overwrite an existing one
        idempotentHint: false,  // each call attempts to create a new file; second call on the same path fails
      },
    },
    async ({ cwd, schemaPath }) => {
      const projectCwd = resolve(cwd);

      // Precondition check: @restforgejs/platform must be present in node_modules. per §3.4
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
Requested path: ${schemaPath}

For the assistant:
- The user needs to install the RESTForge package before a schema skeleton file can be created.
- Suggest installing the package first, then retry creating the skeleton.
- When explaining to the user, say something like "the RESTForge package isn't installed yet — should I install it first?". Do not mention internal tool names.`,
            },
          ],
          isError: false, // per §3.4
        };
      }

      // Subprocess call. The CLI handles all filesystem validation
      // (extension, parent folder existence, target file non-existence). per §3.5
      const cliArgs = ['restforge', 'schema', 'init', `--schema-path=${schemaPath}`];

      const result = await execProcess(
        'npx',
        cliArgs,
        {
          cwd: projectCwd,
          timeout: 10_000,
          env: { NODE_ENV: 'production' },
          stripFinalNewline: true,
        }
      );

      // Branch C: CLI failure — real error per §3.4; structured per §3.5.
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the schema skeleton file.

Project path: ${projectCwd}
Target path: ${schemaPath}
Command: ${result.command}
Exit code: ${result.exitCode}

--- CLI output ---
stdout:
${result.stdout}

stderr:
${result.stderr}
--- end CLI output ---

For the assistant:
- Tell the user that creating the schema skeleton did not complete successfully.
- Summarise the most likely cause from the CLI output in plain language. Common causes:
  * The target file already exists — suggest picking a different filename or removing the existing file first.
  * The path does not end with '.js' — schema files use the JavaScript factory function pattern; suggest correcting the extension.
  * The parent folder does not exist — the CLI does not auto-create intermediate folders. Suggest creating the folder first.
  * Exit code 3 / non-Windows platform — init depends on the Windows-only sdf-tools.exe binary (it wraps 'schema template --generate'). On a non-Windows host the skeleton cannot be generated. Offer alternatives: author the schema file by hand (ground it with the schema catalog), or reverse-engineer it from an existing database table. Present this as a platform limitation, not a user error.
  * Unknown command 'schema init' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package.
- Do not paste the raw stdout/stderr unless the user explicitly asks. Do not mention internal tool names.`,
            },
          ],
          isError: true, // per §3.4
        };
      }

      // Branch B: success — labeled facts + fenced raw output per §3.5.
      return {
        content: [
          {
            type: 'text',
            text: `Schema draft file created successfully.

Project path: ${projectCwd}
Target file: ${schemaPath}
Table name in the file: dummy (the CLI does not rename it after the file name)

--- CLI output ---
${result.stdout}
--- end CLI output ---

For the assistant:
- Confirm to the user that the draft file was created and mention its path in plain language.
- The draft holds the generic dummy template (dummy_id, one sample column per field type, audit columns), not domain fields. Tell the user to rename the table and replace the sample columns with the real fields, indexes, uniques, and relations.
- Use the schema catalog as ground truth when helping the user fill in the model (field types, constraints, relations, shorthand syntax).
- After the user edits the file, suggest validating the schema next as a sanity check (without mentioning the internal tool name).
- If the user wants several entities, this action creates one file per call. For multiple entities, invoke once per file.
- Match the user's language.`,
          },
        ],
      };
    }
  );
}
