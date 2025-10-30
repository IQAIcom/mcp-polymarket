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
		// Use a provider-backed signer so we can submit on-chain approvals
		const rpcUrl =
			this.config.rpcUrl ||
			process.env.POLYMARKET_RPC_URL ||
			"https://polygon-rpc.com";
		const provider = new providers.JsonRpcProvider(rpcUrl);
		const ethersSigner = new Wallet(this.config.privateKey, provider);
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

		// Ensure necessary approvals are in place before trading
		await this.ensureAllowances(ethersSigner);

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
