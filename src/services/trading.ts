import type {
	BalanceAllowanceParams,
	OpenOrderParams,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { Contract, constants, providers, Wallet } from "ethers";

// Polygon mainnet addresses
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Tokens Framework
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // Polymarket Exchange

// Minimal ABIs needed for approvals
const USDC_ABI = [
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
];

const CTF_ABI = [
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
	"function setApprovalForAll(address operator, bool approved)",
];

/**
 * Interface for trading configuration
 */
export interface TradingConfig {
	privateKey: string;
	chainId?: number;
	funderAddress?: string;
	signatureType?: number;
	rpcUrl?: string;
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
		// Avoid re-initializing if already initialized
		if (this.client) return;
		// Use a provider-backed signer so we can submit on-chain approvals
		const rpcUrl =
			this.config.rpcUrl ||
			process.env.POLYMARKET_RPC_URL ||
			"https://polygon-rpc.com";
		const provider = new providers.JsonRpcProvider(rpcUrl);
		const ethersSigner = new Wallet(this.config.privateKey, provider);
		this.signer = ethersSigner;
		const host = "https://clob.polymarket.com";

		// Create API credentials first
		const creds = await new ClobClient(
			host,
			this.config.chainId || 137,
			ethersSigner,
			undefined,
			this.config.signatureType,
			this.config.funderAddress,
		).createOrDeriveApiKey();

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
	 * Ensure USDC and Conditional Tokens approvals are set for the Exchange
	 * - USDC allowance for CTF and Exchange (MaxUint256 if zero)
	 * - CTF setApprovalForAll for Exchange
	 */
	private async ensureAllowances(signer: Wallet): Promise<void> {
		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, signer);

		// Check current allowances/approvals
		const [usdcAllowanceCtf, usdcAllowanceExchange, ctfApprovedForExchange] =
			await Promise.all([
				usdc.allowance(signer.address, CTF_ADDRESS),
				usdc.allowance(signer.address, EXCHANGE_ADDRESS),
				ctf.isApprovedForAll(signer.address, EXCHANGE_ADDRESS),
			]);

		// Approve USDC for CTF if needed
		if (usdcAllowanceCtf.isZero()) {
			const tx = await usdc.approve(CTF_ADDRESS, constants.MaxUint256);
			await tx.wait();
		}

		// Approve USDC for Exchange if needed
		if (usdcAllowanceExchange.isZero()) {
			const tx = await usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256);
			await tx.wait();
		}

		// Approve CTF for Exchange if needed
		if (!ctfApprovedForExchange) {
			const tx = await ctf.setApprovalForAll(EXCHANGE_ADDRESS, true);
			await tx.wait();
		}
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
		// Ensure on-chain approvals before submitting a write order
		await this.ensureAllowances(this.getSigner());

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
		// Ensure on-chain approvals before submitting a write order
		await this.ensureAllowances(this.getSigner());

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

		const client = this.getClient();
		return client.createAndPostMarketOrder(
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
		const client = this.getClient();
		return client.cancelOrder({ orderID: orderId });
	}

	/**
	 * Cancel all open orders
	 */
	async cancelAllOrders(): Promise<unknown> {
		await this.ensureInitialized();
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
		const client = this.getClient();
		return client.getBalanceAllowance(params);
	}

	/**
	 * Update balance and allowance
	 */
	async updateBalanceAllowance(params?: BalanceAllowanceParams): Promise<void> {
		await this.ensureInitialized();
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
