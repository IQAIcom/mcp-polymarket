import type {
	BalanceAllowanceParams,
	OpenOrderParams,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { providers, Wallet } from "ethers";
import { PolymarketApprovals } from "./approvals.js";
import { getConfig } from "./config.js";

// Minimal ABIs needed for approvals
// ABIs moved to approvals service; nothing needed here.

/**
 * Interface for trading configuration
 */
export interface TradingConfig {
	privateKey: string;
	chainId?: number;
	funderAddress?: string;
	signatureType?: number;
	rpcUrl?: string;
	host?: string;
}

/**
 * Class to handle Polymarket trading operations
 */
export class PolymarketTrading {
	private client: ClobClient | null = null;
	private initPromise: Promise<void> | null = null;
	private signer: Wallet | null = null;
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
		if (this.client) return;
		const cfg = getConfig(this.config);
		const provider = new providers.JsonRpcProvider(cfg.rpcUrl);
		const ethersSigner = new Wallet(this.config.privateKey, provider);
		this.signer = ethersSigner;
		const host = cfg.host;

		// Create API credentials first
		const creds = await new ClobClient(
			host,
			cfg.chainId || 137,
			ethersSigner,
			undefined,
			cfg.signatureType,
			cfg.funderAddress,
		).createOrDeriveApiKey();

		// Create client with credentials
		this.client = new ClobClient(
			host,
			cfg.chainId || 137,
			ethersSigner,
			creds,
			cfg.signatureType,
			cfg.funderAddress,
		);
	}

	/**
	 * Ensures the client is initialized (lazy-init on first use).
	 * Safe to call multiple times; concurrent calls share the same promise.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.client) return;
		if (!this.initPromise) {
			this.initPromise = this.initialize().catch((err) => {
				// Reset so future attempts can retry after a failure
				this.initPromise = null;
				throw err;
			});
		}
		await this.initPromise;
	}

	/** Returns the initialized client or throws if not ready (should be called after ensureInitialized). */
	private getClient(): ClobClient {
		if (!this.client) {
			throw new Error("Client not initialized");
		}
		return this.client;
	}

	/** Returns the signer or throws if not ready (should be set during initialize). */
	private getSigner(): Wallet {
		if (!this.signer) {
			throw new Error("Signer not initialized");
		}
		return this.signer;
	}

	/**
	 * Throw a structured error if approvals are missing.
	 */
	private async assertApprovals(): Promise<void> {
		const approvals = new PolymarketApprovals(this.getSigner());
		await approvals.assertApproved();
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
		await this.ensureInitialized();
		await this.assertApprovals();

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;

		const orderTypeStr = args.orderType || "GTC";
		const orderType: OrderType.GTC | OrderType.GTD =
			orderTypeStr === "GTD" ? OrderType.GTD : OrderType.GTC;

		const userOrder: UserOrder = {
			tokenID: args.tokenId,
			price: args.price,
			size: args.size,
			side: side,
		};

		const client = this.getClient();
		return client.createAndPostOrder(
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
		await this.ensureInitialized();
		await this.assertApprovals();

		const side: Side = args.side === "BUY" ? Side.BUY : Side.SELL;

		const orderTypeStr = args.orderType || "FOK";
		const orderType: OrderType.FOK | OrderType.FAK =
			orderTypeStr === "FAK" ? OrderType.FAK : OrderType.FOK;

		const userMarketOrder = {
			tokenID: args.tokenId,
			amount: args.amount,
			side: side,
		};

		const client = this.getClient();
		return client.createAndPostMarketOrder(
			userMarketOrder,
			{
				tickSize: "0.001",
				negRisk: true,
			},
			orderType,
		);
	}

	/**
	 * Get all open orders
	 */
	async getOpenOrders(params?: OpenOrderParams): Promise<unknown> {
		await this.ensureInitialized();
		const client = this.getClient();
		return client.getOpenOrders(params);
	}

	/**
	 * Get a specific order by ID
	 */
	async getOrder(orderId: string): Promise<unknown> {
		await this.ensureInitialized();
		const client = this.getClient();
		return client.getOrder(orderId);
	}

	/**
	 * Cancel a specific order by ID
	 */
	async cancelOrder(orderId: string): Promise<unknown> {
		await this.ensureInitialized();
		await this.assertApprovals();
		const client = this.getClient();
		return client.cancelOrder({ orderID: orderId });
	}

	/**
	 * Cancel all open orders
	 */
	async cancelAllOrders(): Promise<unknown> {
		await this.ensureInitialized();
		await this.assertApprovals();
		const client = this.getClient();
		return client.cancelAll();
	}

	/**
	 * Get trade history
	 */
	async getTradeHistory(params?: TradeParams): Promise<unknown> {
		await this.ensureInitialized();
		const client = this.getClient();
		return client.getTrades(params);
	}

	/**
	 * Get balance and allowance information
	 */
	async getBalanceAllowance(params?: BalanceAllowanceParams): Promise<unknown> {
		await this.ensureInitialized();
		await this.assertApprovals();
		const client = this.getClient();
		return client.getBalanceAllowance(params);
	}

	/**
	 * Update balance and allowance
	 */
	async updateBalanceAllowance(params?: BalanceAllowanceParams): Promise<void> {
		await this.ensureInitialized();
		await this.assertApprovals();
		const client = this.getClient();
		return client.updateBalanceAllowance(params);
	}
}

// Singleton instance for trading
let tradingInstance: PolymarketTrading | null = null;

/**
 * Get or create the trading instance
 */
export function getTradingInstance(): PolymarketTrading {
	if (!tradingInstance) {
		const cfg = getConfig();
		if (!cfg.privateKey) {
			throw new Error(
				"POLYMARKET_PRIVATE_KEY environment variable is required for trading operations",
			);
		}

		tradingInstance = new PolymarketTrading({
			privateKey: cfg.privateKey,
			chainId: cfg.chainId,
			signatureType: cfg.signatureType,
			funderAddress: cfg.funderAddress,
			rpcUrl: cfg.rpcUrl,
			host: cfg.host,
		});
	}
	return tradingInstance;
}

// Lazy proxy facade for easy consumption without triggering env checks at import time
// Usage: await tradeApi.getOrder("...")
export const tradeApi: PolymarketTrading = new Proxy({} as PolymarketTrading, {
	get(_target, prop, _receiver) {
		const instance = getTradingInstance() as unknown as Record<
			string | symbol,
			unknown
		>;
		const value = instance[prop as keyof PolymarketTrading] as unknown;
		if (typeof value === "function") {
			return value.bind(instance);
		}
		return value;
	},
});
