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
let initializationPromise: Promise<void> | null = null;
let allowanceService: AllowanceService;
let orderService: OrderService;
let portfolioService: PortfolioService;

/**
 * Initialize all trading services (lazy initialization)
 * This is called automatically when any service is accessed
 */
async function initializeTradingServices(): Promise<void> {
	// If already initializing or initialized, return the existing promise
	if (initializationPromise) return initializationPromise;

	initializationPromise = (async () => {
		const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
		if (!privateKey) {
			throw new Error(
				"POLYMARKET_PRIVATE_KEY environment variable is required",
			);
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
	})();

	return initializationPromise;
}

/**
 * Get the allowance service instance
 * Automatically initializes services on first access
 */
export async function getAllowanceService(): Promise<AllowanceService> {
	await initializeTradingServices();
	return allowanceService;
}

/**
 * Get the order service instance
 * Automatically initializes services on first access
 */
export async function getOrderService(): Promise<OrderService> {
	await initializeTradingServices();
	return orderService;
}

/**
 * Get the portfolio service instance
 * Automatically initializes services on first access
 */
export async function getPortfolioService(): Promise<PortfolioService> {
	await initializeTradingServices();
	return portfolioService;
}

// Re-export services and types
export { AllowanceService } from "./allowance.service.js";
export { OrderService } from "./order.service.js";
export { PortfolioService } from "./portfolio.service.js";
export { MarketResolverService } from "./market-resolver.service.js";
export * from "./types.js";
export * from "./constants.js";
