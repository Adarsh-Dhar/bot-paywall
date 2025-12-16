# Dummy Transaction Configuration Guide

This document provides configuration examples for deploying the bot-paywall system in dummy transaction mode.

## Overview

The dummy transaction mode allows the bot-paywall system to operate completely offline without any blockchain dependencies. All transactions are simulated using deterministic algorithms that mimic real blockchain behavior.

## Environment Variables

### Core Dummy Transaction Configuration

```bash
# Dummy wallet address for testing (replaces blockchain wallet)
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890

# Cost per access in dummy MOVE tokens
DUMMY_COST_IN_MOVE=0.01

# Dummy transaction configuration
DUMMY_TRANSACTION_SEED=test-seed-123
DUMMY_SUCCESS_RATE=0.9
```

### Configuration Details

#### DUMMY_WALLET_ADDRESS
- **Type**: Ethereum-style address (40 hex characters)
- **Purpose**: The recipient address for all dummy transactions
- **Example**: `0x1234567890123456789012345678901234567890`
- **Default**: `0x1234567890123456789012345678901234567890`

#### DUMMY_COST_IN_MOVE
- **Type**: Decimal number
- **Purpose**: Cost per access in dummy MOVE tokens
- **Example**: `0.01` (0.01 MOVE per access)
- **Range**: 0.001 to 1000.0
- **Default**: `0.01`

#### DUMMY_TRANSACTION_SEED
- **Type**: String
- **Purpose**: Seed for deterministic transaction generation
- **Example**: `test-seed-123`
- **Note**: Same seed produces identical transactions across runs
- **Default**: `test-seed-123`

#### DUMMY_SUCCESS_RATE
- **Type**: Float between 0.0 and 1.0
- **Purpose**: Probability of transaction success (0.0 = always fail, 1.0 = always succeed)
- **Example**: `0.9` (90% success rate)
- **Range**: 0.0 to 1.0
- **Default**: `0.9`

## Configuration Scenarios

### Development Environment

```bash
# .env.development
DUMMY_WALLET_ADDRESS=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
DUMMY_COST_IN_MOVE=0.001
DUMMY_TRANSACTION_SEED=dev-seed
DUMMY_SUCCESS_RATE=1.0  # Always succeed for testing
```

### Testing Environment

```bash
# .env.test
DUMMY_WALLET_ADDRESS=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=test-seed
DUMMY_SUCCESS_RATE=0.9  # 90% success rate for realistic testing
```

### Staging Environment

```bash
# .env.staging
DUMMY_WALLET_ADDRESS=0xcccccccccccccccccccccccccccccccccccccccc
DUMMY_COST_IN_MOVE=0.05
DUMMY_TRANSACTION_SEED=staging-seed
DUMMY_SUCCESS_RATE=0.95  # 95% success rate
```

### Production Environment (Dummy Mode)

```bash
# .env.production
DUMMY_WALLET_ADDRESS=0xdddddddddddddddddddddddddddddddddddddddd
DUMMY_COST_IN_MOVE=0.1
DUMMY_TRANSACTION_SEED=prod-seed-$(date +%s)  # Unique seed per deployment
DUMMY_SUCCESS_RATE=0.99  # 99% success rate for production
```

## Deployment Scenarios

### Scenario 1: Local Development

**Goal**: Rapid development with 100% transaction success

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.001
DUMMY_TRANSACTION_SEED=local-dev
DUMMY_SUCCESS_RATE=1.0
```

**Benefits**:
- All transactions succeed immediately
- Fast iteration and testing
- No network dependencies

### Scenario 2: Integration Testing

**Goal**: Test failure scenarios and edge cases

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=integration-test
DUMMY_SUCCESS_RATE=0.7  # 70% success rate to test failures
```

**Benefits**:
- Tests both success and failure paths
- Validates error handling
- Deterministic results for reproducible tests

### Scenario 3: Load Testing

