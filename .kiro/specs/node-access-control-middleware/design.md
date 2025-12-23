# Design Document: Node.js Access Control Middleware

## Overview

The Node.js Access Control Middleware is a "Pay-to-Pass" gateway that integrates blockchain payment verification with Cloudflare firewall management. The system verifies Aptos blockchain payments and grants temporary (60-second) IP-based access by dynamically managing Cloudflare whitelist rules.

The architecture follows a microservice pattern with clear separation of concerns: payment verification, firewall management, and timer-based cleanup. The system maintains state in-memory for active subscriptions and provides a simple REST API for access requests.

## Architecture

The system uses a layered architecture with the following components:

```mermaid
graph TB
    Client[Client Application] --> API[REST API Layer]
    API --> PaymentVerifier[Payment Verifier]
    API --> CloudflareClient[Cloudflare Client]
    API --> TimerManager[Timer Manager]
    
    PaymentVerifier --> AptosSDK[@aptos-labs/ts-sdk]
    CloudflareClient --> CloudflareAPI[Cloudflare API]
    TimerManager --> ActiveTimers[In-Memory Map]
    
    subgraph "External Services"
        AptosSDK
        CloudflareAPI
    end
    
    subgraph "Core Components"
        PaymentVerifier
        CloudflareClient
        TimerManager
    end
```

The system operates as a single Express.js server with modular components handling specific responsibilities. All state is maintained in-memory using JavaScript Maps, making the system stateless and easily scalable horizontally.

## Components and Interfaces

### REST API Layer
- **Endpoint**: `POST /buy-access`
- **Input**: `{ tx_hash: string, scraper_ip?: string }`
- **Output**: `{ status: "granted", expires_in: "60s" }` or error responses
- **Responsibilities**: Request validation, IP detection, orchestrating payment verification and access granting

### Payment Verifier
- **Interface**: `verifyPayment(txHash: string): Promise<boolean>`
- **Dependencies**: @aptos-labs/ts-sdk
- **Responsibilities**: 
  - Fetch transaction by hash using `client.fetchTransaction({ transactionHash })`
  - Verify transaction success status
  - Validate receiver address matches configured wallet
  - Confirm payment amount >= 0.01 MOVE (1,000,000 Octas)

### Cloudflare Client
- **Interface**: 
  - `findExistingRule(ip: string): Promise<string | null>`
  - `createWhitelistRule(ip: string): Promise<string>`
  - `deleteRule(ruleId: string): Promise<void>`
- **Dependencies**: axios for HTTP requests
- **Responsibilities**:
  - Query existing rules: `GET /zones/{zoneId}/firewall/access_rules/rules?configuration.value={ip}`
  - Create whitelist rules: `POST /zones/{zoneId}/firewall/access_rules/rules`
  - Delete rules: `DELETE /zones/{zoneId}/firewall/access_rules/rules/{ruleId}`

### Timer Manager
- **Interface**: 
  - `startTimer(ip: string, ruleId: string): void`
  - `cancelTimer(ip: string): void`
- **State**: `activeTimers: Map<string, NodeJS.Timeout>`
- **Responsibilities**:
  - Manage 60-second countdown timers
  - Automatic cleanup of expired rules
  - Handle timer cancellation for renewed subscriptions

## Data Models

### Configuration Constants
```typescript
interface Config {
  CLOUDFLARE_TOKEN: string;           // "oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
  CLOUDFLARE_ZONE_ID: string;         // "11685346bf13dc3ffebc9cc2866a8105"
  CLOUDFLARE_API_URL: string;         // "https://api.cloudflare.com/client/v4"
  PAYMENT_DESTINATION: string;        // "0xYOUR_WALLET_ADDRESS_HERE"
  REQUIRED_AMOUNT_OCTAS: number;      // 1000000 (0.01 MOVE)
  SUBSCRIPTION_DURATION_MS: number;   // 60000 (60 seconds)
  SERVER_PORT: number;                // 3000
}
```

### Request/Response Models
```typescript
interface AccessRequest {
  tx_hash: string;
  scraper_ip?: string;
}

interface AccessResponse {
  status: "granted";
  expires_in: "60s";
}

interface ErrorResponse {
  error: string;
  code: number;
}
```

### Transaction Verification Model
```typescript
interface AptosTransaction {
  success: boolean;
  payload: {
    function: string;
    arguments: any[];
  };
  events: Array<{
    type: string;
    data: {
      amount?: string;
      to?: string;
    };
  }>;
}
```

