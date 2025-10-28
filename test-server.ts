#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server tools
 * This sends MCP protocol messages to the server via stdio
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, "build", "index.js");

// Start the server
const server = spawn("node", [serverPath], {
	stdio: ["pipe", "pipe", "inherit"],
});

let responseBuffer = "";

server.stdout.on("data", (data) => {
	responseBuffer += data.toString();
	// Try to parse complete JSON-RPC messages
	const lines = responseBuffer.split("\n");
	responseBuffer = lines.pop() || ""; // Keep incomplete line in buffer

	for (const line of lines) {
		if (line.trim()) {
			try {
				const msg = JSON.parse(line);
				console.log("Response:", JSON.stringify(msg, null, 2));
			} catch (_e) {
				console.log("Raw output:", line);
			}
		}
	}
});

// Helper to send JSON-RPC request
function sendRequest(id: number, method: string, params: unknown) {
	const request = {
		jsonrpc: "2.0",
		id,
		method,
		params,
	};
	server.stdin.write(`${JSON.stringify(request)}\n`);
}

// Wait a bit for server to start
setTimeout(() => {
	console.log("Testing MCP Server...\n");

	// Test 1: Initialize
	console.log("1. Sending initialize request...");
	sendRequest(1, "initialize", {
		protocolVersion: "2024-11-05",
		capabilities: {},
		clientInfo: {
			name: "test-client",
			version: "1.0.0",
		},
	});

	// Test 2: List tools
	setTimeout(() => {
		console.log("\n2. Listing available tools...");
		sendRequest(2, "tools/list", {});
	}, 1000);

	// Test 3: Call a tool (search markets)
	setTimeout(() => {
		console.log("\n3. Testing search_markets tool...");
		sendRequest(3, "tools/call", {
			name: "search_markets",
			arguments: {
				query: "bitcoin",
			},
		});
	}, 2000);

	// Close after tests
	setTimeout(() => {
		console.log("\n\nTests completed. Closing...");
		server.stdin.end();
		setTimeout(() => process.exit(0), 500);
	}, 5000);
}, 500);

server.on("error", (err) => {
	console.error("Server error:", err);
	process.exit(1);
});

server.on("close", (code) => {
	console.log(`Server exited with code ${code}`);
});
