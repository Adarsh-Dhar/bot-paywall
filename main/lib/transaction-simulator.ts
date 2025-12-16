// Transaction Simulator for generating dummy blockchain transactions
import type { 
  DummyMovementTransaction, 
  DummyAptosTransaction, 
  DummyTransaction,
  ValidationResult,
  TransactionParams,
  DummyModeConfig 
} from '../types/dummy-transactions';
import { dummyTransactionStore } from './dummy-transaction-store';
import { DummyErrorMessages, DummyErrorFormatter } from './dummy-error-messages';

export class TransactionSimulator {
  private config: DummyModeConfig;
  private seedValue: number;

  constructor(config?: Partial<DummyModeConfig>) {
    // Handle null/undefined config
    const safeConfig = config || {};
    
    this.config = {
      enabled: safeConfig.enabled !== undefined ? safeConfig.enabled : true,
      successRate: safeConfig.successRate !== undefined ? safeConfig.successRate : 0.9,
      defaultWallet: safeConfig.defaultWallet || "0x1234567890123456789012345678901234567890",
      defaultAmount: safeConfig.defaultAmount || "10000000000000000", // 0.01 ETH in Wei
      seed: safeConfig.seed
    };
    
    // Clamp success rate to valid range [0, 1] and handle invalid values
    if (typeof this.config.successRate !== 'number' || 
        isNaN(this.config.successRate) || 
        !isFinite(this.config.successRate)) {
      this.config.successRate = 0.9; // Default fallback
    } else {
      this.config.successRate = Math.max(0, Math.min(1, this.config.successRate));
    }
    
    // Initialize deterministic seed
    this.seedValue = config?.seed ? this.hashString(config.seed) : Date.now();
  }

  /**
   * Generate a deterministic hash from a string
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate a deterministic random number between 0 and 1
   */
  private deterministicRandom(): number {
    this.seedValue = (this.seedValue * 9301 + 49297) % 233280;
    return this.seedValue / 233280;
  }

