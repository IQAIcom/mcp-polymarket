import {
	ClobClient,
	createSignerForProvider,
	OrderType,
	Side,
	type UserOrder,
} from "@dschz/polymarket-clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

async function main() {
	// Required env
	const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
	const FUNDER_ADDRESS = process.env.FUNDER_ADDRESS; // "0x831bd1dd7B92542c0C7Fe8AFce43E9D8690E640c"

	if (!PRIVATE_KEY) throw new Error("Missing POLYMARKET_PRIVATE_KEY in env");
	if (!FUNDER_ADDRESS) throw new Error("Missing FUNDER_ADDRESS in env");

	// Optional env
	const RPC_URL =
		process.env.POLYMARKET_RPC_URL ||
		process.env.RPC_URL ||
		"https://polygon-rpc.com";
	const HOST =
		process.env.POLYMARKET_CLOB_HOST || "https://clob.polymarket.com";
	const CHAIN_ID = Number(process.env.POLYMARKET_CHAIN_ID || 137); // Polygon mainnet
	const SIGNATURE_TYPE = Number(process.env.POLYMARKET_SIGNATURE_TYPE || 1); // 1 = server-side/private-key

	// Set up viem wallet client and ethers-compatible signer wrapper
	const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
	const walletClient = createWalletClient({
		chain: polygon,
		transport: http(RPC_URL),
		account,
	});
	// Pass viem transport to signer factory; type cast to EIP-1193 provider for compatibility
	// biome-ignore lint/suspicious/noExplicitAny: SDK expects a generic EIP-1193 provider shape
	const signer = createSignerForProvider(walletClient.transport as any);

	// First, derive API creds
	const bootstrapClient = new ClobClient(HOST, CHAIN_ID, signer);
	const creds = await bootstrapClient.createOrDeriveApiKey();

	// Create authenticated client
	const client = new ClobClient(
		HOST,
		CHAIN_ID,
		signer,
		creds,
		SIGNATURE_TYPE,
		FUNDER_ADDRESS,
	);

	// Ensure balance/allowance is prepared (approvals)
	console.log(
		"Updating balance/allowance (may prompt on-chain tx if needed)...",
	);
	await client.updateBalanceAllowance();

	// Build the limit order
	const order: UserOrder = {
		tokenID:
			"88770632741686298370270294037614812817595949782311984579833554458717957886356",
		price: 0.133,
		size: 15.03,
		side: Side.BUY,
	};

	console.log("Placing order:", order);

	const res = await client.createAndPostOrder(
		order,
		{
			tickSize: "0.001",
			negRisk: false,
		},
		OrderType.GTC,
	);

	console.log("Order placed successfully:");
	console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
	console.error("Failed to place order:");
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
