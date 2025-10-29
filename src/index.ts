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
import { PlaceOrderSchema, handlePlaceOrder } from "./tools/placeOrder.js";
import {
	PlaceMarketOrderSchema,
	handlePlaceMarketOrder,
} from "./tools/placeMarketOrder.js";
import {
	GetOpenOrdersSchema,
	handleGetOpenOrders,
} from "./tools/getOpenOrders.js";
import { GetOrderSchema, handleGetOrder } from "./tools/getOrder.js";
import { CancelOrderSchema, handleCancelOrder } from "./tools/cancelOrder.js";
import {
	CancelAllOrdersSchema,
	handleCancelAllOrders,
} from "./tools/cancelAllOrders.js";
import {
	GetTradeHistorySchema,
	handleGetTradeHistory,
} from "./tools/getTradeHistory.js";
import {
	GetBalanceAllowanceSchema,
	handleGetBalanceAllowance,
} from "./tools/getBalanceAllowance.js";
import {
	UpdateBalanceAllowanceSchema,
	handleUpdateBalanceAllowance,
} from "./tools/updateBalanceAllowance.js";

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

// Trading tools
server.addTool({
	name: "place_order",
	description:
		"Place a limit order on Polymarket. Requires POLYMARKET_PRIVATE_KEY environment variable to be set.",
	parameters: PlaceOrderSchema,
	execute: handlePlaceOrder,
});

server.addTool({
	name: "place_market_order",
	description:
		"Place a market order (FOK or FAK) on Polymarket. Executes immediately at market price. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: PlaceMarketOrderSchema,
	execute: handlePlaceMarketOrder,
});

server.addTool({
	name: "get_open_orders",
	description:
		"Get all open orders for the authenticated account. Can optionally filter by market. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: GetOpenOrdersSchema,
	execute: handleGetOpenOrders,
});

server.addTool({
	name: "get_order",
	description:
		"Get details of a specific order by its ID. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: GetOrderSchema,
	execute: handleGetOrder,
});

server.addTool({
	name: "cancel_order",
	description:
		"Cancel a specific order by its ID. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: CancelOrderSchema,
	execute: handleCancelOrder,
});

server.addTool({
	name: "cancel_all_orders",
	description:
		"Cancel all open orders for the authenticated account. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: CancelAllOrdersSchema,
	execute: handleCancelAllOrders,
});

server.addTool({
	name: "get_trade_history",
	description:
		"Get trade history for the authenticated account. Can optionally filter by market or maker address. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: GetTradeHistorySchema,
	execute: handleGetTradeHistory,
});

server.addTool({
	name: "get_balance_allowance",
	description:
		"Get balance and allowance information for the authenticated account. Can check USDC, COLLATERAL, or CONDITIONAL tokens. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: GetBalanceAllowanceSchema,
	execute: handleGetBalanceAllowance,
});

server.addTool({
	name: "update_balance_allowance",
	description:
		"Update balance and allowance for the authenticated account. Required before trading. Requires POLYMARKET_PRIVATE_KEY environment variable.",
	parameters: UpdateBalanceAllowanceSchema,
	execute: handleUpdateBalanceAllowance,
});

server.start({
	transportType: "stdio",
});
