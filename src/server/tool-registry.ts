import type { FastMCP } from "fastmcp";
import {
	CancelAllOrdersSchema,
	handleCancelAllOrders,
} from "../tools/cancel-all-orders.js";
import { CancelOrderSchema, handleCancelOrder } from "../tools/cancel-order.js";
import {
	CheckTokenAllowancesSchema,
	handleCheckTokenAllowances,
} from "../tools/check-token-allowances.js";
import { GetAllTagsSchema, handleGetAllTags } from "../tools/get-all-tags.js";
import {
	GetBalanceAllowanceSchema,
	handleGetBalanceAllowance,
} from "../tools/get-balance-allowance.js";
import {
	GetEventBySlugSchema,
	handleGetEventBySlug,
} from "../tools/get-event-by-slug.js";
import {
	GetMarketBySlugSchema,
	handleGetMarketBySlug,
} from "../tools/get-market-by-slug.js";
import {
	GetMarketsByTagSchema,
	handleGetMarketsByTag,
} from "../tools/get-markets-by-tag.js";
import {
	GetOpenOrdersSchema,
	handleGetOpenOrders,
} from "../tools/get-open-orders.js";
import { GetOrderSchema, handleGetOrder } from "../tools/get-order.js";
import {
	GetOrderBookSchema,
	handleGetOrderBook,
} from "../tools/get-order-book.js";
import {
	GetPortfolioSchema,
	handleGetPortfolio,
} from "../tools/get-portfolio.js";
import {
	GetTradeHistorySchema,
	handleGetTradeHistory,
} from "../tools/get-trade-history.js";
import {
	handleListActiveMarkets,
	ListActiveMarketsSchema,
} from "../tools/list-active-markets.js";
import {
	handlePlaceMarketOrder,
	PlaceMarketOrderSchema,
} from "../tools/place-market-order.js";
import { handlePlaceOrder, PlaceOrderSchema } from "../tools/place-order.js";
import {
	handleSearchMarkets,
	SearchMarketsSchema,
} from "../tools/search-markets.js";
import {
	handleSetTokenAllowances,
	SetTokenAllowancesSchema,
} from "../tools/set-token-allowances.js";
import {
	handleUpdateBalanceAllowance,
	UpdateBalanceAllowanceSchema,
} from "../tools/update-balance-allowance.js";

/**
 * Tool registry that follows Open/Closed Principle
 * Handles registration of MCP tools in a structured way
 */
export class ToolRegistry {
	constructor(private server: FastMCP) {}

	/**
	 * Register all read-only market data tools
	 */
	registerMarketDataTools(): void {
		this.server.addTool({
			name: "get_market_by_slug",
			description:
				"Get detailed information about a specific market by its slug identifier. The slug can be extracted from the Polymarket URL.",
			parameters: GetMarketBySlugSchema,
			execute: handleGetMarketBySlug,
		});

		this.server.addTool({
			name: "get_event_by_slug",
			description:
				"Get detailed information about a specific event by its slug identifier. Events group multiple related markets.",
			parameters: GetEventBySlugSchema,
			execute: handleGetEventBySlug,
		});

		this.server.addTool({
			name: "list_active_markets",
			description:
				"List all currently active markets with pagination. Returns markets that are not yet closed.",
			parameters: ListActiveMarketsSchema,
			execute: handleListActiveMarkets,
		});

		this.server.addTool({
			name: "search_markets",
			description:
				"Search for markets, events, and profiles using text search.",
			parameters: SearchMarketsSchema,
			execute: handleSearchMarkets,
		});

		this.server.addTool({
			name: "get_markets_by_tag",
			description:
				"Get markets filtered by a specific tag ID. Useful for finding markets in specific categories.",
			parameters: GetMarketsByTagSchema,
			execute: handleGetMarketsByTag,
		});

		this.server.addTool({
			name: "get_all_tags",
			description: "Get a list of all available tags for categorizing markets.",
			parameters: GetAllTagsSchema,
			execute: handleGetAllTags,
		});

		this.server.addTool({
			name: "get_order_book",
			description:
				"Get the current order book for a specific market token. Shows all active buy and sell orders.",
			parameters: GetOrderBookSchema,
			execute: handleGetOrderBook,
		});
	}

