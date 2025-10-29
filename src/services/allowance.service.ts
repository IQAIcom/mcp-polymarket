import { Contract, constants, type Wallet } from "ethers";
import {
	CTF_ABI,
	CTF_ADDRESS,
	EXCHANGE_ADDRESS,
	USDC_ABI,
	USDC_ADDRESS,
} from "./constants.js";
import type { AllowanceStatus, SetAllowanceResult } from "./types.js";

/**
 * Service to handle token allowance operations
 */
export class AllowanceService {
	constructor(private signer: Wallet) {}

	/**
	 * Check current allowance status
	 */
	async checkAllowances(): Promise<AllowanceStatus> {
		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		const usdcAllowanceCtf = await usdc.allowance(
			this.signer.address,
			CTF_ADDRESS,
		);
		const usdcAllowanceExchange = await usdc.allowance(
			this.signer.address,
			EXCHANGE_ADDRESS,
		);
		const conditionalTokensAllowanceExchange = await ctf.isApprovedForAll(
			this.signer.address,
			EXCHANGE_ADDRESS,
		);

		return {
			usdcAllowanceCtf: usdcAllowanceCtf.toString(),
			usdcAllowanceExchange: usdcAllowanceExchange.toString(),
			conditionalTokensAllowanceExchange,
		};
	}

	/**
	 * Set necessary allowances for trading
	 * This needs to be called before trading operations can work
	 */
	async setAllowances(): Promise<SetAllowanceResult> {
		try {
			console.log("Checking and setting allowances...");

			const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
			const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

			const usdcAllowanceCtf = await usdc.allowance(
				this.signer.address,
				CTF_ADDRESS,
			);
			const usdcAllowanceExchange = await usdc.allowance(
				this.signer.address,
				EXCHANGE_ADDRESS,
			);
			const conditionalTokensAllowanceExchange = await ctf.isApprovedForAll(
				this.signer.address,
				EXCHANGE_ADDRESS,
			);

			const transactions: string[] = [];

			// Set USDC allowance for CTF if needed
			if (usdcAllowanceCtf.eq(0)) {
				console.log("Setting USDC allowance for CTF...");
				const txn = await usdc.approve(CTF_ADDRESS, constants.MaxUint256, {
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`CTF allowance: ${txn.hash}`);
			}

			// Set USDC allowance for Exchange if needed
			if (usdcAllowanceExchange.eq(0)) {
				console.log("Setting USDC allowance for Exchange...");
				const txn = await usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256, {
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`Exchange allowance: ${txn.hash}`);
			}

			// Set Conditional Tokens approval for Exchange if needed
			if (!conditionalTokensAllowanceExchange) {
				console.log("Setting Conditional Tokens approval for Exchange...");
				const txn = await ctf.setApprovalForAll(EXCHANGE_ADDRESS, true, {
					gasLimit: 200000,
				});
				await txn.wait();
				transactions.push(`CTF approval: ${txn.hash}`);
			}

			return {
				success: true,
				transactions,
				message:
					transactions.length > 0
						? "Allowances set successfully"
						: "All allowances already sufficient",
			};
		} catch (error) {
			console.error("Error setting allowances:", error);
			throw error;
		}
	}
}
