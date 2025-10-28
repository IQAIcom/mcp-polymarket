#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	type CallToolRequest,
	CallToolRequestSchema,
	ListToolsRequestSchema,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Polymarket Gamma API base URL
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

// Tool definitions
const TOOLS: Tool[] = [
	{
		name: "get_market_by_slug",
		description:
			"Get detailed information about a specific market by its slug identifier. The slug can be extracted from the Polymarket URL.",
		inputSchema: {
			type: "object",
			properties: {
				slug: {
					type: "string",
					description:
						"The market slug identifier (e.g., 'will-trump-win-2024')",
				},
			},
			required: ["slug"],
		},
	},
	{
		name: "get_event_by_slug",
		description:
			"Get detailed information about a specific event by its slug identifier. Events group multiple related markets.",
		inputSchema: {
			type: "object",
			properties: {
				slug: {
					type: "string",
					description: "The event slug identifier",
				},
			},
			required: ["slug"],
		},
	},
	{
		name: "list_active_markets",
		description:
			"List all currently active markets with pagination. Returns markets that are not yet closed.",
		inputSchema: {
			type: "object",
			properties: {
				limit: {
					type: "number",
					description: "Number of markets to return (default: 20, max: 100)",
					default: 20,
				},
				offset: {
					type: "number",
					description: "Number of markets to skip for pagination (default: 0)",
					default: 0,
				},
			},
		},
	},
	{
		name: "search_markets",
		description: "Search for markets, events, and profiles using text search.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query text",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "get_markets_by_tag",
		description:
			"Get markets filtered by a specific tag ID. Useful for finding markets in specific categories.",
		inputSchema: {
			type: "object",
			properties: {
				tag_id: {
					type: "string",
					description: "The tag ID to filter by",
				},
				limit: {
					type: "number",
					description: "Number of markets to return (default: 20)",
					default: 20,
				},
				closed: {
					type: "boolean",
					description: "Include closed markets (default: false)",
					default: false,
				},
			},
			required: ["tag_id"],
		},
	},
	{
		name: "get_all_tags",
		description: "Get a list of all available tags for categorizing markets.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "get_order_book",
		description:
			"Get the current order book for a specific market token. Shows all active buy and sell orders.",
		inputSchema: {
			type: "object",
			properties: {
				token_id: {
					type: "string",
					description: "The token ID for the market outcome",
				},
			},
			required: ["token_id"],
		},
	},
];

// Helper function to make API requests
async function fetchGammaAPI(endpoint: string): Promise<unknown> {
	const url = `${GAMMA_API_BASE}${endpoint}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Gamma API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

// Helper function to fetch CLOB API
async function fetchClobAPI(endpoint: string): Promise<unknown> {
	const url = `https://clob.polymarket.com${endpoint}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`CLOB API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

// Tool execution handlers
async function handleGetMarketBySlug(args: { slug: string }): Promise<string> {
	const data = await fetchGammaAPI(`/markets/slug/${args.slug}`);
	return JSON.stringify(data, null, 2);
}

async function handleGetEventBySlug(args: { slug: string }): Promise<string> {
	const data = await fetchGammaAPI(`/events/slug/${args.slug}`);
	return JSON.stringify(data, null, 2);
}

async function handleListActiveMarkets(args: {
	limit?: number;
	offset?: number;
}): Promise<string> {
	const limit = args.limit || 20;
	const offset = args.offset || 0;
	const data = await fetchGammaAPI(
		`/events?order=id&ascending=false&closed=false&limit=${limit}&offset=${offset}`,
	);
	return JSON.stringify(data, null, 2);
}

async function handleSearchMarkets(args: { query: string }): Promise<string> {
	const data = await fetchGammaAPI(
		`/public-search?query=${encodeURIComponent(args.query)}`,
	);
	return JSON.stringify(data, null, 2);
}

async function handleGetMarketsByTag(args: {
	tag_id: string;
	limit?: number;
	closed?: boolean;
}): Promise<string> {
	const limit = args.limit || 20;
	const closed = args.closed || false;
	const data = await fetchGammaAPI(
		`/markets?tag_id=${args.tag_id}&limit=${limit}&closed=${closed}`,
	);
	return JSON.stringify(data, null, 2);
}

async function handleGetAllTags(): Promise<string> {
	const data = await fetchGammaAPI("/tags");
	return JSON.stringify(data, null, 2);
}

async function handleGetOrderBook(args: { token_id: string }): Promise<string> {
	const data = await fetchClobAPI(`/book?token_id=${args.token_id}`);
	return JSON.stringify(data, null, 2);
}

// Create MCP server
const server = new Server(
	{
		name: "mcp-polymarket",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: TOOLS,
	};
});

// Register tool execution handler
server.setRequestHandler(
	CallToolRequestSchema,
	async (request: CallToolRequest) => {
		try {
			const { name, arguments: args } = request.params;

			let result: string;

			switch (name) {
				case "get_market_by_slug":
					result = await handleGetMarketBySlug(args as { slug: string });
					break;
				case "get_event_by_slug":
					result = await handleGetEventBySlug(args as { slug: string });
					break;
				case "list_active_markets":
					result = await handleListActiveMarkets(
						args as { limit?: number; offset?: number },
					);
					break;
				case "search_markets":
					result = await handleSearchMarkets(args as { query: string });
					break;
				case "get_markets_by_tag":
					result = await handleGetMarketsByTag(
						args as {
							tag_id: string;
							limit?: number;
							closed?: boolean;
						},
					);
					break;
				case "get_all_tags":
					result = await handleGetAllTags();
					break;
				case "get_order_book":
					result = await handleGetOrderBook(args as { token_id: string });
					break;
				default:
					throw new Error(`Unknown tool: ${name}`);
			}

			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: `Error: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	},
);

// Start the server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Polymarket MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});
