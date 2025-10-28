import { Wallet } from "@ethersproject/wallet";
import type {
	BalanceAllowanceParams,
	OpenOrderParams,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";

/**
 * Interface for trading configuration
 */
export interface TradingConfig {
	privateKey: string;
	chainId?: number;
	funderAddress?: string;
	signatureType?: number;
}

/**
 * Class to handle Polymarket trading operations
 */
export class PolymarketTrading {
	private client: ClobClient | null = null;
	private config: TradingConfig;

	constructor(config: TradingConfig) {
		this.config = {
			chainId: 137, // Polygon mainnet
			signatureType: 0, // EOA (Externally Owned Account)
			...config,
		};
	}

	/**
	 * Initialize the CLOB client with credentials
	 */
	async initialize(): Promise<void> {
		const signer = new Wallet(this.config.privateKey);
		const host = "https://clob.polymarket.com";

		// Create API credentials first
		const tempClient = new ClobClient(
			host,
			this.config.chainId || 137,
			signer,
			undefined,
			this.config.signatureType,
			this.config.funderAddress,
		);

		const creds = await tempClient.createOrDeriveApiKey();

		// Create client with credentials
		this.client = new ClobClient(
			host,
			this.config.chainId || 137,
			signer,
			creds,
			this.config.signatureType,
			this.config.funderAddress,
		);
	}

	/**
	 * Place a new order
	 */
	async placeOrder(args: {
		tokenId: string;
		price: number;
		size: number;
		side: "BUY" | "SELL";
		orderType?: "GTC" | "GTD";
	}): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;
		const orderType: OrderType = OrderType[args.orderType || "GTC"];

		const userOrder: UserOrder = {
			tokenID: args.tokenId,
			price: args.price,
			size: args.size,
			side: side,
		};

		return this.client.createAndPostOrder(
			userOrder,
			{
				tickSize: "0.001",
				negRisk: false,
			},
			orderType as OrderType.GTC | OrderType.GTD,
		);
	}

	/**
	 * Place a market order (FOK or FAK)
	 */
	async placeMarketOrder(args: {
		tokenId: string;
		amount: number;
		side: "BUY" | "SELL";
		orderType?: "FOK" | "FAK";
	}): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;
		const orderType: OrderType = OrderType[args.orderType || "FOK"];

		const userMarketOrder = {
			tokenID: args.tokenId,
			amount: args.amount,
			side: side,
		};

		return this.client.createAndPostMarketOrder(
			userMarketOrder,
			{
				tickSize: "0.001",
				negRisk: false,
			},
			orderType as OrderType.FOK | OrderType.FAK,
		);
	}

	/**
	 * Get all open orders
	 */
	async getOpenOrders(params?: OpenOrderParams): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.getOpenOrders(params);
	}

	/**
	 * Get a specific order by ID
	 */
	async getOrder(orderId: string): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.getOrder(orderId);
	}

	/**
	 * Cancel a specific order by ID
	 */
	async cancelOrder(orderId: string): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.cancelOrder({ orderID: orderId });
	}

	/**
	 * Cancel all open orders
	 */
	async cancelAllOrders(): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.cancelAll();
	}

	/**
	 * Get trade history
	 */
	async getTradeHistory(params?: TradeParams): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.getTrades(params);
	}

	/**
	 * Get balance and allowance information
	 */
	async getBalanceAllowance(params?: BalanceAllowanceParams): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.getBalanceAllowance(params);
	}

	/**
	 * Update balance and allowance
	 */
	async updateBalanceAllowance(params?: BalanceAllowanceParams): Promise<void> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		return this.client.updateBalanceAllowance(params);
	}
}
