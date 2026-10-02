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
      description: `Create a DRAFT schema definition file at the given path, by wrapping restforge schema init. The file holds the generic 'dummy' template: a dummy_id primary key, one sample column per field type (field_string, field_text, field_integer, field_bigint, field_decimal, field_boolean, field_date, field_timestamp, field_uuid, field_json), and the audit columns. It contains no domain fields; the user edits it by hand afterwards.

USE ONLY WHEN the user explicitly asks for a draft, initial, or skeleton file:
- "draft table", "draft schema", "inisial table", "file schema awal", "skeleton schema", "init schema definition", "starter file untuk saya isi sendiri"

DO NOT USE FOR:
- A request to create a real table ("buatkan tabel product", "create a customer table", "I need a customer_invoice table") -> this is NOT a draft request. If the fields and types are not stated, ask the user for them first (one short question; the user may leave the design to the assistant). Then ground the syntax with 'codegen_get_dbschema_catalog', write the complete schema/<table>.js with the file tools, and run 'codegen_dbschema_validate'. Never call this tool as a first step before authoring a real table.
- A ready-made template from the reference collection (sales_order, invoice, product, ...) on explicit request -> use 'codegen_dbschema_template'
- Editing an existing schema file -> use Edit/Write tools directly
- Generating schema files from a live database -> use 'codegen_dbschema_introspect'
- Creating a CRUD payload (different concept) -> use 'codegen_generate_payload'
- Validating the schema -> use 'codegen_dbschema_validate'
- Generating DDL -> use 'codegen_dbschema_generate_ddl'

This tool runs: npx restforge schema init --schema-path=<path> in the given cwd.
The CLI writes a JavaScript factory function file to the target path. The path must end with '.js' and the file must NOT already exist.

There is no overwrite option here: '--schema-path' is the only flag the CLI accepts for this verb, and it has no '--force'. An existing target file is always an error, so this tool never overwrites anything. When the user really wants to replace an existing file, either the old file is removed first, or 'codegen_dbschema_template' is used in generate mode with force enabled — that is the verb that owns the overwrite path.

IMPLEMENTATION NOTE (matters for cross-platform behaviour): schema init is a thin wrapper over 'schema template --table=dummy --generate --lang=sdf'. It therefore depends on the same native binary (sdf-tools.exe) that the template feature uses, and that binary is currently WINDOWS-ONLY. On a non-Windows host (or if the binary is missing from the installed package) the CLI exits with code 3 and no file is created — that is a platform limitation, not a user error.

Preconditions:
- The project must have @restforgejs/platform installed in node_modules.
- The init feature requires the Windows-only sdf-tools.exe binary shipped with the package (exit 3 otherwise — see IMPLEMENTATION NOTE).
- The target file must NOT already exist (CLI fails otherwise — the user can pick a different name or remove the existing file first).
- The parent folder of the target path must exist (CLI does not create intermediate folders).

PRESENTATION GUIDANCE:
- Match the user's language. If the user writes in Indonesian, respond in Indonesian.
- Never mention internal tool names in the reply to the user. Describe actions by what they do (e.g. "create a starter schema file", "look up the schema catalog", "validate the schema").
- Speak in plain language. Confirm the file was created and mention its path; do not paste the raw CLI output unless the user explicitly asks.
- The draft holds only the generic dummy columns. Tell the user to rename the table and replace the sample columns with the real domain fields.
- If the user wants multiple files (e.g. category.js, supplier.js, customer.js), invoke this action once per file. Do not assume one call covers multiple files.
- When a precondition is not met (e.g. the package is not installed), frame it as a question or next-step suggestion rather than an error.`,
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
