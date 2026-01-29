---
"@iqai/mcp-polymarket": patch
---

Fix network detection errors with flaky RPC endpoints

- Use StaticJsonRpcProvider instead of JsonRpcProvider to bypass network auto-detection
- Fix signature type auto-detection being overwritten during config merge
- Skip approval checks for proxy wallet mode (signature type 2) since approvals are managed via Polymarket UI
