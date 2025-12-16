// Type definitions for Aptos SDK integration

export interface AptosTransactionResponse {
  hash: string;
  sender: string;
  sequence_number: string;
  max_gas_amount: string;
  gas_unit_price: string;
  gas_used: string;
  success: boolean;
  vm_status: string;
  accumulator_root_hash: string;
  changes: any[];
  events: any[];
  payload: {
    type: string;
    function: string;
    arguments: any[];
    type_arguments: any[];
  };
  signature: {
    type: string;
    signature: string;
    public_key: string;
  };
  timestamp: string;
  version: string;
}

export interface MoveCoinTransferPayload {
  type: "entry_function_payload";
  function: "0x1::coin::transfer";
  arguments: [string, string]; // [recipient_address, amount]
  type_arguments: ["0x1::aptos_coin::AptosCoin"];
}

export interface PaymentVerificationResult {
  valid: boolean;
  reason?: string;
  transaction?: AptosTransactionResponse;
}

export interface AptosAccountInfo {
  sequence_number: string;
  authentication_key: string;
}

export interface MoveCoinBalance {
  coin: {
    value: string;
  };
}

export interface AptosRpcError {
  code: number;
  message: string;
  data?: any;
}