# Gatekeeper Bot Firewall

Intelligent bot detection and domain protection using Cloudflare WAF rules with Prisma + PostgreSQL + Docker.

## Features

- 🔐 **Domain Registration** - Register domains with Cloudflare
- 🤖 **Bot Detection** - Intelligent bot detection with WAF rules
- 🔑 **Secret Key Authentication** - Protect access with secret keys
- 📊 **Project Management** - Manage multiple protected domains
- 🔄 **Automatic Verification** - Auto-detect nameserver updates
- 🐳 **Docker Setup** - Local PostgreSQL + Redis containers
- 🔒 **Secure Token Storage** - Encrypted Cloudflare API tokens

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose
- Clerk account (for authentication)
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

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id

# Token Encryption
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key
```

4. **Start development**:
```bash
pnpm dev
```

Visit `http://localhost:3000`

## Architecture

### Server Actions
- `registerDomain()` - Create Cloudflare zone and save project
- `verifyAndConfigure()` - Verify nameservers and deploy WAF rule
- `getProjectsByUser()` - Fetch user's protected domains
- `getProjectById()` - Get single project details

### Cloudflare Integration
- `createCloudflareZone()` - Create DNS zone
- `getCloudflareZoneStatus()` - Check zone activation status
- `deployWAFRule()` - Deploy bot detection rule
- `getOrCreateRuleset()` - Manage WAF rulesets

### Database Schema (Prisma)
- `User` - User accounts (linked to Clerk)
- `Project` - Protected domains and their status
- `CloudflareToken` - Encrypted user API tokens
- `ApiKey` - API keys for projects (dashboard)

## Workflow

### Phase 1: Domain Registration
1. User enters domain name
2. System creates Cloudflare zone
3. Generates secret key for bot authentication
4. Saves project to database
5. Shows nameservers to user

### Phase 2: Nameserver Update
1. User updates nameservers at registrar
2. User clicks "Verify Now"
3. System checks Cloudflare zone status
4. If active, deploys WAF rule
5. Updates project status to "protected"

### Phase 3: Protection Active
- All requests go through Cloudflare
- WAF rule blocks bots without secret key
- Legitimate users pass through
- Requests with correct `x-bot-password` header allowed

## WAF Rule Logic

The deployed rule blocks requests that match ALL of:
- Looks like a bot (curl, python, bot in user-agent, or Cloudflare bot detection)
- AND doesn't have the correct secret key in `x-bot-password` header
- AND is not a verified bot (Google, Bing, etc.)

Action: `managed_challenge` (shows CAPTCHA)

## API Endpoints

### Deprecated Endpoints
- `POST /api/paywall/deploy` - Returns 410 Gone
- `POST /api/paywall/verify` - Returns 410 Gone

These endpoints are no longer supported. Use Gatekeeper domain protection instead.

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

## Documentation

- [Prisma Migration Guide](./PRISMA_MIGRATION_COMPLETE.md)
- [Cloudflare Token Setup](./CLOUDFLARE_TOKEN_SETUP.md)

## License

MIT