### Cloudflare API Models
```typescript
interface CloudflareRule {
  id: string;
  mode: "whitelist" | "block" | "challenge";
  configuration: {
    target: "ip";
    value: string;
  };
  notes: string;
}

interface CloudflareResponse<T> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Payment Verification Completeness
*For any* transaction hash, the Payment Verifier should verify all required conditions (success status, correct receiver address, and minimum amount) before approving payment
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 2: Cloudflare Rule Management Consistency
*For any* IP address, the Cloudflare Client should check for existing rules, delete them if found, and create new whitelist rules with correct parameters (mode "whitelist", target "ip", notes "Bypass")
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Timer Lifecycle Management
*For any* granted access, the Timer Manager should start a 60-second timer, automatically clean up both the Cloudflare rule and activeTimers entry when expired, and handle timer renewal by cancelling old timers
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: IP Address Handling
*For any* access request, the system should use the provided scraper_ip when available, otherwise automatically detect the IP from req.ip
**Validates: Requirements 5.2, 5.3**

### Property 5: Error Response Consistency
*For any* invalid payment (failed verification, wrong amount, or invalid transaction hash), the system should return a 402 Payment Required error
**Validates: Requirements 2.5, 6.4**

### Property 6: Success Response Format
*For any* successful access grant, the system should return 200 OK with exactly the format { status: "granted", expires_in: "60s" }
**Validates: Requirements 5.5**

### Property 7: Logging Completeness
*For any* system operation, appropriate log messages should be generated ("Payment Verified", "Whitelisted IP", "Timer Expired - Access Revoked")
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 8: Aptos SDK Integration
*For any* transaction hash provided, the Payment Verifier should use the @aptos-labs/ts-sdk fetchTransaction method with the correct transactionHash parameter
**Validates: Requirements 2.1**

### Property 9: Cloudflare API Authentication
*For any* Cloudflare API request, the client should include the configured token in the Authorization header and target the correct zone ID
**Validates: Requirements 3.4, 3.5**

### Property 10: ActiveTimers State Management
*For any* IP address with active access, the activeTimers Map should contain an entry that is properly cleaned up when the timer expires or is cancelled
**Validates: Requirements 1.3, 4.3**

## Error Handling

The system implements comprehensive error handling across all components:

### Payment Verification Errors
- **Invalid Transaction Hash**: Return 402 with descriptive error message
- **Transaction Not Found**: Return 402 indicating transaction doesn't exist
- **Insufficient Payment**: Return 402 specifying minimum required amount
- **Wrong Recipient**: Return 402 indicating payment sent to wrong address
- **Failed Transaction**: Return 402 for transactions with success: false

### Cloudflare API Errors
- **Authentication Failures**: Log error and return 500 with generic message
- **Rate Limiting**: Implement exponential backoff and retry logic
- **Network Timeouts**: Return 503 Service Unavailable
- **Invalid Zone/Rule IDs**: Log error and return 500

### System Errors
- **Memory Exhaustion**: Graceful degradation with cleanup of oldest timers
- **Concurrent Access**: Thread-safe operations on activeTimers Map
- **Server Startup Failures**: Proper error logging and process exit

## Testing Strategy

The testing approach combines unit tests for specific functionality with property-based tests for comprehensive validation:

### Unit Testing
- **Configuration validation**: Verify all constants are properly defined
- **API endpoint availability**: Test that POST /buy-access responds correctly
- **Error response formats**: Verify specific error conditions return correct HTTP codes
- **Integration points**: Test Aptos SDK and Cloudflare API integration with mocked responses

### Property-Based Testing
- **Payment verification**: Generate random transaction data and verify validation logic
- **Timer management**: Test timer creation, expiration, and cancellation with various scenarios
- **IP handling**: Test IP detection and validation with different request formats
- **Cloudflare rule management**: Test rule creation, deletion, and querying with random IP addresses
- **Concurrent access**: Test system behavior under concurrent requests

### Testing Configuration
- **Property test iterations**: Minimum 100 iterations per property test
- **Test framework**: Jest with fast-check for property-based testing
- **Mock strategy**: Mock external APIs (Aptos, Cloudflare) while testing integration logic
- **Coverage requirements**: 90% code coverage for core business logic

Each property-based test will be tagged with the format:
**Feature: node-access-control-middleware, Property {number}: {property_text}**