import { ClobClient } from "@polymarket/clob-client";
import { providers, Wallet } from "ethers";
import { AllowanceService } from "./allowance.service.js";
import {
	CLOB_HOST,
	DEFAULT_CHAIN_ID,
	DEFAULT_SIGNATURE_TYPE,
} from "./constants.js";
import { OrderService } from "./order.service.js";
import { PortfolioService } from "./portfolio.service.js";

/**
 * Service container that manages service lifecycle and dependencies
 * Follows Dependency Injection and Single Responsibility principles
 */
export class ServiceContainer {
	private static instance: ServiceContainer | null = null;
	private initializationPromise: Promise<void> | null = null;

	private allowanceService?: AllowanceService;
	private orderService?: OrderService;
	private portfolioService?: PortfolioService;

	private constructor() {}

	/**
	 * Get or create the singleton instance
	 */
	static getInstance(): ServiceContainer {
		if (!ServiceContainer.instance) {
			ServiceContainer.instance = new ServiceContainer();
		}
		return ServiceContainer.instance;
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		ServiceContainer.instance = null;
	}

	/**
	 * Initialize all services with proper dependencies
	 */
	private async initialize(): Promise<void> {
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.doInitialize();
		return this.initializationPromise;
	}

	private async doInitialize(): Promise<void> {
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
		this.allowanceService = new AllowanceService(signer);
		await this.allowanceService.setAllowances();

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

		// Initialize services with their dependencies
		this.orderService = new OrderService(client);
		this.portfolioService = new PortfolioService(client, signer, provider);
	}

	/**
	 * Get the allowance service instance
	 */
	async getAllowanceService(): Promise<AllowanceService> {
		await this.initialize();
		if (!this.allowanceService) {
			throw new Error("AllowanceService not initialized");
		}
		return this.allowanceService;
	}

	/**
	 * Get the order service instance
	 */
	async getOrderService(): Promise<OrderService> {
		await this.initialize();
		if (!this.orderService) {
			throw new Error("OrderService not initialized");
		}
		return this.orderService;
	}

	/**
	 * Get the portfolio service instance
	 */
	async getPortfolioService(): Promise<PortfolioService> {
		await this.initialize();
		if (!this.portfolioService) {
			throw new Error("PortfolioService not initialized");
		}
		return this.portfolioService;
	}
}
