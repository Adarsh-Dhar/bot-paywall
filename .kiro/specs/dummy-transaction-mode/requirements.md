# Requirements Document

## Introduction

The bot-paywall repository currently integrates with blockchain networks (Movement EVM and Aptos) for payment processing using real on-chain transactions. This feature specification defines the complete replacement of all blockchain transactions with dummy transactions, eliminating all blockchain dependencies and network calls while maintaining the same API interfaces and validation logic for offline operation.

## Glossary

- **Dummy Transaction**: A simulated transaction that mimics real blockchain transaction structure and behavior without any network interaction
- **Offline Mode**: System operation without any external blockchain network contact or dependencies
- **Payment Verification System**: The component responsible for validating transaction authenticity and payment amounts
- **Transaction Simulator**: The component that generates and manages dummy transaction data
- **Cloudflare Worker**: The edge computing service that intercepts requests and validates payments
- **Aptos SDK Integration**: The current system component that interfaces with Aptos blockchain networks
- **Movement EVM Integration**: The current system component that interfaces with Movement blockchain networks

## Requirements

### Requirement 1

**User Story:** As a developer, I want to replace all blockchain transactions with dummy transactions in the paywall system, so that the system operates completely offline without any blockchain dependencies.

#### Acceptance Criteria

1. WHEN the system processes transactions THEN the Payment Verification System SHALL process all transactions without external network calls
2. WHEN the system generates transactions THEN the system SHALL generate deterministic dummy transaction responses for consistent testing
3. WHEN the Cloudflare Worker validates payments THEN the worker SHALL validate payments using simulated blockchain data exclusively
4. WHEN the system operates THEN the Payment Verification System SHALL maintain identical API interfaces to the previous blockchain integration
5. WHEN the system starts THEN all blockchain integration code SHALL be removed and replaced with dummy transaction processing

### Requirement 2

**User Story:** As a system administrator, I want dummy transactions to simulate realistic payment scenarios, so that the system behavior remains consistent across modes.

#### Acceptance Criteria

1. WHEN generating dummy transactions THEN the Transaction Simulator SHALL create transactions with valid blockchain format structures
2. WHEN validating dummy payments THEN the system SHALL enforce the same amount and recipient validation rules as real transactions
3. WHEN processing dummy transactions THEN the system SHALL simulate both successful and failed transaction scenarios
4. WHEN creating dummy transaction hashes THEN the Transaction Simulator SHALL generate unique identifiers that follow blockchain hash formats
5. WHEN dummy transactions are queried THEN the system SHALL return consistent results for the same transaction hash

### Requirement 3

**User Story:** As a quality assurance engineer, I want comprehensive validation of dummy transactions, so that I can verify system correctness without blockchain costs.

#### Acceptance Criteria

1. WHEN parsing dummy transaction data THEN the system SHALL validate it against the complete transaction grammar specification
2. WHEN storing dummy transactions THEN the system SHALL encode them using JSON format for persistence
3. WHEN retrieving dummy transactions THEN the system SHALL decode JSON data back to transaction objects
4. WHEN dummy transaction validation fails THEN the system SHALL return appropriate error messages matching real blockchain error patterns
5. WHEN dummy transactions contain invalid amounts THEN the Payment Verification System SHALL reject them with insufficient payment errors

### Requirement 4

**User Story:** As a developer, I want dummy transaction mode to support both Movement EVM and Aptos transaction formats, so that all existing integrations continue to work.

#### Acceptance Criteria

1. WHEN dummy mode processes Movement EVM transactions THEN the Transaction Simulator SHALL generate transactions with eth_getTransactionByHash response format
2. WHEN dummy mode processes Aptos transactions THEN the Transaction Simulator SHALL generate transactions with Aptos SDK response format
3. WHEN validating dummy Movement transactions THEN the system SHALL check recipient address, value in Wei, and transaction status
4. WHEN validating dummy Aptos transactions THEN the system SHALL check recipient address, amount in Octas, and entry function payload format
5. WHEN dummy transactions are created THEN the system SHALL support both blockchain formats simultaneously

### Requirement 5

**User Story:** As a system integrator, I want dummy transaction behavior to be configurable through environment variables, so that testing scenarios can be easily managed.

#### Acceptance Criteria

1. WHEN DUMMY_TRANSACTION_SEED is provided THEN the Transaction Simulator SHALL use it for deterministic transaction generation
2. WHEN DUMMY_SUCCESS_RATE is configured THEN the system SHALL simulate transaction failures at the specified rate
3. WHEN dummy transaction environment variables are missing THEN the system SHALL use default values for deterministic behavior
4. WHEN invalid dummy transaction configuration is detected THEN the system SHALL log configuration errors and fail safely
5. WHEN the system starts THEN all blockchain RPC URLs and network configurations SHALL be removed from the codebase

### Requirement 6

**User Story:** As a test automation engineer, I want property-based testing for dummy transactions, so that I can verify system correctness across many scenarios.

#### Acceptance Criteria

1. WHEN generating random dummy transactions THEN the system SHALL maintain transaction format consistency across all generated instances
2. WHEN round-trip testing dummy transactions THEN encoding followed by decoding SHALL preserve all transaction data
3. WHEN testing payment validation properties THEN valid dummy payments SHALL always pass verification
4. WHEN testing invalid payment scenarios THEN dummy transactions with insufficient amounts SHALL always fail verification
5. WHEN testing transaction hash uniqueness THEN the Transaction Simulator SHALL never generate duplicate hashes for different transactions