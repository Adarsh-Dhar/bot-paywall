# Gatekeeper Bot Firewall

Intelligent bot detection and domain protection using Cloudflare WAF rules with Prisma + PostgreSQL + Docker.

## Features

- 🔐 **Project Setup** - Connect Cloudflare and link zones
- 🤖 **Bot Detection** - WAF rules to challenge bad bots
- 🔑 **Gatekeeper Secret** - Per-project secret key authentication
- 📊 **Dashboard** - Manage protected domains
- 🔄 **Zone Discovery** - Auto-fetch zones from Cloudflare token
- 🐳 **Docker Setup** - Local PostgreSQL containers
- 🔒 **Encrypted Token Storage** - AES-256 token encryption

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose
- Cloudflare account (for domain protection)

### Setup

1. **Clone and install**:
```bash
cd main
pnpm install
```

2. **Setup database**:
```bash
./scripts/setup.sh
```

3. **Configure environment**:
```bash
cp .env.example .env
```

Add your credentials:
```env
# Database
DATABASE_URL="postgresql://gatekeeper_user:gatekeeper_password@localhost:5432/gatekeeper"

# Auth (JWT)
JWT_SECRET=your_jwt_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Token Encryption
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key
```

4. **Start development**:
```bash
pnpm dev
```

Visit `http://localhost:3000`

## Architecture

### Core Modules
- `lib/auth.ts` - JWT auth helpers (cookies + headers)
- `lib/token-encryption.ts` - AES-256-CBC encryption/decryption
- `lib/cloudflare-api.ts` - Cloudflare API utilities (WAF rules)
- `lib/prisma.ts` - Prisma client

### Server Actions (app/actions)
- `dashboard.ts` - Fetch projects for user
- `cloudflare-tokens.ts` - Save/remove user Cloudflare API token
- `cloudflare-project.ts` - Save project with token + zone metadata
- `cloudflare-skip-rule.ts` - Deploy WAF rule (skip/allow logic)
- `cloudflare-token-verification.ts` - List zones for a token
- `cloudflare-verification.ts` - Cloudflare operations + checks

### Database Schema (Prisma)
- `User` - User accounts (linked to Clerk)
- `Project` - Protected domains and their status
- `CloudflareToken` - Encrypted user API tokens
- `ApiKey` - API keys for projects (dashboard)

## Workflow

### Phase 1: Project Setup (Connect Cloudflare)
1. User creates a Cloudflare API token (Zone:Read, Firewall:Edit)
2. App fetches available zones for the token
3. User selects domain (zone) and creates a project
4. App generates a unique Gatekeeper secret and saves the project

### Phase 2: WAF Rule Deployment
1. App deploys bot detection WAF rules to the selected zone
2. Requests with missing/incorrect secret are challenged

### Phase 3: Protection Active
- Traffic flows through Cloudflare
- Bad bots are challenged or blocked
- Requests with correct `x-bot-password` are allowed

## WAF Rule Logic

The deployed rule blocks requests that match ALL of:
- Looks like a bot (curl, python, bot in user-agent, or Cloudflare bot detection)
- AND doesn't have the correct secret key in `x-bot-password` header
- AND is not a verified bot (Google, Bing, etc.)

Action: `managed_challenge` (shows CAPTCHA)

## API Endpoints

- `POST /api/auth/signin` - Sign in (JWT)
- `POST /api/auth/signup` - Sign up (JWT)
- `POST /api/auth/signout` - Sign out
- `GET  /api/auth/me` - Current user
- `POST /api/projects/public` - Project info for worker
- `POST /api/worker/config` - Worker config (decrypt tokens)
- `POST /api/x402-payment/verify` - Payment verification
- `POST /api/x402-payment/whitelist` - Payment whitelist

### Deprecated
- `POST /api/paywall/deploy` - Returns 410 Gone
- `POST /api/paywall/verify` - Returns 410 Gone

## Database Management

```bash
# Generate Prisma client
pnpm db:generate

# Push schema changes
pnpm db:push

# Create migrations
pnpm db:migrate

# Open database GUI
pnpm db:studio

# Seed database
pnpm db:seed
```

## Docker Management

```bash
# Start containers
pnpm docker:up

# Stop containers
pnpm docker:down

# View logs
pnpm docker:logs
```

## Testing

```bash
# Run all tests
pnpm test

# Run property-based tests
pnpm test:properties
```

## Deployment

### Production Checklist
- [ ] All environment variables configured
- [ ] PostgreSQL database deployed
- [ ] Cloudflare API token has correct permissions
- [ ] Clerk production keys configured
- [ ] Tests passing
- [ ] Error handling verified

### Deploy to Vercel
```bash
# Update DATABASE_URL to production PostgreSQL
vercel deploy
```

## Troubleshooting

### Domain registration fails
- Verify Cloudflare API token is correct
- Check Cloudflare account ID
- Ensure token has DNS edit permissions
- Check domain isn't already in Cloudflare

### Nameserver verification fails
- Nameserver changes take 5 minutes to 48 hours
- Verify changes at your registrar
- Use `nslookup` to check: `nslookup example.com`

### WAF rule deployment fails
- Zone might not be fully active yet
- Try again in a few minutes
- Check Cloudflare dashboard for errors

### Sign-in not working
- Verify Clerk credentials in `.env`
- Check Clerk dashboard for API keys
- Clear browser cookies and try again

### Database connection issues
- Ensure Docker containers are running: `pnpm docker:up`
- Check container logs: `pnpm docker:logs`
- Verify DATABASE_URL in `.env`

## UI Overview

- Dashboard (home): shows projects/domains
- Connect Cloudflare: create project, generate Gatekeeper secret
- Sign In / Sign Up: JWT-based authentication

## License

MIT
