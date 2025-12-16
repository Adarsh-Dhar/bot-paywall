# Design Document

## Overview

The dummy transaction replacement feature completely transforms the bot-paywall system from a blockchain-dependent payment processor into a fully offline system that operates exclusively with simulated transactions. This design maintains API compatibility while replacing all blockchain integration with a transaction simulation layer that generates deterministic dummy transactions.

The system architecture replaces all blockchain network calls with a Transaction Simulator component that generates realistic blockchain transaction data without any network dependencies, while preserving all existing validation logic and error handling patterns.

## Architecture

The dummy transaction mode introduces a new abstraction layer between the payment verification logic and the blockchain integration:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Routes    │───▶│ Payment Verifier │───▶│ Blockchain      │
│                 │    │                  │    │ Integration     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Transaction      │
                       │ Simulator        │
                       │ (Dummy Mode)     │
                       └──────────────────┘
```

The Transaction Simulator completely replaces all blockchain calls, generating consistent responses that match the expected blockchain API formats without any network dependencies.

## Components and Interfaces

### Transaction Simulator

The core component responsible for generating and managing dummy transaction data:

```typescript
interface TransactionSimulator {
  generateDummyTransaction(params: TransactionParams): DummyTransaction;
  validateDummyPayment(txHash: string, expectedAmount: bigint, expectedRecipient: string): ValidationResult;
  getDummyTransactionByHash(txHash: string): DummyTransaction | null;
  setSuccessRate(rate: number): void;
}
```

### Dummy Transaction Types

Support for both Movement EVM and Aptos transaction formats:

```typescript
interface DummyMovementTransaction {
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
}

interface DummyAptosTransaction {
  hash: string;
  sender: string;
  sequence_number: string;
  success: boolean;
  payload: {
    type: "entry_function_payload";
    function: "0x1::coin::transfer";
    arguments: [string, string];
    type_arguments: ["0x1::aptos_coin::AptosCoin"];
  };
  timestamp: string;
  version: string;
}
```

### Configuration Interface

Environment-based configuration for dummy mode activation:

```typescript
interface DummyModeConfig {
  enabled: boolean;
  seed?: string;
  successRate: number; // 0.0 to 1.0
  defaultWallet: string;
  defaultAmount: string;
}
```

## Data Models

### Transaction Storage

Dummy transactions are stored in-memory with optional persistence for deterministic testing:

```typescript
class DummyTransactionStore {
  private transactions: Map<string, DummyTransaction> = new Map();
  private usedHashes: Set<string> = new Set();
  
  store(transaction: DummyTransaction): void;
  retrieve(hash: string): DummyTransaction | null;
  markAsUsed(hash: string): void;
  isUsed(hash: string): boolean;
}
```

### Validation Models

Consistent validation results across real and dummy modes:

```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;
  transaction?: DummyTransaction;
}

interface TransactionParams {
  recipient: string;
  amount: bigint;
  sender?: string;
  blockchainType: 'movement' | 'aptos';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Network isolation in dummy mode
*For any* payment verification operation when dummy mode is enabled, the system should complete without making external network calls to blockchain endpoints
**Validates: Requirements 1.1**

Property 2: Deterministic transaction generation
*For any* given seed value, the Transaction Simulator should generate identical dummy transactions across multiple runs
**Validates: Requirements 1.2, 5.2**

Property 3: API interface consistency
*For any* payment verification function, the function signatures and return types should be identical between real and dummy modes
**Validates: Requirements 1.4**

Property 4: Blockchain format compliance
*For any* generated dummy transaction, the transaction structure should conform to the appropriate blockchain format specification (Movement EVM or Aptos)
**Validates: Requirements 2.1, 4.1, 4.2**

Property 5: Validation rule consistency
*For any* payment validation scenario, the validation logic should produce identical results in both real and dummy modes for equivalent transaction data
**Validates: Requirements 2.2, 4.3, 4.4**

Property 6: Success and failure simulation
*For any* configured success rate, the Transaction Simulator should generate successful and failed transactions at the specified rate over many iterations
**Validates: Requirements 2.3, 5.3**

Property 7: Transaction hash uniqueness
*For any* set of generated dummy transactions, all transaction hashes should be unique and follow blockchain hash format (64 hexadecimal characters)
**Validates: Requirements 2.4, 6.5**

Property 8: Query consistency
*For any* transaction hash, querying the same hash multiple times should return identical transaction data
**Validates: Requirements 2.5**

Property 9: Serialization round trip
*For any* dummy transaction object, serializing to JSON then deserializing should produce an equivalent object
**Validates: Requirements 3.1, 3.2, 3.3, 6.2**

Property 10: Error message consistency
*For any* invalid transaction scenario, the error messages generated in dummy mode should match the patterns used in real blockchain integration
**Validates: Requirements 3.4**

Property 11: Insufficient payment rejection
*For any* dummy transaction with amount below the required threshold, the Payment Verification System should reject it with an insufficient payment error
**Validates: Requirements 3.5, 6.4**

Property 12: Multi-format support
*For any* session, the system should successfully process both Movement EVM and Aptos dummy transactions simultaneously
**Validates: Requirements 4.5**

Property 13: Valid payment acceptance
*For any* dummy transaction with correct recipient and sufficient amount, the payment verification should always succeed
**Validates: Requirements 6.3**

Property 14: Format consistency across generation
*For any* randomly generated dummy transactions of the same blockchain type, all transactions should conform to identical format specifications
**Validates: Requirements 6.1**

Property 15: Configuration error handling
*For any* invalid dummy mode configuration values, the system should log appropriate errors and fail safely without crashing
**Validates: Requirements 5.5**

## Error Handling

The dummy transaction mode maintains the same error handling patterns as real blockchain integration:

### Network Errors
- Simulated RPC timeouts and connection failures
- Configurable error rates for testing resilience
- Consistent error message formats

### Validation Errors
- Insufficient payment amounts
- Invalid recipient addresses
- Malformed transaction data
- Replay attack prevention (used transaction hashes)

### Configuration Errors
- Invalid environment variable values
- Missing required configuration
- Graceful fallback to real blockchain mode

## Testing Strategy

### Unit Testing
The dummy transaction mode requires comprehensive unit testing for:
- Transaction generation logic
- Validation rule consistency
- Configuration parsing
- Error handling scenarios

### Property-Based Testing
Property-based testing will be implemented using fast-check (TypeScript) and Hypothesis (Python) to verify:
- Transaction format compliance across random inputs
- Serialization/deserialization round trips
- Validation consistency between modes
- Hash uniqueness across large datasets

**Testing Framework Configuration:**
- **TypeScript**: fast-check library with minimum 100 iterations per property
- **Python**: Hypothesis library with minimum 100 examples per property
- Each property test must reference its corresponding design document property using the format: `**Feature: dummy-transaction-mode, Property {number}: {property_text}**`

### Integration Testing
- End-to-end payment flows in dummy mode
- Mode switching without service interruption
- Multi-format transaction processing
- Cloudflare Worker integration with dummy data

### Performance Testing
- Transaction generation speed benchmarks
- Memory usage with large transaction datasets
- Concurrent access to dummy transaction store