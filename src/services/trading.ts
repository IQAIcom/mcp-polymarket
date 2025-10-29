import type {
	BalanceAllowanceParams,
	OpenOrderParams,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { Wallet } from "ethers";

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
		const ethersSigner = new Wallet(this.config.privateKey);
		const host = "https://clob.polymarket.com";

		// Create API credentials first
		const tempClient = new ClobClient(
			host,
			this.config.chainId || 137,
			ethersSigner,
			undefined,
			this.config.signatureType,
			this.config.funderAddress,
		);

		const creds = await tempClient.createOrDeriveApiKey();

		// Create client with credentials
		this.client = new ClobClient(
			host,
			this.config.chainId || 137,
			ethersSigner,
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

		// Validate and convert order type
		const orderTypeStr = args.orderType || "GTC";
		const orderType: OrderType.GTC | OrderType.GTD =
			orderTypeStr === "GTD" ? OrderType.GTD : OrderType.GTC;

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
			orderType,
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

		// Validate and convert order type
		const orderTypeStr = args.orderType || "FOK";
		const orderType: OrderType.FOK | OrderType.FAK =
			orderTypeStr === "FAK" ? OrderType.FAK : OrderType.FOK;

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
			orderType,
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

// Singleton instance for trading
let tradingInstance: PolymarketTrading | null = null;

/**
 * Get or create the trading instance
 */
export function getTradingInstance(): PolymarketTrading {
	if (!tradingInstance) {
		const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
		if (!privateKey) {
			throw new Error(
				"POLYMARKET_PRIVATE_KEY environment variable is required for trading operations",
			);
		}

		tradingInstance = new PolymarketTrading({ privateKey });
	}
	return tradingInstance;
}

/**
 * Initialize the trading client (must be called before trading operations)
 */
export async function initializeTrading(): Promise<void> {
	const instance = getTradingInstance();
	await instance.initialize();
}
