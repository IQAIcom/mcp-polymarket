import type { AllowanceService } from "./allowance.service.js";
import type { OrderService } from "./order.service.js";
import type { PortfolioService } from "./portfolio.service.js";
import { ServiceContainer } from "./service-container.js";

/**
 * Get the allowance service instance
 * Automatically initializes services on first access
 */
export async function getAllowanceService(): Promise<AllowanceService> {
	const container = ServiceContainer.getInstance();
	return container.getAllowanceService();
}

/**
 * Get the order service instance
 * Automatically initializes services on first access
 */
export async function getOrderService(): Promise<OrderService> {
	const container = ServiceContainer.getInstance();
	return container.getOrderService();
}

/**
 * Get the portfolio service instance
 * Automatically initializes services on first access
 */
export async function getPortfolioService(): Promise<PortfolioService> {
	const container = ServiceContainer.getInstance();
	return container.getPortfolioService();
}

// Re-export services and types
export { AllowanceService } from "./allowance.service.js";
export * from "./constants.js";
export { MarketResolverService } from "./market-resolver.service.js";
export { OrderService } from "./order.service.js";
export { PortfolioService } from "./portfolio.service.js";
export * from "./types.js";
