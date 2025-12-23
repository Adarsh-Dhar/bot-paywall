# X402 Payment Integration for Simple Webscraper

## Overview

This webscraper has been integrated with x402 payment functionality to automatically handle paywalled content. When the scraper encounters a 402 Payment Required response, it simulates making a MOVE token payment and waits for the IP to be whitelisted.

## How It Works

1. **Initial Request**: The scraper makes a request to the target URL
2. **Payment Detection**: If a 402 status code is received, the scraper parses the payment requirements
3. **Payment Simulation**: The scraper simulates making a MOVE token payment to the specified address
4. **Retry Logic**: After payment, the scraper retries the request multiple times, waiting for the IP to be whitelisted
5. **Content Access**: Once whitelisted, the scraper can access the protected content

## Files

- `scraper.py` - Main scraper with payment integration
- `x402_payment_handler.py` - Payment handler class (copied from webscrapper directory)
- `requirements.txt` - Python dependencies

## Current Implementation Status

### What's Working

✅ Payment detection (402 status code)
✅ Payment requirement parsing from response body
✅ Payment simulation (mock blockchain transaction)
✅ Transaction ID generation
✅ Retry logic with exponential backoff
✅ Browser-like headers to reduce bot detection

### What's Not Working (Requires Real Implementation)

❌ **Actual blockchain transactions**: Currently simulated, needs real MOVE blockchain integration
❌ **Payment verification**: The bot payment system endpoints (/verify, /whitelist) are not implemented in the current server
❌ **IP whitelisting automation**: Manual whitelisting works, but automatic whitelisting after payment is not connected

## Testing

### Manual Testing with Whitelisting

To test the scraper with manual IP whitelisting:

```bash
# 1. Whitelist your IP (or the configured IP 210.212.2.133)
./create-whitelist.sh

# 2. Run the scraper
cd simple-webscrapper
python scraper.py
```

### Current Behavior

When you run the scraper now:
1. It detects the 402 payment requirement
2. Simulates a payment transaction
3. Retries the request 10 times over 30 seconds
4. Times out because the payment isn't actually processed

## Production Implementation Requirements

To make this work in production, you need to:

### 1. Implement Real Blockchain Transactions

Replace the simulated payment in `x402_payment_handler.py` with actual MOVE blockchain transactions:

```python
def make_move_payment(self, payment_address: str, amount: float) -> str:
    # Use Movement SDK or Aptos SDK to:
    # 1. Create a transaction
    # 2. Sign it with your private key
    # 3. Broadcast to the blockchain
    # 4. Wait for confirmation
    # 5. Return the actual transaction hash
    pass
```

### 2. Implement Payment Verification Endpoints

Add these endpoints to your server (currently at `server/src/index.ts`):

```typescript
// Verify a payment transaction
app.post("/api/x402-payment/verify", async (req, res) => {
  const { transactionId, clientIP, expectedAmount, expectedCurrency } = req.body;
  
  // 1. Query the blockchain for the transaction
  // 2. Verify it's confirmed
  // 3. Verify the amount and recipient
  // 4. Return verification result
  
  res.json({ verified: true/false, error: null });
});

// Trigger IP whitelisting
app.post("/api/x402-payment/whitelist", async (req, res) => {
  const { transactionId, clientIP, duration } = req.body;
  
  // 1. Call Cloudflare API to add IP to whitelist
  // 2. Set expiration time
  // 3. Return success/failure
  
  res.json({ success: true/false, error: null });
});
```

### 3. Configure Environment Variables

Create a `.env` file in `simple-webscrapper/`:

```bash
# Blockchain Configuration
MOVE_NETWORK_ID=testnet  # or mainnet
MOVE_RPC_ENDPOINT=https://aptos.testnet.porto.movementlabs.xyz/v1
MOVE_PRIVATE_KEY=your_private_key_here

# Payment Configuration
PAYMENT_ADDRESS=0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b
BOT_PAYMENT_SYSTEM_URL=http://localhost:4402

# Cloudflare Configuration (for whitelisting)
CLOUDFLARE_ZONE_ID=11685346bf13dc3ffebc9cc2866a8105
CLOUDFLARE_API_TOKEN=your_api_token_here
```

### 4. Update the Cloudflare Worker

The Cloudflare worker at `cloudflare-worker/paywall-worker.js` needs to be configured with:
- `BOT_PAYMENT_SYSTEM_URL`: URL of your payment verification server
- `PAYMENT_ADDRESS`: The address where payments should be sent
- `API_TOKEN`: Token for authenticating with your payment system

## Architecture

```
┌─────────────────┐
│   Webscraper    │
│  (Python Bot)   │
└────────┬────────┘
         │ 1. Request
         ▼
┌─────────────────┐
│  Cloudflare     │
│    Worker       │◄──────┐
└────────┬────────┘       │
         │ 2. 402         │ 6. Whitelist IP
         │ Payment        │
         │ Required       │
         ▼                │
┌─────────────────┐       │
│   Webscraper    │       │
│  Makes Payment  │       │
└────────┬────────┘       │
         │ 3. Transaction │
         ▼                │
┌─────────────────┐       │
│  MOVE Blockchain│       │
└────────┬────────┘       │
         │ 4. Confirm     │
         ▼                │
┌─────────────────┐       │
│  Bot Payment    │───────┘
│     System      │
│   (Your Server) │
└─────────────────┘
```

## Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **API Tokens**: Use environment variables for sensitive tokens
3. **Payment Amounts**: Validate payment amounts match expectations
4. **Transaction Verification**: Always verify transactions on-chain
5. **IP Whitelisting**: Implement expiration to prevent abuse
6. **Rate Limiting**: Add rate limiting to prevent spam

## Next Steps

1. Set up a MOVE wallet with testnet tokens
2. Implement real blockchain transaction functionality
3. Deploy the payment verification server
4. Configure the Cloudflare worker with the correct endpoints
5. Test end-to-end payment flow
6. Monitor and log all transactions for debugging

## Support

For questions about:
- MOVE blockchain integration: See Movement Labs documentation
- Cloudflare API: See Cloudflare API documentation
- x402 protocol: See x402plus library documentation
