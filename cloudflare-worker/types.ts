// Type definitions for Cloudflare Worker Aptos integration

export interface WorkerEnv {
  MY_WALLET: string;
  PRICE_MOVE: string;
  RPC_URL: string;
  PAYWALL_DB: KVNamespace;
}

export interface PaymentRequirement {
  error: string;
  message: string;
  payment_address: string;
  price_move: string;
  currency: string;
}

export interface AptosTransactionHash {
  hash: string;
}

export interface PaymentVerificationRequest {
  txHash: string;
  expectedAmount: string;
  expectedRecipient: string;
}

export interface PaymentVerificationResponse {
  valid: boolean;
  reason?: string;
}