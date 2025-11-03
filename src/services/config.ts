export type BaseConfig = {
	host: string;
	chainId: number;
	signatureType: number;
	rpcUrl: string;
	privateKey?: string;
	funderAddress?: string;
};

export const POLYGON_ADDRESSES = {
	USDC_ADDRESS: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
	CTF_ADDRESS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", // Conditional Tokens Framework
	EXCHANGE_ADDRESS: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // Polymarket Exchange
	NEG_RISK_EXCHANGE_ADDRESS: "0xC5d563A36AE78145C45a50134d48A1215220f80a", // NegRisk Exchange
	NEG_RISK_ADAPTER_ADDRESS: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296", // NegRisk Adapter
} as const;

/**
 * Builds configuration from environment variables and optional overrides.
 */
export function getConfig(overrides: Partial<BaseConfig> = {}): BaseConfig {
	const host =
		overrides.host ??
		process.env.CLOB_API_BASE ??
		"https://clob.polymarket.com";

	const chainId = Number(overrides.chainId ?? process.env.CHAIN_ID ?? 137);

	const signatureType = Number(
		overrides.signatureType ?? process.env.SIGNATURE_TYPE ?? 2,
	);

	const rpcUrl =
		overrides.rpcUrl ??
		process.env.POLYMARKET_RPC_URL ??
		"https://polygon-rpc.com";

	const privateKey = overrides.privateKey ?? process.env.POLYMARKET_PRIVATE_KEY;
	const funderAddress =
		overrides.funderAddress ??
		process.env.POLYMARKET_FUNDER ??
		process.env.FUNDER_ADDRESS;

	return {
		host,
		chainId,
		signatureType,
		rpcUrl,
		privateKey,
		funderAddress,
	};
}
