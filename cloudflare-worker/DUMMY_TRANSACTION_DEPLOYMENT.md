# Cloudflare Worker Dummy Transaction Deployment Guide

This document provides deployment instructions for the Cloudflare Worker in dummy transaction mode.

## Overview

The Cloudflare Worker has been updated to use dummy transactions exclusively, eliminating all blockchain dependencies while maintaining the same API interface.

## Deployment Configuration

### Environment Variables

```toml
# wrangler.toml
[env.dummy]
name = "paywall-worker-dummy"
main = "paywall-worker.js"

[env.dummy.vars]
DUMMY_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
DUMMY_COST_IN_MOVE = "0.01"
DUMMY_TRANSACTION_SEED = "worker-seed"
DUMMY_SUCCESS_RATE = "0.9"
```

### Deployment Commands

```bash
# Deploy to development environment
wrangler deploy --env dummy

# Deploy to production environment
wrangler deploy --env dummy --compatibility-date 2024-01-01
```

## API Endpoints

### Payment Verification Endpoint

**Endpoint**: `POST /verify`

**Request**:
```json
{
  "transaction_hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "recipient": "0x1234567890123456789012345678901234567890",
  "amount": "1000000000000000000"
}
```

**Response (Success)**:
```json
{
  "valid": true,
  "transaction_hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "message": "Payment verified successfully"
}
```

**Response (Failure)**:
```json
{
  "valid": false,
  "reason": "Insufficient payment amount",
  "transaction_hash": "0x1234567890123456789012345678901234567890123456789012345678901234"
}
```

### Payment Required Endpoint

**Endpoint**: `GET /`

**Response (402 Payment Required)**:
```json
{
  "error": "Payment Required",
  "message": "Payment is required to access this resource",
  "payment_address": "0x1234567890123456789012345678901234567890",
  "price_move": "0.01",
  "chain_id": "dummy"
}
```

## Deployment Scenarios

### Scenario 1: Development Deployment

```bash
# Deploy with 100% success rate for testing
wrangler deploy --env dummy

# Configuration
DUMMY_SUCCESS_RATE=1.0
DUMMY_COST_IN_MOVE=0.001
```

### Scenario 2: Staging Deployment

```bash
# Deploy with realistic success rate
wrangler deploy --env dummy

# Configuration
DUMMY_SUCCESS_RATE=0.95
DUMMY_COST_IN_MOVE=0.01
```

### Scenario 3: Production Deployment

```bash
# Deploy with high reliability
wrangler deploy --env dummy

# Configuration
DUMMY_SUCCESS_RATE=0.99
DUMMY_COST_IN_MOVE=0.1
```

## Testing the Deployment

### Test Payment Verification

```bash
# Test with valid transaction hash
curl -X POST https://your-worker.dev/verify \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "recipient": "0x1234567890123456789012345678901234567890",
    "amount": "1000000000000000000"
  }'
```

### Test Payment Required Response

```bash
# Test without payment hash
curl https://your-worker.dev/
```

### Run Property-Based Tests

```bash
npm test
```

## Monitoring

### View Worker Logs

```bash
wrangler tail --env dummy
```

### Monitor Error Rates

The worker logs all verification attempts. Monitor for:
- Failed transaction validations
- Invalid transaction formats
- Configuration errors

## Rollback Procedure

If issues occur, rollback to the previous version:

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback --env dummy
```

## Performance Metrics

### Expected Performance

- **Transaction Verification**: > 1000 verifications/second
- **Response Time**: < 10ms average
- **Success Rate**: Configurable (default 90%)

### Monitoring Performance

```bash
# Check worker analytics
wrangler analytics --env dummy
```

## Troubleshooting

### Issue: 402 Payment Required for All Requests

**Cause**: Worker is not receiving transaction hash

**Solution**: Verify request headers include transaction hash

```bash
curl -X POST https://your-worker.dev/verify \
  -H "X-Payment-Hash: 0x1234567890123456789012345678901234567890123456789012345678901234"
```

### Issue: All Transactions Fail

**Cause**: Success rate is too low

**Solution**: Increase `DUMMY_SUCCESS_RATE`

```toml
[env.dummy.vars]
DUMMY_SUCCESS_RATE = "0.95"
```

### Issue: Inconsistent Responses

**Cause**: Seed is changing between deployments

**Solution**: Use fixed seed

```toml
[env.dummy.vars]
DUMMY_TRANSACTION_SEED = "fixed-seed-123"
```

## Configuration Examples

### High-Throughput Configuration

```toml
[env.high-throughput]
name = "paywall-worker-high-throughput"

[env.high-throughput.vars]
DUMMY_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
DUMMY_COST_IN_MOVE = "0.001"
DUMMY_TRANSACTION_SEED = "high-throughput"
DUMMY_SUCCESS_RATE = "0.99"
```

### Low-Cost Configuration

```toml
[env.low-cost]
name = "paywall-worker-low-cost"

[env.low-cost.vars]
DUMMY_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
DUMMY_COST_IN_MOVE = "0.001"
DUMMY_TRANSACTION_SEED = "low-cost"
DUMMY_SUCCESS_RATE = "0.9"
```

### Testing Configuration

```toml
[env.testing]
name = "paywall-worker-testing"

[env.testing.vars]
DUMMY_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
DUMMY_COST_IN_MOVE = "0.01"
DUMMY_TRANSACTION_SEED = "testing"
DUMMY_SUCCESS_RATE = "0.7"  # Test failure scenarios
```

## Multi-Format Support

The worker supports both Movement EVM and Aptos transaction formats:

### Movement EVM Format

```json
{
  "hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "to": "0x1234567890123456789012345678901234567890",
  "from": "0x0000000000000000000000000000000000000000",
  "value": "0x0de0b6b3a7640000",
  "status": "0x1"
}
```

### Aptos Format

```json
{
  "hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "sender": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "payload": {
    "type": "entry_function_payload",
    "function": "0x1::coin::transfer",
    "arguments": ["0x1234567890123456789012345678901234567890", "1000000000"]
  },
  "success": true
}
```

## Security Considerations

### Dummy Mode Limitations

- **No Real Transactions**: All transactions are simulated
- **No Blockchain Verification**: No on-chain validation occurs
- **Deterministic**: Same seed produces same results
- **For Testing Only**: Not suitable for production payment processing

### Best Practices

1. **Use Different Seeds**: Use different seeds for different environments
2. **Monitor Success Rates**: Adjust based on testing needs
3. **Validate Addresses**: Ensure addresses are properly formatted
4. **Test Thoroughly**: Run all property-based tests before deployment
5. **Document Configuration**: Keep configuration documented for team

## Integration with Main Application

The worker integrates with the main Next.js application:

1. **Payment Verification**: Main app calls worker to verify payments
2. **Deterministic Results**: Same transaction hash produces same result
3. **Multi-Format Support**: Both Movement and Aptos formats supported
4. **Error Handling**: Consistent error messages across formats

## Additional Resources

- [Main Application Configuration](../main/DUMMY_TRANSACTION_CONFIG.md)
- [Design Document](../.kiro/specs/dummy-transaction-mode/design.md)
- [Requirements Document](../.kiro/specs/dummy-transaction-mode/requirements.md)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
