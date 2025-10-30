import axios, { type AxiosInstance } from "axios";
import { CLOB_HOST, DATA_API_URL, GAMMA_API_URL } from "./constants.js";

/**
 * Configuration for Polymarket API clients
 */
export interface APIConfig {
	gammaApiBase?: string;
	clobApiBase?: string;
	dataApiBase?: string;
	timeout?: number;
}

/**
 * Class to handle Polymarket API requests using axios
 */
export class PolymarketAPI {
	private gammaApi: AxiosInstance;
	private dataApi: AxiosInstance;
	private clobApi: AxiosInstance;

	constructor(config: APIConfig = {}) {
		const timeout = config.timeout || 30000;

		// Gamma Markets API - for market discovery and metadata
		this.gammaApi = axios.create({
			baseURL:
				config.gammaApiBase || process.env.GAMMA_API_BASE || GAMMA_API_URL,
			timeout,
			headers: {
				"Content-Type": "application/json",
			},
		});

		// Data API - for user data, holdings, and activities
		this.dataApi = axios.create({
			baseURL: config.dataApiBase || process.env.DATA_API_BASE || DATA_API_URL,
			timeout,
			headers: {
				"Content-Type": "application/json",
			},
		});

		// CLOB API - for order book and trading data
		this.clobApi = axios.create({
			baseURL: config.clobApiBase || process.env.CLOB_API_BASE || CLOB_HOST,
			timeout,
			headers: {
				"Content-Type": "application/json",
			},
		});

		// Add response interceptors for error handling
		this.setupInterceptors();
	}

	private setupInterceptors() {
		const responseInterceptor = (response: any) => response;
		const errorInterceptor = (error: any) => {
			if (error.response) {
				// Server responded with error status
				const { status, data } = error.response;
				throw new Error(
					`API Error ${status}: ${data?.message || data?.error || "Unknown error"}`,
				);
			}
			if (error.request) {
				// Request was made but no response received
				throw new Error("Network error: No response from server");
			}
			// Something else happened
			throw new Error(`Request error: ${error.message}`);
		};

		this.gammaApi.interceptors.response.use(
			responseInterceptor,
			errorInterceptor,
		);
		this.dataApi.interceptors.response.use(
			responseInterceptor,
			errorInterceptor,
		);
		this.clobApi.interceptors.response.use(
			responseInterceptor,
			errorInterceptor,
		);
	}

	/**
	 * Get markets from Gamma API
	 */
	async getMarkets(params: Record<string, any> = {}) {
		const response = await this.gammaApi.get("/markets", { params });
		return response.data;
	}

	/**
	 * Get events from Gamma API
	 */
	async getEvents(params: Record<string, any> = {}) {
		const response = await this.gammaApi.get("/events", { params });
		return response.data;
	}

	/**
	 * Get all tags from Gamma API
	 */
	async getTags() {
		const response = await this.gammaApi.get("/tags");
		return response.data;
	}

	/**
	 * Get user positions from Data API
	 */
	async getUserPositions(user: string, params: Record<string, any> = {}) {
		const response = await this.dataApi.get("/positions", {
			params: { user, ...params },
		});
		return response.data;
	}

	/**
	 * Get user activity from Data API
	 */
	async getUserActivity(user: string, params: Record<string, any> = {}) {
		const response = await this.dataApi.get("/activity", {
			params: { user, ...params },
		});
		return response.data;
	}

	/**
	 * Get market holders from Data API
	 */
	async getMarketHolders(token: string, params: Record<string, any> = {}) {
		const response = await this.dataApi.get("/holders", {
			params: { token, ...params },
		});
		return response.data;
	}

	/**
	 * Get trades from Data API
	 */
	async getTrades(params: Record<string, any> = {}) {
		const response = await this.dataApi.get("/trades", { params });
		return response.data;
	}

	/**
	 * Get order book from CLOB API
	 */
	async getOrderBook(tokenId: string, params: Record<string, any> = {}) {
		const response = await this.clobApi.get("/book", {
			params: { token_id: tokenId, ...params },
		});
		return response.data;
	}

	/**
	 * Get market prices from CLOB API
	 */
	async getMarketPrices(params: Record<string, any> = {}) {
		const response = await this.clobApi.get("/prices", { params });
		return response.data;
	}
}

// Singleton instance for API client
let apiInstance: PolymarketAPI | null = null;

/**
 * Get or create the API instance
 */
export function getAPIInstance(): PolymarketAPI {
	if (!apiInstance) {
		apiInstance = new PolymarketAPI();
	}
	return apiInstance;
}
