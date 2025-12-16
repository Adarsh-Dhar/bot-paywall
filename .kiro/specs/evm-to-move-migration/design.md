# Design Document

## Overview

This design document outlines the migration from EVM-based transactions to native MOVE transactions using the Aptos SDK. The migration will transform the existing paywall system to leverage native Movement blockchain capabilities while maintaining the same external API interfaces and user experience.

The system consists of three main components that need migration:
1. **Next.js Payment Middleware** - Handles payment verification and bot detection
2. **Cloudflare Worker** - Enforces paywall and returns payment requirements  
3. **Web Scraper Bot** - Automated client that pays for access

## Architecture

### Current EVM Architecture
```
Bot Scraper (Web3.py) → Cloudflare Worker → Next.js Middleware (Web3.js) → Movement EVM RPC
```

### Target MOVE Architecture  
```
Bot Scraper (Aptos Python SDK) → Cloudflare Worker → Next.js Middleware (Aptos TypeScript SDK) → Movement Native RPC
```

### Key Architectural Changes

1. **Transaction Layer**: Replace Web3 libraries with Aptos SDK
2. **RPC Communication**: Switch from EVM JSON-RPC to Aptos REST API
3. **Transaction Format**: Use BCS-encoded MOVE transactions instead of EVM transactions
4. **Account Management**: Use Aptos account format (32-byte addresses) instead of EVM addresses
5. **Cryptography**: Leverage Ed25519 signatures instead of ECDSA

## Components and Interfaces

### 1. Payment Verification Service (Next.js Middleware)

**Current Interface (EVM)**:
```typescript
interface PaymentVerification {
  verifyPayment(txHash: string): Promise<{valid: boolean, reason?: string}>
}
```

**New Interface (MOVE)**:
```typescript
interface MovePaymentVerification {
  verifyMovePayment(txHash: string): Promise<{valid: boolean, reason?: string}>
  parseTransactionData(txData: any): TransactionDetails
  validateCoinTransfer(transaction: any): boolean
}
```

### 2. Transaction Creation Service (Bot Scraper)

**Current Interface (EVM)**:
```python
class PaywallBreaker:
    def create_payment_transaction(self, to: str, amount: int) -> dict
    def send_transaction(self, tx: dict) -> str
```

**New Interface (MOVE)**:
```python
class MovePaywallBreaker:
    def create_coin_transfer(self, to: str, amount: int) -> RawTransaction
    def submit_transaction(self, signed_tx: SignedTransaction) -> str
    def generate_bcs_transaction(self, payload: TransactionPayload) -> bytes
```

### 3. Configuration Management

**Environment Variables Migration**:
- `MOVEMENT_RPC_URL` → `APTOS_NODE_URL` (REST endpoint instead of JSON-RPC)
- `PRIVATE_KEY` → `APTOS_PRIVATE_KEY` (Ed25519 format)
- `MOVEMENT_WALLET_ADDRESS` → `APTOS_ACCOUNT_ADDRESS` (32-byte format)

## Data Models

### Transaction Data Structure

**Current EVM Transaction**:
```typescript
interface EVMTransaction {
  hash: string;           // 0x prefixed hex
  to: string;            // 20-byte address
  value: string;         // Wei amount in hex
  gasPrice: string;      // Wei gas price
  status: "0x1" | "0x0"; // Success/failure
}
```

**New MOVE Transaction**:
```typescript
interface MoveTransaction {
  hash: string;                    // Transaction hash
  sender: string;                  // 32-byte account address
  payload: {
    type: "entry_function_payload";
    function: "0x1::coin::transfer";
    arguments: [string, string];   // [recipient, amount]
  };
  success: boolean;               // Execution success
  gas_used: string;              // Gas consumed
}
```

### Account Address Format

**EVM Address**: `0x742d35Cc6634C0532925a3b8D6Ac6E7D4b0F3e41` (20 bytes)
**Aptos Address**: `0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890` (32 bytes)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework, several can be consolidated to eliminate redundancy:

- Properties 1.1, 1.3, 2.2, and 4.2 all test SDK usage - these can be combined into a comprehensive "SDK usage consistency" property
- Properties 3.1, 3.2, and 3.3 all relate to BCS serialization round-trips - these can be combined into a single round-trip property
- Properties 2.1, 2.3, and 1.5 all relate to API compatibility - these can be combined into an "API compatibility" property
- Properties 4.1 and 4.3 both relate to transaction validation - these can be combined into a "transaction validation" property

### Correctness Properties

Property 1: SDK usage consistency
*For any* payment operation (creation, verification, status checking), the system should use Aptos SDK methods instead of Web3 methods
**Validates: Requirements 1.1, 1.3, 2.2, 4.2**

Property 2: Transaction format compliance
*For any* transaction creation request, the generated transaction should conform to Aptos transaction schema and use native MOVE format
**Validates: Requirements 1.2**

Property 3: BCS serialization round-trip
*For any* valid MOVE transaction, serializing to BCS format then deserializing should produce an equivalent transaction
**Validates: Requirements 3.1, 3.2, 3.3**

Property 4: API compatibility preservation
*For any* external API request, the response format should remain identical to the EVM implementation while using MOVE transactions internally
**Validates: Requirements 1.5, 2.1, 2.3**

