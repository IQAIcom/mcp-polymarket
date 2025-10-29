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
