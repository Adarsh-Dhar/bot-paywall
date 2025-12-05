# Movement Payment Middleware

A Next.js application with middleware that requires bots to pay via Movement blockchain before accessing protected resources.

## Features

- **Bot Detection**: Automatically detects bots via User-Agent patterns
- **Payment Verification**: Verifies Movement blockchain transactions on-chain
- **Replay Protection**: Uses Vercel KV to prevent reuse of payment proofs
- **HTTP 402 Support**: Returns proper Payment Required status for bots

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
3. **Payment Verification**: When a payment hash is provided:
   - Checks KV store for replay protection
   - Verifies transaction on Movement blockchain
   - Validates receiver address and payment amount
   - Marks transaction as used
4. **Access Grant**: Verified bots receive `X-Bot-Tier: Premium` header

## Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_KEY`): Supabase service key used server-side
- `CLOUDFLARE_ACCOUNT_ID`: Optional default account id (user-specific stored in DB)
- `CLOUDFLARE_API_TOKEN`: Optional default token (user-specific stored in DB)
- `MOVEMENT_RPC_URL`: Movement blockchain RPC endpoint
- `MOVEMENT_WALLET_ADDRESS`: Wallet address to receive payments
- `MOVEMENT_COST_IN_MOVE`: Cost per access in MOVE tokens (default: 0.01)
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