**Goal**: Benchmark system performance

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=load-test
DUMMY_SUCCESS_RATE=0.95
```

**Benefits**:
- No network latency
- Consistent performance metrics
- Can generate high transaction volumes

### Scenario 4: Multi-Format Testing

**Goal**: Test both Movement EVM and Aptos formats

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=multi-format
DUMMY_SUCCESS_RATE=0.9
```

**Supported Formats**:
- Movement EVM (40-character hex addresses)
- Aptos (64-character hex addresses)

## Cloudflare Worker Configuration

### Worker Environment Variables

```toml
# wrangler.toml
[env.dummy]
vars = { DUMMY_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890", DUMMY_COST_IN_MOVE = "0.01", DUMMY_TRANSACTION_SEED = "worker-seed", DUMMY_SUCCESS_RATE = "0.9" }
```

### Deployment Command

```bash
# Deploy with dummy transaction configuration
wrangler deploy --env dummy
```

## Performance Tuning

### High-Throughput Configuration

For systems requiring high transaction throughput:

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.001  # Lower cost for more transactions
DUMMY_TRANSACTION_SEED=high-throughput
DUMMY_SUCCESS_RATE=0.99   # High success rate
```

### Low-Latency Configuration

For systems requiring minimal latency:

```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=low-latency
DUMMY_SUCCESS_RATE=1.0    # Always succeed for predictable latency
```

## Monitoring and Debugging

### Enable Debug Logging

```bash
# Add to environment
DEBUG=dummy-transaction:*
LOG_LEVEL=debug
```

### Transaction Statistics

The system provides transaction statistics:

```typescript
const stats = simulator.getTransactionStatistics();
console.log(`Total transactions: ${stats.total}`);
console.log(`Successful: ${stats.successful}`);
console.log(`Failed: ${stats.failed}`);
console.log(`Movement format: ${stats.movement}`);
console.log(`Aptos format: ${stats.aptos}`);
```

## Troubleshooting

### Issue: Transactions Always Fail

**Solution**: Increase `DUMMY_SUCCESS_RATE`

```bash
DUMMY_SUCCESS_RATE=0.95  # Increase from 0.5 to 0.95
```

### Issue: Inconsistent Transaction Generation

**Solution**: Ensure `DUMMY_TRANSACTION_SEED` is consistent

```bash
# Use fixed seed instead of random
DUMMY_TRANSACTION_SEED=fixed-seed-123
```

### Issue: Performance Degradation

**Solution**: Check transaction store size and clear old transactions

```typescript
const stats = simulator.getTransactionStatistics();
if (stats.total > 100000) {
  // Clear old transactions or restart
}
```

## Migration from Blockchain Mode

### Step 1: Update Environment Variables

Remove blockchain RPC URLs:
```bash
# Remove these
# MOVEMENT_RPC=https://...
# APTOS_RPC=https://...
```

Add dummy transaction configuration:
```bash
DUMMY_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
DUMMY_COST_IN_MOVE=0.01
DUMMY_TRANSACTION_SEED=migration-seed
DUMMY_SUCCESS_RATE=0.9
```

### Step 2: Update Dependencies

Blockchain SDKs are already removed from package.json.

### Step 3: Verify Configuration

```bash
npm test  # Run all tests
npm run test:properties  # Run property-based tests
```

### Step 4: Deploy

```bash
npm run build
npm start
```

## Best Practices

1. **Use Consistent Seeds**: Use the same seed for reproducible testing
2. **Monitor Success Rates**: Adjust `DUMMY_SUCCESS_RATE` based on testing needs
3. **Validate Addresses**: Ensure addresses match the expected format (40 or 64 hex chars)
4. **Test Both Formats**: Verify both Movement EVM and Aptos formats work correctly
5. **Performance Testing**: Use the performance benchmarks to validate system performance

## Additional Resources

- [Design Document](../.kiro/specs/dummy-transaction-mode/design.md)
- [Requirements Document](../.kiro/specs/dummy-transaction-mode/requirements.md)
- [Implementation Plan](../.kiro/specs/dummy-transaction-mode/tasks.md)
