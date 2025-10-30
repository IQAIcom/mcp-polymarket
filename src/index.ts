#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import {
	CancelAllOrdersSchema,
	handleCancelAllOrders,
} from "./tools/cancel-all-orders.js";
import { CancelOrderSchema, handleCancelOrder } from "./tools/cancel-order.js";
import { GetAllTagsSchema, handleGetAllTags } from "./tools/get-all-tags.js";
import {
	GetBalanceAllowanceSchema,
	handleGetBalanceAllowance,
} from "./tools/get-balance-allowance.js";
import {
	GetEventBySlugSchema,
	handleGetEventBySlug,
} from "./tools/get-event-by-slug.js";
import {
	GetMarketBySlugSchema,
	handleGetMarketBySlug,
} from "./tools/get-market-by-slug.js";
import {
	GetMarketsByTagSchema,
	handleGetMarketsByTag,
} from "./tools/get-markets-by-tag.js";
import {
	GetOpenOrdersSchema,
	handleGetOpenOrders,
} from "./tools/get-open-orders.js";
import { GetOrderSchema, handleGetOrder } from "./tools/get-order.js";
import {
	GetOrderBookSchema,
	handleGetOrderBook,
} from "./tools/get-order-book.js";
import {
	GetTradeHistorySchema,
	handleGetTradeHistory,
} from "./tools/get-trade-history.js";
import {
	handleListActiveMarkets,
	ListActiveMarketsSchema,
} from "./tools/list-active-markets.js";
import {
	handlePlaceMarketOrder,
	PlaceMarketOrderSchema,
} from "./tools/place-market-order.js";
import { handlePlaceOrder, PlaceOrderSchema } from "./tools/place-order.js";
import {
	handleSearchMarkets,
	SearchMarketsSchema,
} from "./tools/search-markets.js";
import {
	handleUpdateBalanceAllowance,
	UpdateBalanceAllowanceSchema,
} from "./tools/update-balance-allowance.js";

const server = new FastMCP({
	name: "mcp-polymarket",
	version: "1.0.0",
});

// Check if private key is provided for trading features
const hasPrivateKey = !!process.env.POLYMARKET_PRIVATE_KEY;

// Read-only market data tools (always available)
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

// Trading tools - only register if private key is provided
if (hasPrivateKey) {
	server.addTool({
		name: "place_order",
		description:
			"Place a limit order on Polymarket. Places a buy or sell order at a specific price.",
		parameters: PlaceOrderSchema,
		execute: handlePlaceOrder,
	});

	server.addTool({
		name: "place_market_order",
		description:
			"Place a market order (FOK or FAK) on Polymarket. Executes immediately at market price.",
		parameters: PlaceMarketOrderSchema,
		execute: handlePlaceMarketOrder,
	});

	server.addTool({
		name: "get_open_orders",
		description:
			"Get all open orders for the authenticated account. Can optionally filter by market.",
		parameters: GetOpenOrdersSchema,
		execute: handleGetOpenOrders,
	});

	server.addTool({
		name: "get_order",
		description: "Get details of a specific order by its ID.",
		parameters: GetOrderSchema,
		execute: handleGetOrder,
	});

	server.addTool({
		name: "cancel_order",
		description: "Cancel a specific order by its ID.",
		parameters: CancelOrderSchema,
		execute: handleCancelOrder,
	});

	server.addTool({
		name: "cancel_all_orders",
		description: "Cancel all open orders for the authenticated account.",
		parameters: CancelAllOrdersSchema,
		execute: handleCancelAllOrders,
	});

	server.addTool({
		name: "get_trade_history",
		description:
			"Get trade history for the authenticated account. Can optionally filter by market or maker address.",
		parameters: GetTradeHistorySchema,
		execute: handleGetTradeHistory,
	});

	server.addTool({
		name: "get_balance_allowance",
		description:
			"Get balance and allowance information for the authenticated account. Can check COLLATERAL or CONDITIONAL tokens.",
		parameters: GetBalanceAllowanceSchema,
		execute: handleGetBalanceAllowance,
	});

	server.addTool({
		name: "update_balance_allowance",
		description:
			"Update balance and allowance for the authenticated account. Required before trading.",
		parameters: UpdateBalanceAllowanceSchema,
		execute: handleUpdateBalanceAllowance,
	});

	console.error(
		"✓ Trading features enabled (POLYMARKET_PRIVATE_KEY is configured)",
	);
} else {
	console.error(
		"ℹ Read-only mode: Set POLYMARKET_PRIVATE_KEY environment variable to enable trading features",
	);
}

server.start({
	transportType: "stdio",
});
