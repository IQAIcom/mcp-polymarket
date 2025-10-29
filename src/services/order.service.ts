import type {
	OpenOrderParams,
	TickSize,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import type {
	OrderResponse,
	PlaceMarketOrderArgs,
	PlaceOrderArgs,
} from "./types.js";
import { MarketResolverService } from "./market-resolver.service.js";

/**
 * Service to handle order operations
 */
export class OrderService {
	private marketResolver: MarketResolverService;

	constructor(private client: ClobClient) {
		this.marketResolver = new MarketResolverService();
	}

	/**
	 * Place a new order with support for market slug or direct tokenId
	 */
	async placeOrder(args: PlaceOrderArgs): Promise<OrderResponse> {
		// Resolve market details
		const resolved = await this.marketResolver.resolveMarketDetails(
			args.marketSlug,
			args.outcome,
			args.tokenId,
			args.tickSize,
		);

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;
		const orderTypeStr = args.orderType || "GTC";
		const orderType: OrderType.GTC | OrderType.GTD =
			orderTypeStr === "GTD" ? OrderType.GTD : OrderType.GTC;

		const userOrder: UserOrder = {
			tokenID: resolved.tokenId,
			price: args.price,
			size: args.size,
			side: side,
		};

		const orderResponse = await this.client.createAndPostOrder(
			userOrder,
			{
				tickSize: resolved.tickSize as TickSize,
				negRisk: false,
			},
			orderType,
		);

		return {
			status: "success",
			market: resolved.marketInfo,
			orderResponse,
			orderDetails: {
				outcome: resolved.outcome || "Unknown (using direct tokenId)",
				tokenId: resolved.tokenId,
				price: args.price,
				size: args.size,
				side: args.side,
				orderType: orderTypeStr,
				tickSize: resolved.tickSize,
				totalCost: (args.price * args.size).toFixed(4),
				inputMethod: args.tokenId ? "Direct tokenId" : "Market slug + outcome",
			},
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Place a market order (FOK or FAK) with support for market slug or direct tokenId
	 */
	async placeMarketOrder(args: PlaceMarketOrderArgs): Promise<OrderResponse> {
		// Resolve market details
		const resolved = await this.marketResolver.resolveMarketDetails(
			args.marketSlug,
			args.outcome,
			args.tokenId,
			args.tickSize,
		);

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;
		const orderTypeStr = args.orderType || "FOK";
		const orderType: OrderType.FOK | OrderType.FAK =
			orderTypeStr === "FAK" ? OrderType.FAK : OrderType.FOK;

		const userMarketOrder = {
			tokenID: resolved.tokenId,
			amount: args.amount,
			side: side,
		};

		const orderResponse = await this.client.createAndPostMarketOrder(
			userMarketOrder,
			{
				tickSize: resolved.tickSize as TickSize,
				negRisk: false,
			},
			orderType,
		);

		return {
			status: "success",
			market: resolved.marketInfo,
			orderResponse,
			orderDetails: {
				outcome: resolved.outcome || "Unknown (using direct tokenId)",
				tokenId: resolved.tokenId,
				amount: args.amount,
				side: args.side,
				orderType: orderTypeStr,
				tickSize: resolved.tickSize,
				inputMethod: args.tokenId ? "Direct tokenId" : "Market slug + outcome",
			},
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Get all open orders
	 */
	async getOpenOrders(params?: OpenOrderParams): Promise<unknown> {
		return this.client.getOpenOrders(params);
	}

	/**
	 * Get a specific order by ID
	 */
	async getOrder(orderId: string): Promise<unknown> {
		return this.client.getOrder(orderId);
	}

	/**
	 * Cancel a specific order by ID
	 */
	async cancelOrder(orderId: string): Promise<unknown> {
		return this.client.cancelOrder({ orderID: orderId });
	}

	/**
	 * Cancel all open orders
	 */
	async cancelAllOrders(): Promise<unknown> {
		return this.client.cancelAll();
	}

	/**
	 * Get trade history
	 */
	async getTradeHistory(params?: TradeParams): Promise<unknown> {
		return this.client.getTrades(params);
	}
}
