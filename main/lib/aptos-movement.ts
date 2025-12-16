// Aptos SDK integration for Movement blockchain
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import type { AptosTransactionResponse, PaymentVerificationResult } from '../types/aptos';

// Configuration
const APTOS_NODE_URL = process.env.APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";
const MY_WALLET = process.env.APTOS_ACCOUNT_ADDRESS || "";
const COST_IN_MOVE = parseFloat(process.env.MOVEMENT_COST_IN_MOVE || "0.01");
const COST_IN_OCTAS = Math.floor(COST_IN_MOVE * 100000000); // Convert to Octas (1 MOVE = 100M Octas)

// Initialize Aptos client
const config = new AptosConfig({ 
  network: Network.TESTNET,
  fullnode: APTOS_NODE_URL 
});
const aptos = new Aptos(config);

export async function verifyMovePayment(txHash: string): Promise<PaymentVerificationResult> {
  try {
    // 1. Fetch Transaction Details using Aptos SDK
    const transaction = await aptos.getTransactionByHash({
      transactionHash: txHash
    }) as AptosTransactionResponse;

    if (!transaction) {
      return { valid: false, reason: "Transaction not found" };
    }

    // 2. Verify transaction was successful
    if (!transaction.success) {
      return { valid: false, reason: "Transaction failed on-chain" };
    }

    // 3. Validate it's a coin transfer
    if (transaction.payload.type !== "entry_function_payload" || 
        transaction.payload.function !== "0x1::coin::transfer") {
      return { valid: false, reason: "Not a valid coin transfer transaction" };
    }

    // 4. Validate Receiver (first argument)
    const [recipient, amount] = transaction.payload.arguments;
    if (recipient.toLowerCase() !== MY_WALLET.toLowerCase()) {
      return { valid: false, reason: "Payment sent to wrong wallet" };
    }

    // 5. Validate Amount (second argument)
    const amountSent = parseInt(amount as string);
    if (amountSent < COST_IN_OCTAS) {
      return { 
        valid: false, 
        reason: `Insufficient payment. Sent ${amountSent} octas, needed ${COST_IN_OCTAS} octas` 
      };
    }

    return { valid: true, transaction };
  } catch (error) {
    console.error("Aptos RPC Error:", error);
    return { valid: false, reason: "Aptos RPC connection failed" };
  }
}

export async function getAccountBalance(accountAddress: string): Promise<string> {
  try {
    const balance = await aptos.getAccountCoinAmount({
      accountAddress,
      coinType: "0x1::aptos_coin::AptosCoin"
    });
    return balance.toString();
  } catch (error) {
    console.error("Failed to get account balance:", error);
    throw error;
  }
}

export async function getAccountInfo(accountAddress: string) {
  try {
    const accountInfo = await aptos.getAccountInfo({
      accountAddress
    });
    return accountInfo;
  } catch (error) {
    console.error("Failed to get account info:", error);
    throw error;
  }
}