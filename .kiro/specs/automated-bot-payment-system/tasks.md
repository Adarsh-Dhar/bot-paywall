# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for payment system components
  - Define TypeScript interfaces for all services and data models
  - Set up testing framework with fast-check for property-based testing
  - _Requirements: 5.1, 5.2_

- [x] 1.1 Create core data model interfaces and types
  - Write TypeScript interfaces for PaymentRecord, BotAllowedEntry, and AccessRule
  - Implement validation functions for payment amounts and IP addresses
  - _Requirements: 1.2, 4.2_

- [x] 1.2 Write property test for payment validation
  - **Property 2: Valid payment transactions pass verification**
  - **Validates: Requirements 1.2**

- [x] 1.3 Write property test for IP validation
  - **Property 24: IP detection uses consistent method**
  - **Validates: Requirements 5.5**

- [x] 2. Implement payment verification service
  - Create PaymentVerificationService class with x402 transaction validation
  - Implement amount verification for exactly 0.01 MOVE tokens
  - Add IP address extraction functionality using curl icanhazip.com method
  - _Requirements: 1.2, 1.3, 5.5_

- [x] 2.1 Write property test for payment verification
  - **Property 3: Successful payment verification extracts IP address**
  - **Validates: Requirements 1.3**

- [x] 2.2 Write property test for duplicate payment handling
  - **Property 15: Duplicate payments prevent duplicate whitelist entries**
  - **Validates: Requirements 4.1**

- [x] 2.3 Write property test for incorrect payment rejection
  - **Property 16: Incorrect payment amounts are rejected with error messages**
  - **Validates: Requirements 4.2**

- [x] 3. Create database service integration
  - Implement DatabaseService class using existing Prisma schema
  - Add methods for BotsAllowed table operations (create, update, query)
  - Ensure compatibility with existing BotsAllowed table structure
  - _Requirements: 1.4, 5.2_

- [x] 3.1 Write property test for database operations
  - **Property 4: IP addresses are stored with payment timestamps**
  - **Validates: Requirements 1.4**

- [x] 3.2 Write property test for schema compatibility
  - **Property 21: Database integration uses existing schema**
  - **Validates: Requirements 5.2**

- [x] 3.3 Write property test for database logging
  - **Property 13: Database modifications are logged**
  - **Validates: Requirements 3.3**

- [x] 4. Implement Cloudflare API client
  - Create CloudflareClient class using existing API tokens and zone configuration
  - Implement whitelist rule creation and deletion methods
  - Add rate limiting and retry logic for API calls
  - _Requirements: 1.5, 2.2, 4.4, 5.3_

- [x] 4.1 Write property test for whitelist rule creation
  - **Property 5: Database entries trigger whitelist rule creation**
  - **Validates: Requirements 1.5**

- [x] 4.2 Write property test for rule removal
  - **Property 7: Scheduled rules are removed at expiration**
  - **Validates: Requirements 2.2**

- [x] 4.3 Write property test for API configuration usage
  - **Property 22: Cloudflare API calls use existing tokens**
  - **Validates: Requirements 5.3**

- [x] 4.4 Write property test for rate limiting handling
  - **Property 18: Rate limits trigger backoff strategies**
  - **Validates: Requirements 4.4**

- [x] 5. Create cleanup scheduler service
  - Implement CleanupScheduler class with 60-second scheduling
  - Add automatic whitelist rule removal functionality
  - Implement database entry updates with expiration timestamps
  - _Requirements: 2.1, 2.3_

- [x] 5.1 Write property test for cleanup scheduling
  - **Property 6: Whitelist rules are scheduled for 60-second removal**
  - **Validates: Requirements 2.1**

- [x] 5.2 Write property test for database updates after cleanup
  - **Property 8: Whitelist removal updates database entries**
  - **Validates: Requirements 2.3**

- [x] 6. Implement comprehensive logging service
  - Create LoggingService class for all system operations
  - Add logging for payment verification, Cloudflare operations, and database changes
  - Implement structured logging with timestamps and context
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.1 Write property test for payment logging
  - **Property 11: Payment verification events are logged completely**
  - **Validates: Requirements 3.1**

- [x] 6.2 Write property test for Cloudflare operation logging
  - **Property 12: Cloudflare operations are logged with status**
  - **Validates: Requirements 3.2**

- [x] 6.3 Write property test for error logging
  - **Property 14: Errors are logged with detailed context**
  - **Validates: Requirements 3.4**

- [x] 7. Create bot execution monitoring service
  - Implement BotExecutionMonitor to detect webscraper execution
  - Add integration with existing monitoring mechanisms
  - Trigger payment verification workflow on bot detection
  - _Requirements: 1.1, 5.4_

- [x] 7.1 Write property test for bot detection
  - **Property 1: Bot execution detection triggers payment verification**
  - **Validates: Requirements 1.1**

- [x] 7.2 Write property test for monitoring integration
  - **Property 23: Webscraper execution detection uses existing mechanisms**
  - **Validates: Requirements 5.4**

- [ ] 8. Implement error handling and retry logic
  - Add exponential backoff for failed cleanup operations
  - Implement administrator alerting for multiple failures
  - Create comprehensive error logging with context
  - _Requirements: 2.4, 2.5_

- [ ] 8.1 Write property test for retry logic
  - **Property 9: Failed cleanup operations trigger retry with backoff**
  - **Validates: Requirements 2.4**

- [ ] 8.2 Write property test for failure alerting
  - **Property 10: Multiple cleanup failures generate alerts**
  - **Validates: Requirements 2.5**

- [ ] 9. Add network resilience and caching
  - Implement retry logic for network connectivity issues
  - Add operation caching for database unavailability scenarios
  - Create replay mechanism for cached operations
  - _Requirements: 4.3, 4.5_

- [ ] 9.1 Write property test for network retry logic
  - **Property 17: Network issues trigger retry logic**
  - **Validates: Requirements 4.3**

- [ ] 9.2 Write property test for database caching
  - **Property 19: Database unavailability triggers caching and replay**
  - **Validates: Requirements 4.5**

- [ ] 10. Create system configuration and startup
  - Implement configuration loading from environment variables and files
  - Add system initialization and service orchestration
  - Ensure compatibility with existing configuration structure
  - _Requirements: 5.1_

- [ ] 10.1 Write property test for configuration loading
  - **Property 20: System startup reads existing configuration**
  - **Validates: Requirements 5.1**

- [x] 11. Integrate all services into main application
  - Create main application entry point that orchestrates all services
  - Wire together payment verification, IP management, and cleanup scheduling
  - Replace existing bot-cleanup.ts with new automated bot payment system
  - Add graceful shutdown and error recovery mechanisms
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 11.1 Write integration tests for end-to-end payment flow
  - Test complete workflow from bot detection to cleanup
  - Verify all services work together correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.