# Requirements Document

## Introduction

A Node.js server that acts as a "Pay-to-Pass" gateway, verifying blockchain payments on Aptos/Movement and temporarily whitelisting IP addresses on Cloudflare for exactly 60 seconds. This middleware enables monetized access control by requiring users to make a blockchain payment before gaining temporary access to protected resources.

## Glossary

- **Access_Server**: The Node.js Express server that handles payment verification and IP whitelisting
- **Payment_Verifier**: Component that validates Aptos blockchain transactions
- **Cloudflare_Client**: Component that manages Cloudflare firewall rules
- **Timer_Manager**: Component that tracks and manages active subscriptions with automatic cleanup
- **Scraper_IP**: The IP address that will be granted temporary access after payment verification

## Requirements

### Requirement 1: Server Infrastructure

**User Story:** As a system administrator, I want a robust Express server infrastructure, so that the access control system can handle payment verification requests reliably.

#### Acceptance Criteria

1. THE Access_Server SHALL listen on port 3000
2. THE Access_Server SHALL use Express with body-parser middleware for JSON request handling
3. THE Access_Server SHALL maintain an in-memory Map called activeTimers to track running subscriptions
4. THE Access_Server SHALL automatically detect client IP addresses when not explicitly provided
5. THE Access_Server SHALL handle concurrent requests without blocking

### Requirement 2: Payment Verification

**User Story:** As a user, I want my blockchain payment to be verified accurately, so that I only gain access when I've paid the correct amount to the right address.

#### Acceptance Criteria

1. WHEN a transaction hash is provided, THE Payment_Verifier SHALL fetch the transaction using @aptos-labs/ts-sdk
2. THE Payment_Verifier SHALL verify the transaction success status is true
3. THE Payment_Verifier SHALL verify the receiver matches the configured wallet address (0xYOUR_WALLET_ADDRESS_HERE)
4. THE Payment_Verifier SHALL verify the amount is greater than or equal to 0.01 MOVE (1,000,000 Octas)
5. IF payment verification fails, THEN THE Access_Server SHALL return a 402 Payment Required error

### Requirement 3: Cloudflare Integration

**User Story:** As a system operator, I want seamless Cloudflare firewall management, so that IP addresses can be whitelisted and removed automatically without manual intervention.

#### Acceptance Criteria

1. THE Cloudflare_Client SHALL check for existing rules before creating new ones
2. WHEN an existing rule is found for an IP, THE Cloudflare_Client SHALL delete it first to reset the timer
3. THE Cloudflare_Client SHALL create whitelist rules with mode "whitelist", target "ip", and notes "Bypass"
4. THE Cloudflare_Client SHALL use the configured Cloudflare token (oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB) for authentication
5. THE Cloudflare_Client SHALL target the configured zone ID (11685346bf13dc3ffebc9cc2866a8105)

### Requirement 4: Timer Management and Cleanup

**User Story:** As a user, I want my access to expire automatically after 60 seconds, so that the system maintains security by not granting indefinite access.

#### Acceptance Criteria

1. WHEN access is granted, THE Timer_Manager SHALL start a 60-second countdown timer
2. WHEN the timer expires, THE Timer_Manager SHALL automatically delete the Cloudflare rule
3. WHEN the timer expires, THE Timer_Manager SHALL remove the IP from activeTimers
4. WHEN a user pays again while their timer is active, THE Timer_Manager SHALL cancel the old timer and start a new 60-second timer
5. THE Timer_Manager SHALL log "Timer Expired - Access Revoked" when access is automatically removed

### Requirement 5: API Endpoint Implementation

**User Story:** As a client application, I want a simple REST API endpoint, so that I can request access by providing a transaction hash and optional IP address.

#### Acceptance Criteria

1. THE Access_Server SHALL provide a POST /buy-access endpoint
2. WHEN scraper_ip is provided in the request body, THE Access_Server SHALL use that IP address
3. WHEN scraper_ip is missing, THE Access_Server SHALL automatically detect the IP from req.ip
4. THE Access_Server SHALL accept JSON requests with tx_hash and optional scraper_ip fields
5. WHEN access is granted, THE Access_Server SHALL return 200 OK with status "granted" and expires_in "60s"

### Requirement 6: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error handling and logging, so that I can monitor system behavior and troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN payment is verified successfully, THE Access_Server SHALL log "Payment Verified"
2. WHEN an IP is whitelisted, THE Access_Server SHALL log "Whitelisted IP"
3. WHEN access expires, THE Access_Server SHALL log "Timer Expired - Access Revoked"
4. WHEN invalid transaction hashes are provided, THE Access_Server SHALL return appropriate error responses
5. WHEN Cloudflare API calls fail, THE Access_Server SHALL handle errors gracefully and return meaningful error messages

### Requirement 7: Configuration Management

**User Story:** As a system administrator, I want centralized configuration constants, so that I can easily modify system parameters without changing code throughout the application.

#### Acceptance Criteria

1. THE Access_Server SHALL define Cloudflare token as a configuration constant
2. THE Access_Server SHALL define Cloudflare zone ID as a configuration constant
3. THE Access_Server SHALL define payment destination wallet address as a configuration constant
4. THE Access_Server SHALL define required payment amount (0.01 MOVE) as a configuration constant
5. THE Access_Server SHALL define subscription duration (60 seconds) as a configuration constant