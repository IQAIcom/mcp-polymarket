/**
 * Configuration for Polymarket API clients
 */
export interface APIConfig {
	gammaApiBase?: string;
	clobApiBase?: string;
}

/**
 * Class to handle Polymarket API requests
 */
export class PolymarketAPI {
	private gammaApiBase: string;
	private clobApiBase: string;

	constructor(config: APIConfig = {}) {
		this.gammaApiBase =
			config.gammaApiBase ||
			process.env.GAMMA_API_BASE ||
			"https://gamma-api.polymarket.com";
		this.clobApiBase =
			config.clobApiBase ||
			process.env.CLOB_API_BASE ||
			"https://clob.polymarket.com";
	}

	/**
	 * Fetch data from the Gamma API
	 */
	async fetchGammaAPI(endpoint: string): Promise<unknown> {
		const url = `${this.gammaApiBase}${endpoint}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`Gamma API request failed: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	/**
	 * Fetch data from the CLOB API
	 */
	async fetchClobAPI(endpoint: string): Promise<unknown> {
		const url = `${this.clobApiBase}${endpoint}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`CLOB API request failed: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
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
