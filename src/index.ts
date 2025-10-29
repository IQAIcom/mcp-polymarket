#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { ToolRegistry } from "./server/tool-registry.js";

/**
 * Main application entry point
 * Follows Single Responsibility Principle - only handles server initialization
 */
class PolymarketMCPServer {
	private server: FastMCP;
	private toolRegistry: ToolRegistry;

	constructor() {
		this.server = new FastMCP({
			name: "mcp-polymarket",
			version: "1.0.0",
		});
		this.toolRegistry = new ToolRegistry(this.server);
	}

	/**
	 * Initialize and start the server
	 */
	start(): void {
		// Always register market data tools (read-only)
		this.toolRegistry.registerMarketDataTools();

		// Check if private key is provided for trading features
		const hasPrivateKey = !!process.env.POLYMARKET_PRIVATE_KEY;

		if (hasPrivateKey) {
			this.toolRegistry.registerTradingTools();
			console.error(
				"✓ Trading features enabled (POLYMARKET_PRIVATE_KEY is configured)",
			);
		} else {
			console.error(
				"ℹ Read-only mode: Set POLYMARKET_PRIVATE_KEY environment variable to enable trading features",
			);
		}

		this.server.start({
			transportType: "stdio",
		});
	}
}

// Bootstrap the application
const app = new PolymarketMCPServer();
app.start();
