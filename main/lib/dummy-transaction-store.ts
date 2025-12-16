// In-memory transaction management for dummy mode
import type { DummyTransaction } from '../types/dummy-transactions';
import { DummyErrorMessages, DummyErrorFormatter } from './dummy-error-messages';

export class DummyTransactionStore {
  private transactions: Map<string, DummyTransaction> = new Map();
  private usedHashes: Set<string> = new Set();

  /**
   * Store a dummy transaction in memory
   */
  store(transaction: DummyTransaction): void {
    this.transactions.set(transaction.hash, transaction);
  }

  /**
   * Retrieve a dummy transaction by hash
   */
  retrieve(hash: string): DummyTransaction | null {
    return this.transactions.get(hash) || null;
  }

  /**
   * Mark a transaction hash as used (for replay attack prevention)
   */
  markAsUsed(hash: string): void {
    this.usedHashes.add(hash);
  }

  /**
   * Check if a transaction hash has been used
   */
  isUsed(hash: string): boolean {
    return this.usedHashes.has(hash);
  }

  /**
   * Clear all stored transactions (for testing)
   */
  clear(): void {
    this.transactions.clear();
    this.usedHashes.clear();
  }

  /**
   * Get all stored transaction hashes
   */
  getAllHashes(): string[] {
    return Array.from(this.transactions.keys());
  }

  /**
   * Get count of stored transactions
   */
  getTransactionCount(): number {
    return this.transactions.size;
  }

  /**
   * Serialize all transactions to JSON string
   */
  toJSON(): string {
    const data = {
      transactions: Object.fromEntries(this.transactions),
      usedHashes: Array.from(this.usedHashes)
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserialize transactions from JSON string
   */
  fromJSON(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      
      // Validate the structure
      if (!data || typeof data !== 'object') {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: expected object`);
      }
      
      if (!data.transactions || typeof data.transactions !== 'object') {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: missing or invalid transactions`);
      }
      
      if (!Array.isArray(data.usedHashes)) {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: missing or invalid usedHashes`);
      }
      
      // Clear existing data
      this.clear();
      
      // Restore transactions
      for (const [hash, transaction] of Object.entries(data.transactions)) {
        if (typeof transaction === 'object' && transaction !== null) {
          this.transactions.set(hash, transaction as DummyTransaction);
        }
      }
      
      // Restore used hashes
      for (const hash of data.usedHashes) {
        if (typeof hash === 'string') {
          this.usedHashes.add(hash);
        }
      }
    } catch (error) {
      throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export a single transaction to JSON
   */
  transactionToJSON(transaction: DummyTransaction): string {
    return JSON.stringify(transaction, null, 2);
  }

  /**
   * Import a single transaction from JSON
   */
  transactionFromJSON(jsonString: string): DummyTransaction {
    try {
      const transaction = JSON.parse(jsonString);
      
      // Basic validation - check if it has required fields
      if (!transaction || typeof transaction !== 'object') {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: expected object`);
      }
      
      if (!transaction.hash || typeof transaction.hash !== 'string') {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: missing or invalid hash`);
      }
      
      // Validate it's either a Movement or Aptos transaction
      const hasMovementFields = 'to' in transaction && 'from' in transaction && 'value' in transaction;
      const hasAptosFields = 'sender' in transaction && 'payload' in transaction && 'success' in transaction;
      
      if (!hasMovementFields && !hasAptosFields) {
        throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: not a valid Movement or Aptos transaction`);
      }
      
      return transaction as DummyTransaction;
    } catch (error) {
      throw new Error(`${DummyErrorMessages.INVALID_TRANSACTION_FORMAT.message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save transactions to a JSON file (for persistence)
   */
  async saveToFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const jsonData = this.toJSON();
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  /**
   * Load transactions from a JSON file
   */
  async loadFromFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    try {
      const jsonData = await fs.readFile(filePath, 'utf-8');
      this.fromJSON(jsonData);
    } catch (error) {
      throw new Error(`${DummyErrorMessages.NETWORK_ERROR.message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Global instance for the application
export const dummyTransactionStore = new DummyTransactionStore();