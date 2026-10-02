import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAuthServiceInit } from './init.js';
import { registerAuthServiceBootstrap } from './bootstrap.js';
import { registerAuthServiceLink } from './link.js';
import { registerAuthServiceManifest } from './manifest.js';
import { registerAuthServiceProvision } from './provision.js';

export function registerAuthServiceTools(server: McpServer): void {
  registerAuthServiceInit(server);
  registerAuthServiceBootstrap(server);
  registerAuthServiceLink(server);
  registerAuthServiceManifest(server);
  registerAuthServiceProvision(server);
}
