import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLicenseInfo } from './info.js';

export function registerLicenseTools(server: McpServer): void {
  registerLicenseInfo(server);
}
