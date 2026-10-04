import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerHealthTools } from './tools/health/index.js';
import { registerSetupTools } from './tools/setup/index.js';
import { registerCodegenTools } from './tools/codegen/index.js';
import { registerRuntimeTools } from './tools/runtime/index.js';
import { registerDesignerTools } from './tools/designer/index.js';
import { registerDataTools } from './tools/data/index.js';
import { registerKeyTools } from './tools/key/index.js';
import { registerProjectTools } from './tools/project/index.js';
import { registerLicenseTools } from './tools/license/index.js';
import { registerAuthServiceTools } from './tools/auth-service/index.js';

const SERVER_NAME = 'restforge-mcp';

// Read the version from package.json at runtime so the advertised server version
// never drifts from the published package version. createRequire resolves the JSON
// relative to this module's location (dist/server.js -> ../package.json, and
// src/server.ts -> ../package.json under tsx), so the path holds in both build and
// dev. createRequire is used instead of a static JSON import because rootDir is
// ./src and package.json lives outside it; a static import would break the build.
const require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = require('../package.json') as { version: string };

export const SERVER_INSTRUCTIONS = `
RESTForge MCP server. Backend tools (setup_*, codegen_*, runtime_*, data_*, key_*, project_*, license_info) wrap the 'restforge' CLI; designer_* tools wrap 'npx restforge-designer' (frontend). Both ship in @restforgejs/platform, installed locally in the project folder (new one: 'npx create-restforge-app <name>').

Load the 'restforge' skill before the first RESTForge tool call. It holds the intent router, the canonical order, and the layer rules: SDF = schema/<table>.js (database), RDF = payload/<name>.json (backend API), UDF = frontend/payload/ (made by codegen_migrate_payload). Without the skill, ground syntax with the codegen_get_*_catalog and designer_get_udf_catalog tools or the handbook at https://github.com/restforge/handbook; never borrow syntax from other frameworks. RBAC (roles, permissions): auth-service flow in skill.

Hard rules:
1. New table without stated fields: ask for the fields and types first (the user may hand the design over), then write schema/<table>.js with the file tools. codegen_dbschema_init is only for an explicit draft/skeleton request. UUID PK/FK: string:36, not uuid; FKs in relations (belongsTo), not inline fk:.
2. Run setup_validate_config once per session before the first tool that takes 'config'. File-only work (catalogs, SDF writing, file validate, DDL preview) skips it.
3. A tool marked DESTRUCTIVE needs user confirmation first; use dryRun when offered.
4. Never start, stop, or restart a server or Kafka consumer from a shell: write a launcher (runtime_generate_launcher, runtime_generate_consumer_launcher) for the user to run.
5. Backend output (src/modules, src/models) is overwritten on regenerate: change the definition file instead. Frontend app edits are kept: designer_generate merges them.
6. If the request already covers the next step of a flow, continue without asking.
7. Reply in the user's language, describe actions without tool names, summarise instead of pasting raw output, never repeat secrets (license key, passwords).
`.trim();

// Registers every tool family on the given server. Exported so the guidance guard
// (scripts/check-guidance.ts) can collect all tool descriptions without starting
// the stdio transport.
export function registerAllTools(server: McpServer): void {
  registerHealthTools(server, SERVER_VERSION);
  registerSetupTools(server);
  registerCodegenTools(server);
  registerRuntimeTools(server);
  registerDesignerTools(server);
  registerDataTools(server);
  registerKeyTools(server);
  registerProjectTools(server);
  registerLicenseTools(server);
  registerAuthServiceTools(server);
}

export async function startServer(): Promise<void> {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
