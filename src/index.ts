#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { readFileSync } from "fs";
import * as tools from "./tools/index.js";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const version = packageJson.version;

async function main() {
	const server = new FastMCP({
		name: "mcp-polymarket",
		version,
	});

	// Check if private key is provided for trading features
	const hasPrivateKey = !!process.env.POLYMARKET_PRIVATE_KEY;

	// Read-only market data tools (always available)
	server.addTool(tools.getMarketBySlugTool);
	server.addTool(tools.getEventBySlugTool);
	server.addTool(tools.listActiveMarketsTool);
	server.addTool(tools.searchMarketsTool);
	server.addTool(tools.getMarketsByTagTool);
	server.addTool(tools.getAllTagsTool);
	server.addTool(tools.getOrderBookTool);

	// Trading tools - only register if private key is provided
	if (hasPrivateKey) {
		server.addTool(tools.placeOrderTool);
		server.addTool(tools.placeMarketOrderTool);
		server.addTool(tools.getOpenOrdersTool);
		server.addTool(tools.getOrderTool);
		server.addTool(tools.cancelOrderTool);
		server.addTool(tools.cancelAllOrdersTool);
		server.addTool(tools.getTradeHistoryTool);
		server.addTool(tools.getBalanceAllowanceTool);
		server.addTool(tools.updateBalanceAllowanceTool);

		console.log(
			"✅ Trading features enabled (POLYMARKET_PRIVATE_KEY is configured)",
		);
	} else {
		console.warn(
			"ℹ️ Read-only mode: Set POLYMARKET_PRIVATE_KEY environment variable to enable trading features",
		);
	}

	server.start({
		transportType: "stdio",
	});
}

main().catch((error) => {
	console.error("🚨 Failed to start MCP server:", error);
	process.exit(1);
});