Property 5: Account format validation
*For any* wallet operation, the system should use Aptos 32-byte account addresses and reject EVM 20-byte addresses
**Validates: Requirements 1.4, 4.3**

Property 6: Token amount handling
*For any* cost calculation or payment verification, the system should use native MOVE token amounts without Wei conversions
**Validates: Requirements 2.5, 4.1**

Property 7: Error message specificity
*For any* payment verification failure, the error message should clearly indicate MOVE-specific issues and not reference EVM concepts
**Validates: Requirements 2.4**

Property 8: Signature validation correctness
*For any* transaction validation, the system should verify digital signatures using Ed25519 cryptographic standards instead of ECDSA
**Validates: Requirements 3.4**

Property 9: Invalid transaction rejection
*For any* malformed MOVE transaction input, the system should reject it with appropriate error messages
**Validates: Requirements 3.5**

Property 10: Replay attack prevention consistency
*For any* transaction hash, the replay prevention mechanism should work identically for MOVE transactions as it did for EVM transactions
**Validates: Requirements 4.4**

Property 11: Confirmation finality rules
*For any* transaction requiring confirmation, the system should use Aptos finality rules instead of EVM block confirmation counts
**Validates: Requirements 4.5**

Property 12: RPC endpoint validation
*For any* RPC configuration, the system should correctly identify and use Aptos REST endpoints instead of EVM JSON-RPC endpoints
**Validates: Requirements 5.2**

Property 13: Exception handling robustness
*For any* Aptos SDK exception or network failure, the system should handle it gracefully with appropriate error recovery
**Validates: Requirements 6.3**

## Error Handling

### Migration-Specific Error Scenarios

1. **Address Format Errors**: Handle conversion between EVM and Aptos address formats
2. **Transaction Format Errors**: Validate MOVE transaction structure and BCS encoding
3. **SDK Compatibility Errors**: Manage differences between Web3 and Aptos SDK APIs
4. **RPC Endpoint Errors**: Handle transition from JSON-RPC to REST API calls
5. **Cryptographic Errors**: Manage Ed25519 vs ECDSA signature differences

### Error Recovery Strategies

- **Graceful Degradation**: Maintain service availability during migration
- **Detailed Logging**: Capture migration-specific errors for debugging
- **Fallback Mechanisms**: Temporary dual-support during transition period
- **User-Friendly Messages**: Clear error communication for different user types

## Testing Strategy

### Dual Testing Approach

The migration requires both unit testing and property-based testing to ensure correctness:

**Unit Testing Requirements**:
- Test specific migration scenarios (EVM to MOVE conversion)
- Validate SDK integration points
- Test error handling for migration-specific failures
- Verify configuration and deployment processes

**Property-Based Testing Requirements**:
- Use **fast-check** for TypeScript/JavaScript components
- Use **Hypothesis** for Python components  
- Configure each property-based test to run a minimum of 100 iterations
- Tag each property-based test with format: **Feature: evm-to-move-migration, Property {number}: {property_text}**
- Each correctness property must be implemented by a single property-based test

### Test Coverage Areas

1. **Transaction Format Validation**: Ensure all MOVE transactions conform to Aptos schemas
2. **SDK Integration**: Verify Aptos SDK usage across all components
3. **API Compatibility**: Confirm external interfaces remain unchanged
4. **Error Handling**: Test migration-specific error scenarios
5. **Performance**: Validate improved transaction speed and costs
6. **Security**: Ensure cryptographic operations use correct standards

### Integration Testing

- **End-to-End Payment Flows**: Test complete bot payment scenarios
- **Cross-Component Communication**: Verify Next.js ↔ Cloudflare Worker ↔ Bot interactions
- **Blockchain Integration**: Test against Movement testnet and mainnet
- **Backward Compatibility**: Ensure smooth transition from EVM implementation

## Implementation Phases

### Phase 1: Core SDK Migration
- Replace Web3 libraries with Aptos SDK
- Update transaction creation and verification logic
- Implement BCS serialization/deserialization

### Phase 2: API Compatibility Layer
- Maintain existing external interfaces
- Add MOVE transaction support while preserving response formats
- Implement address format conversion utilities

### Phase 3: Testing and Validation
- Comprehensive property-based testing implementation
- Integration testing across all components
- Performance benchmarking against EVM implementation

### Phase 4: Deployment and Migration
- Staged rollout with feature flags
- Monitoring and error tracking
- Documentation and training materials

## Dependencies and Integration Points

### External Dependencies
- **@aptos-labs/ts-sdk**: TypeScript SDK for Aptos integration
- **aptos**: Python SDK for bot scraper migration
- **Movement Blockchain**: Native MOVE transaction support
- **BCS Library**: Binary Canonical Serialization for transaction encoding

### Integration Points
- **Vercel KV**: Replay attack prevention (unchanged)
- **Cloudflare Workers**: Paywall enforcement (API updates needed)
- **Movement RPC**: Switch from EVM endpoints to native Aptos REST API
- **Environment Configuration**: Update for Aptos-specific settings

### Backward Compatibility Considerations
- Maintain HTTP header formats for payment proofs
- Preserve error response structures
- Keep environment variable naming consistent where possible
- Support gradual migration with feature flags