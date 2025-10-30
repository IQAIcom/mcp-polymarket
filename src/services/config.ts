// Centralized configuration for Polymarket services (market data + trading)
// Reads environment variables with sensible defaults and allows per-call overrides.

export type BaseConfig = {
	// CLOB API base URL
	host: string;
	// EVM chain id (Polygon mainnet default)
	chainId: number;
	// Signature type for CLOB auth (0 = EOA)
	signatureType: number;
	// RPC endpoint used for on-chain approvals/transactions
	rpcUrl: string;
	// Optional creds for authenticated calls
	privateKey?: string;
	funderAddress?: string;
};

// Polygon mainnet addresses
export const POLYGON_ADDRESSES = {
	USDC_ADDRESS: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
	CTF_ADDRESS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", // Conditional Tokens Framework
	EXCHANGE_ADDRESS: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // Polymarket Exchange
} as const;

export function getConfig(overrides: Partial<BaseConfig> = {}): BaseConfig {
	const host =
		overrides.host ??
		process.env.CLOB_API_BASE ??
		"https://clob.polymarket.com";

	const chainId = Number(
		overrides.chainId ?? process.env.CHAIN_ID ?? 137, // Polygon mainnet
	);

	const signatureType = Number(
		overrides.signatureType ?? process.env.SIGNATURE_TYPE ?? 0, // Align with trading (EOA)
	);

	const rpcUrl =
		overrides.rpcUrl ??
		process.env.POLYMARKET_RPC_URL ??
		"https://polygon-rpc.com";

	const privateKey = overrides.privateKey ?? process.env.POLYMARKET_PRIVATE_KEY;
	const funderAddress =
		overrides.funderAddress ?? process.env.POLYMARKET_FUNDER;

	return {
		host,
		chainId,
		signatureType,
		rpcUrl,
		privateKey,
		funderAddress,
	};
}
