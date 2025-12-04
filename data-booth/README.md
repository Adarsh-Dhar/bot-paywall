# Bot Tollbooth

A Movement-ready paywall that runs in Next.js middleware and deploys to Cloudflare Pages + D1 on the edge.

## Phase 1 – Database

1. Authenticate and create the D1 database:

```bash
npx wrangler login
npx wrangler d1 create tollbooth-db
```

2. Apply the schema (remove `--local` for production):

```bash
npx wrangler d1 execute tollbooth-db --local --file=./schema.sql
```

## Phase 2 – Development

- Update `NEXT_PUBLIC_MERCHANT_WALLET` in `.env.local` so middleware knows where to route payments.
- Premium endpoints live under `/api/premium/*` and are guarded by `middleware.ts`.
- The Movement Bardock RPC is configured via `viem` for on-chain verification.

## Phase 3 – Agent Test Script

Use the included helper to simulate an autonomous agent paying the toll:

```bash
MOVE_TEST_WALLET_KEY=0xYOUR_KEY \
TOLLBOOTH_TARGET_URL=http://localhost:3000/api/premium/data \
node scripts/agent-bot.js
```

The script intentionally performs a 402 request, reads the payment headers, pays via Movement, and retries with proof.

## Phase 4 – Deploy to Cloudflare Pages

1. Build the project (generates `.vercel/output` for `@cloudflare/next-on-pages`):

```bash
npm run build
```

2. Deploy the static output:

```bash
npx wrangler pages deploy .vercel/output/static --project-name bot-tollbooth
```

3. In the Cloudflare dashboard, go to **Settings → Functions** and bind the D1 variable **`DB`** to the `tollbooth-db` instance (matches `binding = "DB"` in `wrangler.toml`).