  /**
   * Generate a random hex string of specified length
   */
  private generateHex(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(this.deterministicRandom() * 16).toString(16);
    }
    return result;
  }

  /**
   * Generate a dummy Movement EVM transaction
   */
  private generateMovementTransaction(params: TransactionParams): DummyMovementTransaction {
    const isSuccess = this.deterministicRandom() < this.config.successRate;
    
    return {
      hash: `0x${this.generateHex(64)}`,
      to: params.recipient.toLowerCase(),
      from: params.sender || `0x${this.generateHex(40)}`,
      value: `0x${params.amount.toString(16)}`,
      gas: "0x5208", // 21000 gas
      gasPrice: `0x${(Math.floor(this.deterministicRandom() * 20000000000) + 1000000000).toString(16)}`,
      nonce: `0x${Math.floor(this.deterministicRandom() * 1000).toString(16)}`,
      blockNumber: `0x${(Math.floor(this.deterministicRandom() * 1000000) + 1000000).toString(16)}`,
      blockHash: `0x${this.generateHex(64)}`,
      transactionIndex: `0x${Math.floor(this.deterministicRandom() * 100).toString(16)}`,
      status: isSuccess ? "0x1" : "0x0"
    };
  }

  /**
   * Generate a dummy Aptos transaction
   */
  private generateAptosTransaction(params: TransactionParams): DummyAptosTransaction {
    const isSuccess = this.deterministicRandom() < this.config.successRate;
    
    return {
      hash: `0x${this.generateHex(64)}`,
      sender: params.sender || `0x${this.generateHex(64)}`,
      sequence_number: Math.floor(this.deterministicRandom() * 1000).toString(),
      success: isSuccess,
      payload: {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        arguments: [params.recipient, params.amount.toString()],
        type_arguments: ["0x1::aptos_coin::AptosCoin"]
      },
      timestamp: (Math.floor(this.deterministicRandom() * 1000000000000000) + 1600000000000000).toString(), // deterministic microseconds
      version: Math.floor(this.deterministicRandom() * 1000000).toString(),
      max_gas_amount: "2000",
      gas_unit_price: "100",
      gas_used: Math.floor(this.deterministicRandom() * 1000 + 100).toString(),
      vm_status: isSuccess ? "Executed successfully" : "Execution failed"
    };
  }

  /**
   * Generate a dummy transaction based on blockchain type
   */
  generateDummyTransaction(params: TransactionParams): DummyTransaction {
    let transaction: DummyTransaction;
    
    if (params.blockchainType === 'movement') {
      transaction = this.generateMovementTransaction(params);
    } else {
      transaction = this.generateAptosTransaction(params);
    }
    
    // Store the transaction
    dummyTransactionStore.store(transaction);
    
    return transaction;
  }

  /**
   * Get a dummy transaction by hash
   */
  getDummyTransactionByHash(txHash: string): DummyTransaction | null {
    return dummyTransactionStore.retrieve(txHash);
  }

  /**
   * Detect the blockchain format of a transaction
   */
  private detectTransactionFormat(transaction: DummyTransaction): 'movement' | 'aptos' {
    if ('status' in transaction && 'to' in transaction && 'from' in transaction && 'value' in transaction) {
      return 'movement';
    } else if ('success' in transaction && 'sender' in transaction && 'payload' in transaction) {
      return 'aptos';
    }
    throw new Error('Unknown transaction format');
  }

  /**
   * Validate a Movement EVM transaction
   */
  private validateMovementTransaction(
    transaction: DummyMovementTransaction,
    expectedAmount: bigint,
    expectedRecipient: string
  ): ValidationResult {
    // Check if transaction was successful
    if (transaction.status !== "0x1") {
      return { 
        valid: false, 
        reason: DummyErrorMessages.TRANSACTION_FAILED.message 
      };
    }
    
    // Validate recipient
    if (transaction.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return { 
        valid: false, 
        reason: DummyErrorMessages.WRONG_RECIPIENT.message 
      };
    }
    
    // Validate amount
    const valueSent = BigInt(transaction.value);
    if (valueSent < expectedAmount) {
      return { 
        valid: false, 
        reason: DummyErrorFormatter.formatInsufficientPayment(
          transaction.value, 
          expectedAmount.toString(), 
          'wei'
        )
      };
    }

    return { valid: true, transaction };
  }

  /**
   * Validate an Aptos transaction
   */
  private validateAptosTransaction(
    transaction: DummyAptosTransaction,
    expectedAmount: bigint,
    expectedRecipient: string
  ): ValidationResult {
    // Check if transaction was successful
    if (!transaction.success) {
      return { 
        valid: false, 
        reason: DummyErrorMessages.TRANSACTION_FAILED.message 
      };
    }
    
    // Validate it's a coin transfer
    if (transaction.payload.type !== "entry_function_payload" || 
        transaction.payload.function !== "0x1::coin::transfer") {
      return { 
        valid: false, 
        reason: DummyErrorMessages.INVALID_COIN_TRANSFER.message 
      };
    }
    
    // Validate recipient
    const [recipient, amount] = transaction.payload.arguments;
    if (recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return { 
        valid: false, 
        reason: DummyErrorMessages.WRONG_RECIPIENT.message 
      };
    }
    
    // Validate amount
    const amountSent = BigInt(amount);
    if (amountSent < expectedAmount) {
      return { 
        valid: false, 
        reason: DummyErrorFormatter.formatInsufficientPayment(
          amount, 
          expectedAmount.toString(), 
          'octas'
        )
      };
    }

    return { valid: true, transaction };
  }

  /**
   * Validate a dummy payment with automatic format detection
   */
  validateDummyPayment(
    txHash: string, 
    expectedAmount: bigint, 
    expectedRecipient: string
  ): ValidationResult {
    const transaction = this.getDummyTransactionByHash(txHash);
    
    if (!transaction) {
      return { 
        valid: false, 
        reason: DummyErrorMessages.TRANSACTION_NOT_FOUND.message 
      };
    }

    try {
      // Detect transaction format and route to appropriate validator
      const format = this.detectTransactionFormat(transaction);
      
      if (format === 'movement') {
        return this.validateMovementTransaction(
          transaction as DummyMovementTransaction,
          expectedAmount,
          expectedRecipient
        );
      } else {
        return this.validateAptosTransaction(
          transaction as DummyAptosTransaction,
          expectedAmount,
          expectedRecipient
        );
      }
    } catch (error) {
      return { 
        valid: false, 
        reason: DummyErrorFormatter.formatTransactionFormatError(
          error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  /**
   * Set the success rate for transaction generation
   */
  setSuccessRate(rate: number): void {
    this.config.successRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Generate multiple transactions of different formats in a single batch
   */
  generateMultiFormatTransactions(params: {
    movementParams?: Omit<TransactionParams, 'blockchainType'>;
    aptosParams?: Omit<TransactionParams, 'blockchainType'>;
    count?: number;
  }): { movement: DummyMovementTransaction[], aptos: DummyAptosTransaction[] } {
    const result = {
      movement: [] as DummyMovementTransaction[],
      aptos: [] as DummyAptosTransaction[]
    };

    const count = params.count || 1;

    // Generate Movement transactions if parameters provided
    if (params.movementParams) {
      for (let i = 0; i < count; i++) {
        const transaction = this.generateDummyTransaction({
          ...params.movementParams,
          blockchainType: 'movement',
          amount: params.movementParams.amount + BigInt(i) // Ensure unique amounts
        }) as DummyMovementTransaction;
        result.movement.push(transaction);
      }
    }

    // Generate Aptos transactions if parameters provided
    if (params.aptosParams) {
      for (let i = 0; i < count; i++) {
        const transaction = this.generateDummyTransaction({
          ...params.aptosParams,
          blockchainType: 'aptos',
          amount: params.aptosParams.amount + BigInt(i) // Ensure unique amounts
        }) as DummyAptosTransaction;
        result.aptos.push(transaction);
      }
    }

    return result;
  }

  /**
   * Validate multiple transactions of different formats
   */
  validateMultiFormatPayments(validations: Array<{
    txHash: string;
    expectedAmount: bigint;
    expectedRecipient: string;
  }>): ValidationResult[] {
    return validations.map(validation => 
      this.validateDummyPayment(
        validation.txHash,
        validation.expectedAmount,
        validation.expectedRecipient
      )
    );
  }

  /**
   * Get statistics about stored transactions by format
   */
  getTransactionStatistics(): {
    total: number;
    movement: number;
    aptos: number;
    successful: number;
    failed: number;
  } {
    const allHashes = dummyTransactionStore.getAllHashes();
    let movementCount = 0;
    let aptosCount = 0;
    let successfulCount = 0;
    let failedCount = 0;

    for (const hash of allHashes) {
      const transaction = dummyTransactionStore.retrieve(hash);
      if (transaction) {
        try {
          const format = this.detectTransactionFormat(transaction);
          if (format === 'movement') {
            movementCount++;
            if ((transaction as DummyMovementTransaction).status === "0x1") {
              successfulCount++;
            } else {
              failedCount++;
            }
          } else {
            aptosCount++;
            if ((transaction as DummyAptosTransaction).success) {
              successfulCount++;
            } else {
              failedCount++;
            }
          }
        } catch (error) {
          // Skip transactions with unknown format
          continue;
        }
      }
    }

    return {
      total: allHashes.length,
      movement: movementCount,
      aptos: aptosCount,
      successful: successfulCount,
      failed: failedCount
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DummyModeConfig {
    return { ...this.config };
  }
}

// Create global instance with environment configuration
const createGlobalSimulator = (): TransactionSimulator => {
  const config: Partial<DummyModeConfig> = {
    enabled: true,
    defaultWallet: process.env.DUMMY_WALLET_ADDRESS || "0x1234567890123456789012345678901234567890",
    defaultAmount: process.env.DUMMY_COST_IN_MOVE ? 
      BigInt(Math.floor(parseFloat(process.env.DUMMY_COST_IN_MOVE) * 1e18)).toString() : 
      "10000000000000000"
  };

  // Add seed if provided
  if (process.env.DUMMY_TRANSACTION_SEED) {
    config.seed = process.env.DUMMY_TRANSACTION_SEED;
  }

  // Add success rate if provided
  if (process.env.DUMMY_SUCCESS_RATE) {
    const rate = parseFloat(process.env.DUMMY_SUCCESS_RATE);
    if (!isNaN(rate)) {
      config.successRate = rate;
    }
  }

  return new TransactionSimulator(config);
};

// Global instance for the application
export const transactionSimulator = createGlobalSimulator();