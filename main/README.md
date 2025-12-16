# Movement Payment Middleware (Dummy Transaction Mode)

A Next.js application with middleware that requires bots to pay via dummy transactions before accessing protected resources. This version operates completely offline without any blockchain dependencies.

## Features

- **Bot Detection**: Automatically detects bots via User-Agent patterns
- **Dummy Payment Verification**: Verifies dummy transactions without blockchain network calls
- **Replay Protection**: Uses Vercel KV to prevent reuse of payment proofs
- **HTTP 402 Support**: Returns proper Payment Required status for bots
- **Offline Operation**: No blockchain dependencies or network calls required

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env` (or use the existing `.env`)
   - Fill in your Vercel KV credentials from [Vercel Dashboard](https://vercel.com/dashboard/stores)
   - The Movement wallet address is already configured

3. Run the development server:
```bash
pnpm dev
```

## How It Works

1. **Bot Detection**: Middleware checks User-Agent for patterns like "Python", "Scraper", or "Bot"
2. **Payment Challenge**: Bots without `X-Payment-Hash` header receive HTTP 402 with payment instructions
3. **Dummy Payment Verification**: When a payment hash is provided:
   - Checks KV store for replay protection
   - Verifies transaction using dummy transaction simulator (no blockchain calls)
   - Validates receiver address and payment amount against dummy transaction data
   - Marks transaction as used
4. **Access Grant**: Verified bots receive `X-Bot-Tier: Premium` header

## Environment Variables

- `DUMMY_WALLET_ADDRESS`: Dummy wallet address for testing (replaces blockchain wallet)
- `DUMMY_COST_IN_MOVE`: Cost per access in dummy MOVE tokens (default: 0.01)
- `DUMMY_TRANSACTION_SEED`: Seed for deterministic dummy transaction generation
- `DUMMY_SUCCESS_RATE`: Success rate for dummy transaction simulation (0.0 to 1.0)
- `KV_URL`: Vercel KV connection URL
- `KV_REST_API_URL`: Vercel KV REST API URL
- `KV_REST_API_TOKEN`: Vercel KV REST API token

## Testing

Test with a bot-like User-Agent:
```bash
curl -H "User-Agent: Python/3.9" http://localhost:3000
```

Test with payment proof:
```bash
curl -H "User-Agent: Python/3.9" -H "X-Payment-Hash: 0x..." http://localhost:3000
```

