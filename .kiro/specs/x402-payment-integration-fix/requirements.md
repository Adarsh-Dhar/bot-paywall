# Requirements Document

## Introduction

This document specifies the requirements for fixing the X402 payment integration between the webscraper, paywall worker, and automated bot payment system. The current system has a webscraper that gets blocked by a 403 error, but the expected flow should allow payment-based access through X402 MOVE token transactions.

## Glossary

- **X402_Payment_Flow**: The complete process where a bot makes a 0.01 MOVE payment to gain temporary access
- **Paywall_Worker**: The Cloudflare Worker that protects the website and handles payment verification
- **Webscraper_Bot**: The Python application that scrapes protected content after payment
- **Bot_Payment_System**: The Node.js service that monitors payments and manages IP whitelisting
- **IP_Whitelist_Rule**: A temporary Cloudflare firewall rule allowing specific IP access

## Requirements

### Requirement 1

**User Story:** As a webscraper operator, I want the bot to automatically handle X402 payments when blocked, so that scraping can proceed without manual intervention.

#### Acceptance Criteria

1. WHEN the webscraper receives a 403 response THEN the system SHALL detect the payment requirement and initiate X402 payment flow
2. WHEN the X402 payment is initiated THEN the webscraper SHALL transfer exactly 0.01 MOVE tokens to the designated payment address
3. WHEN the payment transaction is confirmed THEN the webscraper SHALL wait for IP whitelisting to complete
4. WHEN IP whitelisting is active THEN the webscraper SHALL retry the original request and succeed
5. WHEN the whitelist expires after 60 seconds THEN subsequent requests SHALL trigger the payment flow again if needed

### Requirement 2

**User Story:** As a website owner, I want the paywall worker to properly handle X402 payment verification, so that legitimate paying bots can access content while blocking non-paying bots.

#### Acceptance Criteria

1. WHEN a bot request is detected THEN the Paywall_Worker SHALL return a 402 Payment Required response with X402 payment details
2. WHEN an X402 payment is received THEN the Paywall_Worker SHALL verify the transaction amount and authenticity
3. WHEN payment verification succeeds THEN the Paywall_Worker SHALL trigger the Bot_Payment_System to whitelist the IP
4. WHEN the IP is whitelisted THEN the Paywall_Worker SHALL allow subsequent requests from that IP to pass through
5. WHEN payment verification fails THEN the Paywall_Worker SHALL return a 403 Forbidden response with error details

### Requirement 3

**User Story:** As a system administrator, I want the bot payment system to automatically detect payments and manage IP whitelisting, so that the payment flow works seamlessly.

#### Acceptance Criteria

1. WHEN the Bot_Payment_System starts THEN the system SHALL initialize all services and begin monitoring for payment events
2. WHEN a valid X402 payment is detected THEN the Bot_Payment_System SHALL extract the payer's IP address automatically
3. WHEN the IP address is determined THEN the Bot_Payment_System SHALL create a Cloudflare whitelist rule for exactly 60 seconds
4. WHEN the whitelist rule is created THEN the Bot_Payment_System SHALL log the operation and schedule automatic cleanup
5. WHEN 60 seconds expire THEN the Bot_Payment_System SHALL remove the whitelist rule and update the database

### Requirement 4

**User Story:** As a developer, I want proper service initialization in the main application, so that the bot payment system runs automatically when the application starts.

#### Acceptance Criteria

1. WHEN the main application starts THEN the system SHALL initialize the Bot_Payment_System instead of the old bot cleanup service
2. WHEN the ServiceInitializer component loads THEN the system SHALL start the automated bot payment system services
3. WHEN the application shuts down THEN the system SHALL gracefully stop all bot payment system services
4. WHEN services fail to initialize THEN the system SHALL log detailed error information and attempt recovery
5. WHEN the system is running THEN the Bot_Payment_System SHALL be accessible through the existing API endpoints

### Requirement 5

**User Story:** As a webscraper operator, I want the system to use the correct IP address for whitelisting, so that the payment flow works with the actual client IP.

#### Acceptance Criteria

1. WHEN determining the client IP THEN the system SHALL use the IP address 210.212.2.133 as specified in the user's configuration
2. WHEN creating whitelist rules THEN the system SHALL use the exact IP format required by Cloudflare API
3. WHEN the webscraper makes requests THEN the system SHALL ensure the request originates from the whitelisted IP address
4. WHEN IP detection fails THEN the system SHALL fall back to alternative IP detection methods
5. WHEN multiple IP addresses are detected THEN the system SHALL use the most reliable source for whitelisting