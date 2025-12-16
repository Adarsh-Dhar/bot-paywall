// Type definitions for dummy transaction system

export interface DummyMovementTransaction {
  hash: string;
  to: string;
  from: string;
  value: string; // hex wei
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: string;
  status: "0x1" | "0x0"; // success or failure
}

export interface DummyAptosTransaction {
  hash: string;
  sender: string;
  sequence_number: string;
  success: boolean;
  payload: {
    type: "entry_function_payload";
    function: "0x1::coin::transfer";
    arguments: [string, string]; // [recipient_address, amount_in_octas]
    type_arguments: ["0x1::aptos_coin::AptosCoin"];
  };
  timestamp: string;
  version: string;
  max_gas_amount: string;
  gas_unit_price: string;
  gas_used: string;
  vm_status: string;
}

export type DummyTransaction = DummyMovementTransaction | DummyAptosTransaction;

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  transaction?: DummyTransaction;
}

export interface TransactionParams {
  recipient: string;
  amount: bigint;
  sender?: string;
  blockchainType: 'movement' | 'aptos';
}

export interface DummyModeConfig {
  enabled: boolean;
  seed?: string;
  successRate: number; // 0.0 to 1.0
  defaultWallet: string;
  defaultAmount: string;
}