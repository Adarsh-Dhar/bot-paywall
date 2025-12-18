# Gatekeeper Bot Firewall

Intelligent bot detection and domain protection using Cloudflare WAF rules.

## Features

- 🔐 **Domain Registration** - Register domains with Cloudflare
- 🤖 **Bot Detection** - Intelligent bot detection with WAF rules
- 🔑 **Secret Key Authentication** - Protect access with secret keys
- 📊 **Project Management** - Manage multiple protected domains
- 🔄 **Automatic Verification** - Auto-detect nameserver updates

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Clerk account (for authentication)
- Supabase account (for database)
- Cloudflare account (for domain protection)

### Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Add your credentials:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

### Installation

```bash
cd main
pnpm install
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

### Database Schema
- `projects` - Protected domains and their status
- `api_keys` - API keys for projects (dashboard)

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

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test __tests__/integration/supabase-clerk-integration.test.ts

# Run property-based tests
pnpm test:properties
```

## Deployment

### Production Checklist
- [ ] All environment variables configured
- [ ] Supabase database initialized
- [ ] Cloudflare API token has correct permissions
- [ ] Clerk production keys configured
- [ ] Tests passing
- [ ] Error handling verified

### Deploy to Vercel
```bash
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
- Verify Clerk credentials in `.env.local`
- Check Clerk dashboard for API keys
- Clear browser cookies and try again

## Documentation

- [Gatekeeper Setup Guide](./GATEKEEPER_SETUP.md)
- [Setup Complete](./SETUP_COMPLETE.md)

## License

MIT
