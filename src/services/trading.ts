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
 * Interface for market information from Gamma API
 */
export interface MarketInfo {
	question: string;
	slug: string;
	endDate: string;
	clobTokenIds: string[];
	tickSize: string;
}

/**
 * Interface for resolved market details
 */
export interface ResolvedMarketDetails {
	tokenId: string;
	tickSize: string;
	marketInfo: MarketInfo | null;
	outcome?: "YES" | "NO";
}

/**
 * Interface for place order arguments
 */
export interface PlaceOrderArgs {
	marketSlug?: string;
	outcome?: "YES" | "NO";
	tokenId?: string;
	price: number;
	size: number;
	side: "BUY" | "SELL";
	orderType?: "GTC" | "GTD";
	tickSize?: string;
}

/**
 * Interface for place market order arguments
 */
export interface PlaceMarketOrderArgs {
	marketSlug?: string;
	outcome?: "YES" | "NO";
	tokenId?: string;
	amount: number;
	side: "BUY" | "SELL";
	orderType?: "FOK" | "FAK";
	tickSize?: string;
}

/**
 * Interface for order response
 */
export interface OrderResponse {
	status: string;
	market: MarketInfo | null;
	orderResponse: unknown;
	orderDetails: {
		outcome: string;
		tokenId: string;
		side: string;
		orderType: string;
		tickSize: string;
		inputMethod: string;
		price?: number;
		size?: number;
		totalCost?: string;
		amount?: number;
	};
	timestamp: string;
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
	 * Resolve market details from slug or use direct tokenId
	 * @private
	 */
	private async resolveMarketDetails(
		marketSlug?: string,
		outcome?: "YES" | "NO",
		tokenId?: string,
		tickSize?: string,
	): Promise<ResolvedMarketDetails> {
		// Validate that we have either tokenId OR (marketSlug + outcome)
		if (!tokenId && (!marketSlug || !outcome)) {
			throw new Error(
				"Either provide tokenId directly, or provide both marketSlug and outcome",
			);
		}

		if (tokenId) {
			// Direct tokenId provided
			return {
				tokenId,
				tickSize: tickSize || "0.01",
				marketInfo: null,
			};
		}

		// Fetch market details from Gamma API
		console.log(`Fetching market details for: ${marketSlug}`);
		const response = await fetch(
			`https://gamma-api.polymarket.com/markets?slug=${marketSlug}`,
		);
		const markets = await response.json();

		if (!markets || markets.length === 0) {
			throw new Error(`Market not found: ${marketSlug}`);
		}

		const market = markets[0];
		const tokenIds = JSON.parse(market.clobTokenIds);
		const resolvedTokenId = outcome === "YES" ? tokenIds[0] : tokenIds[1];
		const resolvedTickSize = market.orderPriceMinTickSize.toString();

		const marketInfo: MarketInfo = {
			question: market.question,
			slug: marketSlug!,
			endDate: market.endDate,
			clobTokenIds: tokenIds,
			tickSize: resolvedTickSize,
		};

		console.log(`Market: ${market.question}`);
		console.log(`Token ID (${outcome}): ${resolvedTokenId}`);
		console.log(`Tick Size: ${resolvedTickSize}`);

		return {
			tokenId: resolvedTokenId,
			tickSize: resolvedTickSize,
			marketInfo,
			outcome,
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
	 * Place a new order with support for market slug or direct tokenId
	 */
	async placeOrder(args: PlaceOrderArgs): Promise<OrderResponse> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		// Resolve market details
		const resolved = await this.resolveMarketDetails(
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
				tickSize: resolved.tickSize as any,
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
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		// Resolve market details
		const resolved = await this.resolveMarketDetails(
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
				tickSize: resolved.tickSize as any,
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

	/**
	 * Get complete portfolio including wallet balance and positions
	 */
	async getPortfolio(): Promise<unknown> {
		if (!this.client) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			// Get USDC balance from wallet
			const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.provider);
			const balance = await usdc.balanceOf(this.signer.address);
			const decimals = await usdc.decimals();
			const balanceFormatted = utils.formatUnits(balance, decimals);

			// Get Polymarket balance
			let polymarketBalance: string;
			try {
				const balanceData = await this.client.getBalanceAllowance({
					asset_type: "COLLATERAL" as any,
				});
				polymarketBalance = (balanceData as any).balance;
			} catch (error) {
				polymarketBalance = "Unable to fetch";
			}

			// Get positions from Polymarket Data API
			let positions: any[] = [];
			let positionsError: string | null = null;
			try {
				const response = await fetch(
					`https://data-api.polymarket.com/positions?sizeThreshold=1&limit=50&sortDirection=DESC&user=${this.signer.address}`,
				);
				const positionsData = await response.json();
				positions = positionsData || [];
			} catch (error) {
				positionsError = (error as Error).message;
				positions = [];
			}

			// Calculate portfolio summary
			let totalPositionValue = 0;
			let totalUnrealizedPnL = 0;

			if (Array.isArray(positions)) {
				for (const position of positions) {
					if (position.size && position.price) {
						totalPositionValue +=
							Number.parseFloat(position.size) *
							Number.parseFloat(position.price);
					}
					if (position.unrealizedPnl) {
						totalUnrealizedPnL += Number.parseFloat(position.unrealizedPnl);
					}
				}
			}

			return {
				status: "success",
				portfolio: {
					walletAddress: this.signer.address,
					balances: {
						usdcWalletBalance: balanceFormatted,
						usdcPolymarketBalance: polymarketBalance,
						totalLiquidBalance:
							polymarketBalance !== "Unable to fetch"
								? (
										Number.parseFloat(balanceFormatted) +
										Number.parseFloat(polymarketBalance)
									).toFixed(6)
								: "Unable to calculate",
					},
					positionsSummary: {
						totalPositions: Array.isArray(positions) ? positions.length : 0,
						totalPositionValue: totalPositionValue.toFixed(4),
						totalUnrealizedPnL: totalUnrealizedPnL.toFixed(4),
						positionsError: positionsError,
					},
					positions: positions,
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			throw new Error(`Failed to get portfolio: ${(error as Error).message}`);
		}
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
