# Implementation Plan

- [x] 1. Set up Aptos SDK dependencies and project structure
  - Replace Web3 dependencies with Aptos SDK packages in all components
  - Update package.json files for Next.js app and Cloudflare worker
  - Update requirements.txt for Python web scraper
  - Configure TypeScript types for Aptos SDK integration
  - _Requirements: 5.3_

- [x] 1.1 Write property test for SDK usage consistency
  - **Property 1: SDK usage consistency**
  - **Validates: Requirements 1.1, 1.3, 2.2, 4.2**

- [ ] 2. Implement core MOVE transaction utilities
  - Create Aptos account management utilities for address handling
  - Implement BCS serialization/deserialization functions
  - Create transaction format validation helpers
  - Add Ed25519 signature verification utilities
  - _Requirements: 1.2, 1.4, 3.1, 3.2, 3.3, 3.4_

- [ ] 2.1 Write property test for transaction format compliance
  - **Property 2: Transaction format compliance**
  - **Validates: Requirements 1.2**

- [ ] 2.2 Write property test for BCS serialization round-trip
  - **Property 3: BCS serialization round-trip**
  - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 2.3 Write property test for account format validation
  - **Property 5: Account format validation**
  - **Validates: Requirements 1.4, 4.3**

- [ ] 2.4 Write property test for signature validation correctness
  - **Property 8: Signature validation correctness**
  - **Validates: Requirements 3.4**

- [ ] 3. Migrate Next.js payment verification service
  - Replace Web3 RPC calls with Aptos REST API calls in lib/movement.ts
  - Update verifyPayment function to handle MOVE transactions
  - Implement MOVE token amount validation using Aptos coin operations
  - Add Aptos transaction receipt verification
  - Update middleware.ts to use new MOVE verification logic
  - _Requirements: 1.1, 1.3, 4.1, 4.2_

- [ ] 3.1 Write property test for token amount handling
  - **Property 6: Token amount handling**
  - **Validates: Requirements 2.5, 4.1**

- [ ] 3.2 Write property test for replay attack prevention consistency
  - **Property 10: Replay attack prevention consistency**
  - **Validates: Requirements 4.4**

- [ ] 3.3 Write property test for confirmation finality rules
  - **Property 11: Confirmation finality rules**
  - **Validates: Requirements 4.5**

- [ ] 4. Create API compatibility layer
  - Implement response format preservation for payment requirements
  - Add address format conversion utilities (EVM ↔ Aptos)
  - Maintain existing HTTP header formats while supporting MOVE transaction hashes
  - Create error message mapping for MOVE-specific issues
  - _Requirements: 1.5, 2.1, 2.3, 2.4_

- [ ] 4.1 Write property test for API compatibility preservation
  - **Property 4: API compatibility preservation**
  - **Validates: Requirements 1.5, 2.1, 2.3**

- [ ] 4.2 Write property test for error message specificity
  - **Property 7: Error message specificity**
  - **Validates: Requirements 2.4**

- [ ] 4.3 Write property test for invalid transaction rejection
  - **Property 9: Invalid transaction rejection**
  - **Validates: Requirements 3.5**

- [ ] 5. Update Cloudflare Worker for MOVE support
  - Modify paywall-worker.js to return MOVE transaction requirements
  - Update payment verification logic to handle Aptos transaction hashes
  - Implement MOVE-specific error responses
  - Maintain backward compatibility with existing bot clients
  - _Requirements: 2.1, 2.3, 2.4_

- [ ] 6. Migrate Python web scraper to Aptos SDK
  - Replace Web3.py with Aptos Python SDK in main.py
  - Update PaywallBreaker class to use Aptos account management
  - Implement MOVE transaction creation using Aptos SDK
  - Update RPC endpoint configuration for Aptos REST API
  - Modify transaction submission and verification logic
  - _Requirements: 2.2, 5.2_

- [ ] 6.1 Write property test for RPC endpoint validation
  - **Property 12: RPC endpoint validation**
  - **Validates: Requirements 5.2**

- [ ] 6.2 Write property test for exception handling robustness
  - **Property 13: Exception handling robustness**
  - **Validates: Requirements 6.3**

- [ ] 7. Update configuration and environment management
  - Create environment variable migration guide
  - Update .env.example files with Aptos-specific variables
  - Add configuration validation for Aptos endpoints and keys
  - Implement graceful fallback during migration period
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integration testing and end-to-end validation
  - Test complete payment flow from bot request to access grant
  - Validate MOVE transaction processing across all components
  - Test error handling scenarios with Aptos SDK exceptions
  - Verify performance improvements over EVM implementation
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 9.1 Write integration tests for complete payment flows
  - Test bot scraper → Cloudflare Worker → Next.js middleware interactions
  - Validate MOVE transaction end-to-end processing
  - Test error scenarios and recovery mechanisms
  - _Requirements: 6.4_

- [ ] 10. Documentation and deployment preparation
  - Create migration documentation with step-by-step instructions
  - Update README files with Aptos SDK setup instructions
  - Create deployment checklist for production migration
  - Document rollback procedures and troubleshooting guides
  - _Requirements: 5.4_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.