	/**
	 * Register trading-related tools (requires authentication)
	 */
	registerTradingTools(): void {
		this.registerOrderTools();
		this.registerPortfolioTools();
		this.registerAllowanceTools();
	}

	/**
	 * Register order management tools
	 */
	private registerOrderTools(): void {
		this.server.addTool({
			name: "place_order",
			description:
				"Place a limit order on Polymarket. You can specify either a market slug + outcome (YES/NO) for easy trading, or use a direct tokenId. The tool automatically fetches market details and tick size when using slug.",
			parameters: PlaceOrderSchema,
			execute: handlePlaceOrder,
		});

		this.server.addTool({
			name: "place_market_order",
			description:
				"Place a market order (FOK or FAK) on Polymarket that executes immediately. You can specify either a market slug + outcome (YES/NO) for easy trading, or use a direct tokenId. The tool automatically fetches market details and tick size when using slug.",
			parameters: PlaceMarketOrderSchema,
			execute: handlePlaceMarketOrder,
		});

		this.server.addTool({
			name: "get_open_orders",
			description:
				"Get all open orders for the authenticated account. Can optionally filter by market.",
			parameters: GetOpenOrdersSchema,
			execute: handleGetOpenOrders,
		});

		this.server.addTool({
			name: "get_order",
			description: "Get details of a specific order by its ID.",
			parameters: GetOrderSchema,
			execute: handleGetOrder,
		});

		this.server.addTool({
			name: "cancel_order",
			description: "Cancel a specific order by its ID.",
			parameters: CancelOrderSchema,
			execute: handleCancelOrder,
		});

		this.server.addTool({
			name: "cancel_all_orders",
			description: "Cancel all open orders for the authenticated account.",
			parameters: CancelAllOrdersSchema,
			execute: handleCancelAllOrders,
		});

		this.server.addTool({
			name: "get_trade_history",
			description:
				"Get trade history for the authenticated account. Can optionally filter by market or maker address.",
			parameters: GetTradeHistorySchema,
			execute: handleGetTradeHistory,
		});
	}

	/**
	 * Register portfolio management tools
	 */
	private registerPortfolioTools(): void {
		this.server.addTool({
			name: "get_portfolio",
			description:
				"Get complete portfolio including wallet USDC balance, Polymarket balance, all open positions, and unrealized P&L.",
			parameters: GetPortfolioSchema,
			execute: handleGetPortfolio,
		});

		this.server.addTool({
			name: "get_balance_allowance",
			description:
				"Get balance and allowance information for the authenticated account. Can check COLLATERAL or CONDITIONAL tokens.",
			parameters: GetBalanceAllowanceSchema,
			execute: handleGetBalanceAllowance,
		});

		this.server.addTool({
			name: "update_balance_allowance",
			description:
				"Update balance and allowance for the authenticated account. Required before trading.",
			parameters: UpdateBalanceAllowanceSchema,
			execute: handleUpdateBalanceAllowance,
		});
	}

	/**
	 * Register token allowance management tools
	 */
	private registerAllowanceTools(): void {
		this.server.addTool({
			name: "check_token_allowances",
			description:
				"Check the current token allowances for USDC and Conditional Tokens. This shows if the contracts are approved to spend tokens on your behalf.",
			parameters: CheckTokenAllowancesSchema,
			execute: handleCheckTokenAllowances,
		});

		this.server.addTool({
			name: "set_token_allowances",
			description:
				"Set token allowances for USDC and Conditional Tokens. This must be called before you can trade. It approves the CTF and Exchange contracts to spend your tokens.",
			parameters: SetTokenAllowancesSchema,
			execute: handleSetTokenAllowances,
		});
	}
}
