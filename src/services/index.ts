import { ClobClient } from "@polymarket/clob-client";
import { providers, Wallet } from "ethers";
import { AllowanceService } from "./allowance.service.js";
import { OrderService } from "./order.service.js";
import { PortfolioService } from "./portfolio.service.js";
import {
	CLOB_HOST,
	DEFAULT_CHAIN_ID,
	DEFAULT_SIGNATURE_TYPE,
} from "./constants.js";

// Shared state
let isInitialized = false;
let allowanceService: AllowanceService;
let orderService: OrderService;
let portfolioService: PortfolioService;

/**
 * Initialize all trading services
 * Call this once before using any services
 */
export async function initializeTradingServices(): Promise<void> {
	if (isInitialized) return;

	const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
	if (!privateKey) {
		throw new Error("POLYMARKET_PRIVATE_KEY environment variable is required");
	}

	// Setup provider and signer
	const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
	const provider = new providers.JsonRpcProvider(rpcUrl);
	const signer = new Wallet(privateKey, provider);

	// Initialize allowance service and set allowances
	allowanceService = new AllowanceService(signer);
	await allowanceService.setAllowances();

	// Create authenticated CLOB client
	const tempClient = new ClobClient(
		CLOB_HOST,
		DEFAULT_CHAIN_ID,
		signer,
		undefined,
		DEFAULT_SIGNATURE_TYPE,
	);
	const creds = await tempClient.createOrDeriveApiKey();
	const client = new ClobClient(
		CLOB_HOST,
		DEFAULT_CHAIN_ID,
		signer,
		creds,
		DEFAULT_SIGNATURE_TYPE,
	);

	// Initialize services
	orderService = new OrderService(client);
	portfolioService = new PortfolioService(client, signer, provider);

	isInitialized = true;
}

/**
 * Get the allowance service instance
 */
export function getAllowanceService(): AllowanceService {
	if (!isInitialized) {
		throw new Error(
			"Services not initialized. Call initializeTradingServices() first.",
		);
	}
	return allowanceService;
}

/**
 * Get the order service instance
 */
export function getOrderService(): OrderService {
	if (!isInitialized) {
		throw new Error(
			"Services not initialized. Call initializeTradingServices() first.",
		);
	}
	return orderService;
}

/**
 * Get the portfolio service instance
 */
export function getPortfolioService(): PortfolioService {
	if (!isInitialized) {
		throw new Error(
			"Services not initialized. Call initializeTradingServices() first.",
		);
	}
	return portfolioService;
}

// Re-export services and types
export { AllowanceService } from "./allowance.service.js";
export { OrderService } from "./order.service.js";
export { PortfolioService } from "./portfolio.service.js";
export { MarketResolverService } from "./market-resolver.service.js";
export * from "./types.js";
export * from "./constants.js";
