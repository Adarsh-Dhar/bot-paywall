# Implementation Plan

- [x] 1. Fix service initialization to use bot payment system
  - Update ServiceInitializer component to use automated bot payment system instead of old bot cleanup service
  - Remove references to botCleanupService and import startBotPaymentSystem
  - Add proper error handling and logging for service initialization
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 1.1 Write property test for service initialization
  - **Property 16: Application startup initializes correct service**
  - **Validates: Requirements 4.1**

- [x] 1.2 Write property test for component loading
  - **Property 17: Component loading starts payment system**
  - **Validates: Requirements 4.2**

- [x] 2. Update paywall worker to implement X402 payment flow
  - Replace 403 bot blocking with 402 Payment Required responses
  - Add X402 payment headers and details in responses
  - Implement payment verification integration with bot payment system
  - Add proper error handling for failed payment verification
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 2.1 Implement X402 response generation
  - Create function to generate proper 402 Payment Required responses with X402 headers
  - Include payment address, amount (0.01 MOVE), and currency in response
  - _Requirements: 2.1_

- [x] 2.2 Write property test for bot detection response
  - **Property 6: Bot detection returns 402 with X402 details**
  - **Validates: Requirements 2.1**

- [x] 2.3 Add payment verification logic
  - Implement X402 payment verification in paywall worker
  - Add integration with bot payment system for IP whitelisting
  - _Requirements: 2.2, 2.3_

- [x] 2.4 Write property test for payment verification
  - **Property 7: X402 payments undergo verification**
  - **Validates: Requirements 2.2**

- [x] 2.5 Write property test for successful verification
  - **Property 8: Successful verification triggers IP whitelisting**
  - **Validates: Requirements 2.3**

- [x] 3. Configure IP address management for specific client IP
  - Update bot payment system to use IP address 210.212.2.133 for whitelisting
  - Modify IP detection logic to use the configured client IP
  - Ensure Cloudflare API calls use proper IP format
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3.1 Update IP configuration
  - Set client IP to 210.212.2.133 in bot payment system configuration
  - Update IP detection methods to use configured IP address
  - _Requirements: 5.1_

- [x] 3.2 Write property test for IP configuration
  - **Property 21: IP determination uses configured address**
  - **Validates: Requirements 5.1**

- [x] 3.3 Ensure proper IP format for Cloudflare
  - Validate IP format before creating Cloudflare whitelist rules
  - Add IP format validation functions
  - _Requirements: 5.2_

- [x] 3.4 Write property test for IP format validation
  - **Property 22: Whitelist rules use proper IP format**
  - **Validates: Requirements 5.2**

- [x] 4. Enhance webscraper with X402 payment handling
  - Add detection for 402 Payment Required responses
  - Implement X402 MOVE token payment functionality
  - Add waiting logic for IP whitelisting completion
  - Implement retry logic after successful payment
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4.1 Add X402 payment detection
  - Implement logic to detect 402 responses and extract X402 payment details
  - Parse payment address, amount, and currency from response headers
  - _Requirements: 1.1_

- [x] 4.2 Write property test for payment requirement detection
  - **Property 1: Payment requirement detection triggers X402 flow**
  - **Validates: Requirements 1.1**

- [x] 4.3 Implement MOVE token payment
  - Add functionality to transfer exactly 0.01 MOVE tokens
  - Integrate with MOVE blockchain for payment transactions
  - _Requirements: 1.2_

- [x] 4.4 Write property test for payment amount
  - **Property 2: X402 payments transfer exact amount**
  - **Validates: Requirements 1.2**

- [x] 4.5 Add waiting and retry logic
  - Implement waiting for IP whitelisting after payment confirmation
  - Add retry logic for original request after whitelisting
  - _Requirements: 1.3, 1.4_

- [x] 4.6 Write property test for waiting behavior
  - **Property 3: Confirmed payments trigger waiting behavior**
  - **Validates: Requirements 1.3**

- [x] 4.7 Write property test for retry logic
  - **Property 4: Active whitelisting enables successful retries**
  - **Validates: Requirements 1.4**

- [x] 5. Implement automatic cleanup and expiration handling
  - Ensure 60-second whitelist rule expiration works correctly
  - Add logic to trigger new payment flows after expiration
  - Implement proper cleanup scheduling and execution
  - _Requirements: 1.5, 3.5_

- [x] 5.1 Verify cleanup timing
  - Ensure whitelist rules are removed after exactly 60 seconds
  - Test cleanup scheduling and execution
  - _Requirements: 3.5_

- [x] 5.2 Write property test for expiration cleanup
  - **Property 15: Expiration triggers rule removal and database updates**
  - **Validates: Requirements 3.5**

- [x] 5.3 Add expiration handling in webscraper
  - Implement logic to detect expired whitelists and trigger new payments
  - _Requirements: 1.5_

- [x] 5.4 Write property test for expiration handling
  - **Property 5: Expired whitelists trigger new payment flows**
  - **Validates: Requirements 1.5**

- [x] 6. Add comprehensive error handling and logging
  - Implement error handling for payment failures
  - Add logging for all X402 payment operations
  - Implement fallback IP detection methods
  - Add graceful shutdown handling
  - _Requirements: 2.5, 4.3, 4.4, 5.4_

- [x] 6.1 Add payment error handling
  - Implement proper error responses for failed payment verification
  - Add detailed error logging for debugging
  - _Requirements: 2.5_

- [x] 6.2 Write property test for payment failures
  - **Property 10: Failed verification returns 403 with errors**
  - **Validates: Requirements 2.5**

- [x] 6.3 Implement graceful shutdown
  - Add proper shutdown handling for all services
  - Ensure cleanup of resources during shutdown
  - _Requirements: 4.3_

- [x] 6.4 Write property test for graceful shutdown
  - **Property 18: Shutdown gracefully stops all services**
  - **Validates: Requirements 4.3**

- [x] 7. Add IP detection fallback mechanisms
  - Implement alternative IP detection methods
  - Add logic to select most reliable IP source
  - Handle IP detection failures gracefully
  - _Requirements: 5.4, 5.5_

- [x] 7.1 Implement IP detection fallbacks
  - Add multiple IP detection methods as fallbacks
  - Implement selection logic for most reliable IP source
  - _Requirements: 5.4, 5.5_

- [x] 7.2 Write property test for IP fallback
  - **Property 24: IP detection failures trigger fallback methods**
  - **Validates: Requirements 5.4**

- [x] 7.3 Write property test for IP source selection
  - **Property 25: Multiple IP detection selects most reliable source**
  - **Validates: Requirements 5.5**

- [x] 8. Integration testing and end-to-end validation
  - Test complete X402 payment flow from webscraper to paywall worker
  - Verify bot payment system integration works correctly
  - Test with actual Cloudflare API and whitelist rules
  - Validate timing and cleanup operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8.1 Write integration tests for complete flow
  - Test end-to-end X402 payment flow
  - Verify all components work together correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8.2 Test Cloudflare API integration
  - Verify whitelist rule creation and deletion
  - Test with actual Cloudflare zone and API tokens
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.