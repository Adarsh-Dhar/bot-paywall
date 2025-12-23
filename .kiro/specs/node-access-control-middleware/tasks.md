# Implementation Plan: Node.js Access Control Middleware

## Overview

Implementation of a single-file Node.js server (access-server.js) that acts as a "Pay-to-Pass" gateway, verifying Aptos blockchain payments and temporarily whitelisting IP addresses on Cloudflare for 60 seconds. The implementation uses Express.js with modular components for payment verification, Cloudflare integration, and timer management.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create package.json with required dependencies (express, body-parser, axios, @aptos-labs/ts-sdk)
  - Initialize Node.js project structure
  - Configure development environment
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement core server infrastructure
  - [x] 2.1 Create Express server with body-parser middleware
    - Set up Express application listening on port 3000
    - Configure body-parser for JSON request handling
    - Implement basic error handling middleware
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Write unit tests for server setup
    - Test server starts on correct port
    - Test JSON request parsing
    - Test basic error handling
    - _Requirements: 1.1, 1.2_

  - [x] 2.3 Implement activeTimers Map and IP detection
    - Create in-memory Map for tracking active subscriptions
    - Implement IP detection logic (use provided scraper_ip or req.ip)
    - _Requirements: 1.3, 1.4_

  - [x] 2.4 Write property test for IP detection
    - **Property 4: IP Address Handling**
    - **Validates: Requirements 5.2, 5.3**

- [ ] 3. Implement Payment Verifier component
  - [x] 3.1 Create Aptos SDK integration
    - Initialize Aptos client with proper configuration
    - Implement fetchTransaction wrapper function
    - Handle SDK connection and error cases
    - _Requirements: 2.1_

  - [x] 3.2 Write property test for Aptos SDK integration
    - **Property 8: Aptos SDK Integration**
    - **Validates: Requirements 2.1**

  - [x] 3.3 Implement payment verification logic
    - Verify transaction success status
    - Validate receiver address matches configured wallet
    - Check payment amount >= 0.01 MOVE (1,000,000 Octas)
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.4 Write property test for payment verification
    - **Property 1: Payment Verification Completeness**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [x] 3.5 Write property test for payment error handling
    - **Property 5: Error Response Consistency**
    - **Validates: Requirements 2.5, 6.4**

- [x] 4. Checkpoint - Ensure payment verification works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Cloudflare Client component
  - [x] 5.1 Create Cloudflare API client
    - Set up axios client with proper authentication headers
    - Implement base API request handling
    - Configure zone ID and API endpoints
    - _Requirements: 3.4, 3.5_

  - [x] 5.2 Write property test for Cloudflare authentication
    - **Property 9: Cloudflare API Authentication**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 5.3 Implement rule management functions
    - Create findExistingRule function (GET request to query rules by IP)
    - Create createWhitelistRule function (POST request with correct parameters)
    - Create deleteRule function (DELETE request by rule ID)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.4 Write property test for rule management
    - **Property 2: Cloudflare Rule Management Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. Implement Timer Manager component
  - [x] 6.1 Create timer management functions
    - Implement startTimer function with 60-second duration
    - Implement cancelTimer function for timer renewal
    - Handle automatic cleanup of both Cloudflare rules and activeTimers
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Write property test for timer lifecycle
    - **Property 3: Timer Lifecycle Management**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 6.3 Write property test for activeTimers state management
    - **Property 10: ActiveTimers State Management**
    - **Validates: Requirements 1.3, 4.3**

- [x] 7. Implement POST /buy-access endpoint
  - [x] 7.1 Create main API endpoint handler
    - Parse and validate request body (tx_hash, optional scraper_ip)
    - Orchestrate payment verification workflow
    - Handle IP detection and validation
    - _Requirements: 5.1, 5.4_

  - [x] 7.2 Implement access granting workflow
    - Call payment verification
    - Check and clean existing Cloudflare rules
    - Create new whitelist rule
    - Start timer for automatic cleanup
    - Return success response
    - _Requirements: 5.5_

  - [x] 7.3 Write property test for success response format
    - **Property 6: Success Response Format**
    - **Validates: Requirements 5.5**

- [x] 8. Implement logging and error handling
  - [x] 8.1 Add comprehensive logging
    - Log "Payment Verified" on successful verification
    - Log "Whitelisted IP" when rule is created
    - Log "Timer Expired - Access Revoked" on cleanup
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Write property test for logging completeness
    - **Property 7: Logging Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 8.3 Implement error handling for external API failures
    - Handle Cloudflare API errors gracefully
    - Return meaningful error messages
    - Implement proper HTTP status codes
    - _Requirements: 6.5_

- [ ] 9. Configuration and constants setup
  - [ ] 9.1 Define all configuration constants
    - CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_URL
    - PAYMENT_DESTINATION, REQUIRED_AMOUNT_OCTAS, SUBSCRIPTION_DURATION_MS
    - SERVER_PORT
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 9.2 Write unit tests for configuration constants
    - Verify all constants are defined with correct values
    - Test configuration loading
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [-] 10. Integration and final testing
  - [ ] 10.1 Wire all components together
    - Integrate Payment Verifier, Cloudflare Client, and Timer Manager
    - Ensure proper error propagation between components
    - Test end-to-end workflow
    - _Requirements: All requirements_

  - [ ] 10.2 Write integration tests
    - Test complete payment-to-access workflow
    - Test timer expiration and cleanup
    - Test concurrent request handling
    - _Requirements: All requirements_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation creates a single access-server.js file as requested
- All external API calls (Aptos, Cloudflare) should include proper error handling