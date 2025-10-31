import {
	ClobClient,
	OrderType,
	Side,
	type UserOrder,
} from "@dschz/polymarket-clob-client";
import { providers, Wallet } from "ethers";

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
	const SIGNATURE_TYPE = Number(process.env.POLYMARKET_SIGNATURE_TYPE || 0); // 0 = EOA/ethers signer

	// Set up ethers wallet and provider
	const provider = new providers.JsonRpcProvider(RPC_URL);
	const signer = new Wallet(PRIVATE_KEY, provider);

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
