// Polygon Mainnet Contract Addresses
export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
export const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
export const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// Contract ABIs
export const USDC_ABI = [
	"function balanceOf(address owner) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function decimals() view returns (uint8)",
];

export const CTF_ABI = [
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
	"function setApprovalForAll(address operator, bool approved) returns (bool)",
];

// API Endpoints
export const GAMMA_API_URL = "https://gamma-api.polymarket.com";
export const DATA_API_URL = "https://data-api.polymarket.com";
export const CLOB_HOST = "https://clob.polymarket.com";

// Default Configuration
export const DEFAULT_CHAIN_ID = 137; // Polygon mainnet
export const DEFAULT_SIGNATURE_TYPE = 0; // EOA (Externally Owned Account)
export const DEFAULT_TICK_SIZE = "0.01";
