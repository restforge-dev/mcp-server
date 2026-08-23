# @restforgejs/mcp-server

MCP (Model Context Protocol) server for the RESTForge Platform. Exposes RESTForge capabilities to AI Agents (Claude Desktop, Cursor, Claude CLI, and other MCP clients) so agents can operate RESTForge through natural language without manually invoking CLI commands.

> **Scope Notice:** This MCP server is a thin orchestrator that exposes RESTForge Platform commands to AI agents via the Model Context Protocol. It is not a generic MCP framework, an API testing tool, an API client, or an HTTP request proxy. Its tools strictly invoke RESTForge Platform CLI commands; it does not consume or test arbitrary third-party APIs.

## Requirements

- Node.js >= 18
- `@restforgejs/platform` installed **locally** in the target project's `node_modules`. Almost every tool runs `npx restforge ...` inside the project folder, so a local install is mandatory. Global installation of the platform is not supported.
- For the full setup workflow: a supported database (PostgreSQL, MySQL, Oracle, or SQLite) and a RESTForge license key

## Access & License

This MCP server package (`@restforgejs/mcp-server`) is distributed under the **MIT License** and may be installed and inspected freely.

The MCP server orchestrates the **RESTForge Platform** (`@restforgejs/platform`), which is **commercial software currently in closed evaluation**. Full workflow execution (setup validation, code generation, runtime launch) requires a valid RESTForge license key.

License key acquisition:

