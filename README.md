# SnooSpace

## Taskmaster AI (MCP) in this project

Taskmaster AI is configured for Cursor via `.cursor/mcp.json`.

- Server: `taskmaster-ai` via `npx taskmaster-ai start`
- Scope: Project-local; available when you open this repo in Cursor

### How to use inside Cursor

1. Open the Command Palette and choose “Call MCP Tool” (or use the Tools panel).
2. Select `taskmaster-ai` and pick a tool such as planning, breakdown, or execution suggestions.
3. Provide a concise prompt about what you want Taskmaster to plan or decompose.

### Troubleshooting

- If tools don’t appear, re-open the workspace in Cursor or run any command to refresh tools.
- Ensure you have recent Node.js and network access for `npx` to fetch the package.
- You can pin a specific version by editing `.cursor/mcp.json` to replace `taskmaster-ai@latest`.

### Configuration file

See `.cursor/mcp.json` to customize args.

