// Dummy payment verification system - replaces blockchain integration
import { transactionSimulator } from './transaction-simulator';
import type { ValidationResult } from '../types/dummy-transactions';
import { DummyErrorMessages, DummyErrorFormatter } from './dummy-error-messages';

// Configuration from environment variables (now for dummy mode)
const MY_WALLET = process.env.DUMMY_WALLET_ADDRESS || "0x1234567890123456789012345678901234567890";
const COST_IN_MOVE = parseFloat(process.env.DUMMY_COST_IN_MOVE || "0.01");
const COST_IN_WEI = BigInt(Math.floor(COST_IN_MOVE * 1e18)); // Convert to Wei
const DUMMY_LOGGING = process.env.DUMMY_TRANSACTION_LOGGING === 'true';

// Configuration validation
function validateDummyConfig(): void {
  const errors: string[] = [];
  
  // Validate wallet address format
  if (!MY_WALLET.match(/^0x[0-9a-fA-F]{40}$/)) {
    errors.push(DummyErrorFormatter.formatConfigurationError('DUMMY_WALLET_ADDRESS', MY_WALLET));
  }
  
  // Validate cost amount
  if (isNaN(COST_IN_MOVE) || COST_IN_MOVE <= 0) {
    errors.push(DummyErrorFormatter.formatConfigurationError('DUMMY_COST_IN_MOVE', process.env.DUMMY_COST_IN_MOVE));
  }
  
  if (errors.length > 0) {
    console.error('Dummy transaction configuration errors:', errors);
    throw new Error(`${DummyErrorMessages.INVALID_CONFIGURATION.message}: ${errors.join(', ')}`);
  }
  
  if (DUMMY_LOGGING) {
    console.log('Dummy transaction configuration loaded:', {
      wallet: MY_WALLET,
      costInMove: COST_IN_MOVE,
      costInWei: COST_IN_WEI.toString(),
      seed: process.env.DUMMY_TRANSACTION_SEED || 'default',
      successRate: process.env.DUMMY_SUCCESS_RATE || '0.9'
    });
  }
}

// Validate configuration on module load
validateDummyConfig();

/**
 * Verify a payment using dummy transactions (replaces verifyPayment from movement.ts)
 */
export async function verifyPayment(txHash: string): Promise<ValidationResult> {
  try {
    if (DUMMY_LOGGING) {
      console.log(`Verifying dummy payment: ${txHash}`);
    }
    
    // Use the transaction simulator to validate the dummy payment
    const result = transactionSimulator.validateDummyPayment(
      txHash,
      COST_IN_WEI,
      MY_WALLET
    );

    if (DUMMY_LOGGING) {
      console.log(`Payment verification result:`, {
        txHash,
        valid: result.valid,
        reason: result.reason || 'Success'
      });
    }

    return result;
  } catch (error) {
    console.error("Dummy verification error:", error);
    return { 
      valid: false, 
      reason: DummyErrorMessages.VERIFICATION_FAILED.message 
    };
  }
}

/**
 * Generate a dummy transaction for testing purposes
 */
export function generateDummyPayment(
  recipient: string = MY_WALLET,
  amount: bigint = COST_IN_WEI,
  sender?: string,
  blockchainType: 'movement' | 'aptos' = 'movement'
): string {
  if (DUMMY_LOGGING) {
    console.log(`Generating dummy ${blockchainType} payment:`, {
      recipient,
      amount: amount.toString(),
      sender: sender || 'auto-generated'
    });
  }
  
  const transaction = transactionSimulator.generateDummyTransaction({
    recipient,
    amount,
    sender,
    blockchainType
  });
  
  if (DUMMY_LOGGING) {
    console.log(`Generated dummy transaction: ${transaction.hash}`);
  }
  
  return transaction.hash;
}

/**
 * Generate dummy payments for both blockchain formats
 */
export function generateMultiFormatDummyPayments(
  recipient: string = MY_WALLET,
  amount: bigint = COST_IN_WEI,
  count: number = 1
): { movement: string[], aptos: string[] } {
  const transactions = transactionSimulator.generateMultiFormatTransactions({
    movementParams: { recipient, amount },
    aptosParams: { recipient, amount },
    count
  });

  return {
    movement: transactions.movement.map(tx => tx.hash),
    aptos: transactions.aptos.map(tx => tx.hash)
  };
}

/**
 * Get dummy transaction configuration
 */
export function getDummyConfig() {
  return {
    wallet: MY_WALLET,
    costInMove: COST_IN_MOVE,
    costInWei: COST_IN_WEI.toString()
  };
}