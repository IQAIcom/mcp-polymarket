import type {
	BalanceAllowanceParams,
	OpenOrderParams,
	TradeParams,
	UserOrder,
} from "@polymarket/clob-client";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { Contract, constants, providers, utils, Wallet } from "ethers";

// Polygon Mainnet Contract Addresses
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// Contract ABIs
const USDC_ABI = [
	"function balanceOf(address owner) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function decimals() view returns (uint8)",
];

const CTF_ABI = [
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
	"function setApprovalForAll(address operator, bool approved) returns (bool)",
];

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
 * Interface for allowance check result
 */
export interface AllowanceStatus {
	usdcAllowanceCtf: string;
	usdcAllowanceExchange: string;
	conditionalTokensAllowanceExchange: boolean;
}

/**
 * Interface for allowance setting result
 */
export interface SetAllowanceResult {
	success: boolean;
	transactions: string[];
	message: string;
}

/**
 * Class to handle Polymarket trading operations
 */
export class PolymarketTrading {
	private client: ClobClient | null = null;
	private config: TradingConfig;
	private signer: Wallet;
	private provider: providers.JsonRpcProvider;

	constructor(config: TradingConfig) {
		this.config = {
			chainId: 137, // Polygon mainnet
			signatureType: 0, // EOA (Externally Owned Account)
			...config,
		};
		// Use public Polygon RPC - users can override by setting POLYGON_RPC_URL env var
		const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
		this.provider = new providers.JsonRpcProvider(rpcUrl);
		this.signer = new Wallet(this.config.privateKey, this.provider);
	}

	/**
	 * Check current allowance status
	 */
	async checkAllowances(): Promise<AllowanceStatus> {
		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		const usdcAllowanceCtf = await usdc.allowance(
			this.signer.address,
			CTF_ADDRESS,
		);
		const usdcAllowanceExchange = await usdc.allowance(
			this.signer.address,
			EXCHANGE_ADDRESS,
		);
		const conditionalTokensAllowanceExchange = await ctf.isApprovedForAll(
			this.signer.address,
			EXCHANGE_ADDRESS,
		);

		return {
			usdcAllowanceCtf: usdcAllowanceCtf.toString(),
			usdcAllowanceExchange: usdcAllowanceExchange.toString(),
			conditionalTokensAllowanceExchange,
		};
	}

	/**
	 * Set necessary allowances for trading
	 * This needs to be called before trading operations can work
	 */
	async setAllowances(): Promise<SetAllowanceResult> {
		try {
			console.log("Checking and setting allowances...");

			const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
			const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

			const usdcAllowanceCtf = await usdc.allowance(
				this.signer.address,
				CTF_ADDRESS,
			);
			const usdcAllowanceExchange = await usdc.allowance(
				this.signer.address,
				EXCHANGE_ADDRESS,
			);
			const conditionalTokensAllowanceExchange = await ctf.isApprovedForAll(
				this.signer.address,
				EXCHANGE_ADDRESS,
			);

			const transactions: string[] = [];

			// Set USDC allowance for CTF if needed
			if (usdcAllowanceCtf.eq(0)) {
				console.log("Setting USDC allowance for CTF...");
				const txn = await usdc.approve(CTF_ADDRESS, constants.MaxUint256, {
					gasPrice: utils.parseUnits("100", "gwei"),
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`CTF allowance: ${txn.hash}`);
			}

			// Set USDC allowance for Exchange if needed
			if (usdcAllowanceExchange.eq(0)) {
				console.log("Setting USDC allowance for Exchange...");
				const txn = await usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256, {
					gasPrice: utils.parseUnits("100", "gwei"),
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`Exchange allowance: ${txn.hash}`);
			}

			// Set Conditional Tokens approval for Exchange if needed
			if (!conditionalTokensAllowanceExchange) {
				console.log("Setting Conditional Tokens approval for Exchange...");
				const txn = await ctf.setApprovalForAll(EXCHANGE_ADDRESS, true, {
					gasPrice: utils.parseUnits("100", "gwei"),
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`CTF approval: ${txn.hash}`);
			}

			return {
				success: true,
				transactions,
				message:
					transactions.length > 0
						? "Allowances set successfully"
						: "All allowances already sufficient",
			};
		} catch (error) {
			console.error("Error setting allowances:", error);
			throw error;
		}
	}

	/**
	 * Initialize the CLOB client with credentials
	 * Automatically sets allowances if needed
	 */
	async initialize(): Promise<void> {
		const host = "https://clob.polymarket.com";

		// Set allowances first
		await this.setAllowances();

		// Create API credentials first
		const tempClient = new ClobClient(
			host,
			this.config.chainId || 137,
			this.signer,
			undefined,
			this.config.signatureType,
			this.config.funderAddress,
		);

		const creds = await tempClient.createOrDeriveApiKey();

		// Create client with credentials
		this.client = new ClobClient(
			host,
			this.config.chainId || 137,
			this.signer,
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
