---
"@iqai/mcp-polymarket": patch
---

Fix MCP protocol logging and rename RPC environment variable

- Route all server log output to stderr so it no longer corrupts the MCP stdout JSON-RPC stream
- Rename `POLYMARKET_RPC_URL` to `POLYGON_RPC_URL` (update your env/config accordingly)
- Remove emoji characters from log messages