- **Early Access Program** — Limited slots for volunteer evaluators. Apply at [restforge.dev](https://restforge.dev)
- **Commercial Trial** — Coming soon. Register interest at [restforge.dev](https://restforge.dev)
- **Commercial License** — Available upon general release

Without a valid license key, the tools that reach into the platform runtime return authentication errors from the CLI. That covers the whole `codegen_*`, `runtime_*`, and `data_*` domains plus `setup_validate_config`.

The `designer_*` domain runs without a license, because the license mechanism has been removed from the `restforge-designer` binary. That binary is still distributed inside `@restforgejs/platform`, so the "installed locally" requirement still applies to it.

## Installation & Registration

The MCP server is not installed globally. It is registered per MCP client, and the entry runs through `npx` so the client always resolves the current version when it starts the server.

The recommended path is the skills installer, which writes both the RESTForge skills and the MCP entry in one step:

```bash
npx create-restforge-skills
```

The installer merges the following entry into the MCP client config (merge, not overwrite):

```json
{
  "mcpServers": {
    "restforge": {
      "command": "npx",
      "args": ["-y", "@restforgejs/mcp-server"]
    }
  }
}
```

The same entry can be written by hand when registration is managed manually. See the per-client examples in [Quick Start](#quick-start) below.

**Alternative — the `restforge-mcp` binary.** The package also registers a `restforge-mcp` bin entry, so `"command": "restforge-mcp"` is a valid alternative in any of the config snippets below. It only resolves when the package is already present in the environment that launches the client, and it is not the recommended installation path.

## Quick Start

### 1. Verify the server responds

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y @restforgejs/mcp-server
```

Output should list 69 tools across the nine domains described in [Available Tools](#available-tools).

### 2. Register with an MCP Client

**Claude CLI** (user scope, applies to all projects):

```bash
claude mcp add --transport stdio --scope user restforge -- npx -y @restforgejs/mcp-server
```

**Cursor** (`.cursor/mcp.json` in project root):

```json
{
  "mcpServers": {
    "restforge": {
      "command": "npx",
      "args": ["-y", "@restforgejs/mcp-server"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "restforge": {
      "command": "npx",
      "args": ["-y", "@restforgejs/mcp-server"]
    }
  }
}
```

### 3. Use via Natural Language

In your AI client chat, type prompts like:

> Setup a new RESTForge project at `d:/projects/api-test` with PostgreSQL on localhost:5432, license `XXXX-XXXX-XXXX-XXXX`

> Generate a CRUD endpoint for the `customer` table

> Start my RESTForge project (the agent generates a launcher script for the user to execute)

The agent orchestrates the appropriate tools to fulfill the request end-to-end.

## Available Tools

69 tools grouped into nine domains by name prefix. AI agents call these via the MCP protocol; end users do not invoke them directly.

| Domain | Count | Coverage | Representative tools |
|---|---|---|---|
| `setup_*` | 13 | Project folder, package installation, `db-connection.env` config, recorded default config, connection validation | `setup_install_package`, `setup_write_env`, `setup_validate_config`, `setup_set_default_config` |
| `codegen_*` | 27 | SDF (`schema`), RDF (`payload`), endpoint / processor / dashboard / kafka / test generators, grounding catalogs, SQL validation | `codegen_dbschema_migrate`, `codegen_generate_payload`, `codegen_create_endpoint`, `codegen_get_dbschema_catalog` |
| `designer_*` | 11 | Frontend generator: project init, plugins, UDF catalog, validate / preview / generate, auth overlay | `designer_init_project`, `designer_get_udf_catalog`, `designer_generate`, `designer_auth_create` |
| `runtime_*` | 7 | Project and config detection, preflight checks, server status, server and consumer launcher generation | `runtime_validate_preflight`, `runtime_generate_launcher`, `runtime_check_status` |
| `project_*` | 4 | Project listing and deletion, backend auth extension, SDK client generation | `project_list`, `project_auth`, `project_sdk_generate` |
| `key_*` | 3 | Project API key management | `key_generate`, `key_list`, `key_revoke` |
| `data_*` | 2 | Table row export and import across dialects | `data_pull`, `data_push` |
| `license_*` | 1 | Machine license activation status | `license_info` |
| `health_*` | 1 | MCP transport smoke test | `health_ping` |

The full per-tool specification — every tool name, the CLI verb it wraps, its parameters, and where its behaviour differs from the CLI — lives in the `mcp/` section of the RESTForge Handbook. That section is the single reference for the surface; this table is a summary and deliberately does not restate all 69 rows. The live surface of any installed version is always discoverable through the MCP `tools/list` method.

Tool names are a public contract. Adding or removing a tool without updating the corresponding handbook page counts as drift.

### Cross-domain behaviour worth knowing

- **`cwd` parameter** — almost every tool takes an absolute project path that determines which `@restforgejs/platform` installation runs, which config resolves, and where generated files are written. `health_ping` has no `cwd`, `setup_create_folder` uses `parentCwd`, and `designer_get_udf_catalog` treats it as optional.
- **Preconditions are not errors** — a missing package, config file, or payload file comes back as an ordinary response explaining the next step, so the agent offers setup instead of reporting a failure. Only genuine CLI failures are flagged as errors.
- **Hardcoded flags on destructive tools** — `project_delete` and `key_revoke` send `--yes`, `designer_auth_remove` sends `--force`, and `codegen_create_endpoint` / `codegen_create_dashboard` send `--force=true` while their `force` parameter stays at its `true` default. The CLI's own confirmation prompt is gone, so the agent must confirm with the user beforehand.
- **Sensitive value masking** — `setup_read_env` masks `LICENSE`, `DB_PASSWORD`, `REDIS_PASSWORD`, and `KAFKA_SASL_PASSWORD` unless `unmask` is set; `key_list` masks API keys unless `showFull` is set.

> **Runtime principle**: AI agents never start, stop, or restart the server directly. The runtime tools only generate launcher scripts that the user executes themselves, so the running server lives independently of the AI session. The same two-step pattern applies to Kafka consumers via `runtime_generate_consumer_launcher`.

## Compatibility

This MCP server works with any MCP client that supports the stdio transport, including but not limited to:

- Claude Desktop
- Claude CLI (Claude Code)
- Cursor
- Windsurf
- Cline (VS Code extension)
- Continue (VS Code/JetBrains extension)
- Zed

The model used (Claude, GPT, Gemini, etc.) depends on the client configuration. Tool selection accuracy is best with frontier models that have mature tool-calling support.

## Repository

- Source: [https://github.com/restforge/mcp-server](https://github.com/restforge/mcp-server)
- Issues: [https://github.com/restforge/mcp-server/issues](https://github.com/restforge/mcp-server/issues)

## License

MIT — see [LICENSE.md](LICENSE.md).
