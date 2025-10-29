#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { GetAllTagsSchema, handleGetAllTags } from "./tools/getAllTags.js";
import {
	GetEventBySlugSchema,
	handleGetEventBySlug,
} from "./tools/getEventBySlug.js";
import {
	GetMarketBySlugSchema,
	handleGetMarketBySlug,
} from "./tools/getMarketBySlug.js";
import {
	GetMarketsByTagSchema,
	handleGetMarketsByTag,
} from "./tools/getMarketsByTag.js";
import {
	GetOrderBookSchema,
	handleGetOrderBook,
} from "./tools/getOrderBook.js";
import {
	handleListActiveMarkets,
	ListActiveMarketsSchema,
} from "./tools/listActiveMarkets.js";
import {
	handleSearchMarkets,
	SearchMarketsSchema,
} from "./tools/searchMarkets.js";

const server = new FastMCP({
	name: "mcp-polymarket",
	version: "1.0.0",
});

server.addTool({
	name: "get_market_by_slug",
	description:
		"Get detailed information about a specific market by its slug identifier. The slug can be extracted from the Polymarket URL.",
	parameters: GetMarketBySlugSchema,
	execute: handleGetMarketBySlug,
});

server.addTool({
	name: "get_event_by_slug",
	description:
		"Get detailed information about a specific event by its slug identifier. Events group multiple related markets.",
	parameters: GetEventBySlugSchema,
	execute: handleGetEventBySlug,
});

server.addTool({
	name: "list_active_markets",
	description:
		"List all currently active markets with pagination. Returns markets that are not yet closed.",
	parameters: ListActiveMarketsSchema,
	execute: handleListActiveMarkets,
});

server.addTool({
	name: "search_markets",
	description: "Search for markets, events, and profiles using text search.",
	parameters: SearchMarketsSchema,
	execute: handleSearchMarkets,
});

server.addTool({
	name: "get_markets_by_tag",
	description:
		"Get markets filtered by a specific tag ID. Useful for finding markets in specific categories.",
	parameters: GetMarketsByTagSchema,
	execute: handleGetMarketsByTag,
});

server.addTool({
	name: "get_all_tags",
	description: "Get a list of all available tags for categorizing markets.",
	parameters: GetAllTagsSchema,
	execute: handleGetAllTags,
});

server.addTool({
	name: "get_order_book",
	description:
		"Get the current order book for a specific market token. Shows all active buy and sell orders.",
	parameters: GetOrderBookSchema,
	execute: handleGetOrderBook,
});

server.start({
	transportType: "stdio",
});
