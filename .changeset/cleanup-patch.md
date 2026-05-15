---
"@iqai/mcp-polymarket": patch
---

Cleanup batch:

- Fix stderr log lines running together due to missing trailing newlines on init/order/market-order logs (server log output is no longer corrupted into one line)
- Reject invalid `outcomeIndex` for negRisk redemption instead of silently defaulting to outcome 0 — prevents accidentally redeeming the losing side when the caller passes a bad value
- Move `shx` from `dependencies` to `devDependencies` so npm consumers don't pull it in
