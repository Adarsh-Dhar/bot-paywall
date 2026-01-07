# Gatekeeper Bot Firewall - Cloudflare Worker

A powerful Cloudflare Worker that implements intelligent bot detection and blockchain-based payment verification at the edge. Part of the Gatekeeper Bot Firewall ecosystem.

## 🎯 Overview

The Gatekeeper Worker sits at Cloudflare's edge network and provides:
- **Smart Bot Detection** - Identifies bot traffic using User-Agent analysis
- **IP Whitelisting** - Automatic access for paid bots via Cloudflare firewall rules
- **Blockchain Verification** - Validates payment proofs from Movement blockchain
- **Dynamic Configuration** - Fetches project settings from your Gatekeeper dashboard
- **Zero KV Required** - Works on Cloudflare's free plan with in-memory caching

## 🚀 How It Works

```
1. Request arrives at edge → Worker intercepts
2. Check headers for credentials (scrapers) or fetch from API (config)
3. Verify IP whitelist using Cloudflare Firewall API
4. If whitelisted → Forward to origin ✅
5. If bot detected → Return 402 Payment Required 💰
6. Regular users → Forward to origin 🌐
```

## 📋 Setup Instructions

### Prerequisites

- Cloudflare account with Workers enabled
- Gatekeeper dashboard deployed and running
- Movement blockchain wallet for payment collection
- Domain added to Cloudflare

### 1. Install Dependencies

### 1. Install Dependencies

```bash
cd cloudflare-worker
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file or set variables in `wrangler.toml`:

```toml
# wrangler.toml
name = "gatekeeper-worker"
main = "paywall-worker.js"
compatibility_date = "2024-01-01"

[vars]
# Your Gatekeeper Dashboard API
API_BASE_URL = "https://your-dashboard.com"
WORKER_API_KEY = "your-secure-api-key"

# Payment Configuration
PAYMENT_ADDRESS = "0xYourMovementWalletAddress"
PRICE_AMOUNT = "0.01"
PRICE_CURRENCY = "MOVE"

# Access Server (handles payment verification)
ACCESS_SERVER_URL = "https://your-access-server.com"
```

### 3. Deploy to Cloudflare

#### Using Wrangler CLI (Recommended)

```bash
# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy

# View logs in real-time
wrangler tail
```

#### Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create Application**
3. Click **Create Worker**
4. Name it `gatekeeper-worker`
5. Paste the contents of `paywall-worker.js`
6. Add environment variables in **Settings** → **Variables**
7. Click **Deploy**

### 4. Configure Routes

Connect your domain to the worker:

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Select your worker → **Triggers** tab
3. Click **Add Route**
4. Configure:
   - **Route**: `yourdomain.com/*` or `yourdomain.com/protected/*`
   - **Zone**: Select your domain
5. Save

### 5. Connect to Gatekeeper Dashboard

1. Open your Gatekeeper dashboard at your main app URL
2. Go to **Connect Cloudflare** section
3. Add your Cloudflare API token with these permissions:
  - Account → Account WAF → Read
  - Zone → Zone → Read
  - Zone → Firewall Services → Edit
4. Add your domain to start protection
5. The worker will automatically fetch configuration from the dashboard

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_BASE_URL` | Yes | - | Your Gatekeeper dashboard URL |
| `WORKER_API_KEY` | Yes | - | Secure key for worker authentication |
| `PAYMENT_ADDRESS` | Yes | - | Movement blockchain wallet address |
| `PRICE_AMOUNT` | No | "0.01" | Price per access in MOVE tokens |
| `PRICE_CURRENCY` | No | "MOVE" | Currency type |
| `ACCESS_SERVER_URL` | Yes | - | Payment verification server URL |

### In-Memory Cache

The worker caches project configurations for **5 minutes** to reduce API calls:
- Fetches zone ID, Cloudflare token, origin URL from dashboard
- Auto-refreshes when cache expires
- Cleared on worker restart

## 🧪 Testing

### Test Bot Detection

```bash
# Regular browser (should pass through)
curl https://yourdomain.com/test

# Bot user-agent (should return 402)
curl -H "User-Agent: python-requests/2.28.0" https://yourdomain.com/test
```

Expected 402 Response:

```json
{
  "error": "Payment Required",
  "message": "Bot access requires payment",
  "payment_context": {
    "address": "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b",
    "amount": "0.01",
    "currency": "MOVE"
  },
  "user_context": {
    "ip": "192.168.1.1",
    "path": "/test"
  },
  "instructions": {
    "step_1": "Transfer 0.01 MOVE to 0xea859ca...",
    "step_2": "POST tx_hash to https://access-server.com/buy-access",
    "step_3": "Retry your request"
  },
  "timestamp": "2026-01-07T12:00:00.000Z"
}
```

### Test with Python SDK

```bash
cd ../botpaywall-sdk/examples/scraper-with-sdk
python3 main.py https://yourdomain.com/test --secret-key YOUR_SECRET_KEY
```

## 📊 How Bot Detection Works

The worker uses a multi-layered approach:

1. **Header Credentials** - Checks for `x-zone-id` and `x-secret-key` headers (from scrapers)
2. **API Configuration** - Falls back to database config for standard users
3. **IP Whitelist Check** - Queries Cloudflare Firewall API for whitelist rules
4. **User-Agent Analysis** - Detects bot patterns:
   - Keywords: bot, crawler, spider, scraper, python, curl, wget
   - Missing browser tokens: mozilla, chrome, safari
   - Headless browser indicators

## 🔐 Security Features

- **API Key Authentication** - Secure worker-to-dashboard communication
- **Token Validation** - Verifies Cloudflare API tokens
- **IP-based Whitelisting** - Uses Cloudflare's native firewall rules
- **Payment Verification** - Validates on-chain transactions
- **Request Logging** - Comprehensive logging for debugging

## 🎨 Integration with Gatekeeper Dashboard

The worker seamlessly integrates with your Gatekeeper dashboard:

1. **Automatic Configuration** - Fetches zone settings from dashboard API
2. **Real-time Updates** - Configuration cache refreshes every 5 minutes
3. **Visual Management** - Manage domains through the beautiful yellow-themed UI
4. **Status Monitoring** - View protection status and stats in dashboard

## 🐛 Debugging

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter by specific IP
wrangler tail --ip 192.168.1.1
```

### Common Issues

**Issue**: Worker returns 502 Bad Gateway
- **Solution**: Check `API_BASE_URL` is correct and dashboard is accessible

**Issue**: Whitelist check always fails
- **Solution**: Verify Cloudflare API token has Firewall Services permissions

**Issue**: Configuration not updating
- **Solution**: Wait 5 minutes for cache to expire or restart worker

## 🚀 Advanced Usage

### Custom Bot Detection Logic

Modify the `isBotUserAgent()` function in `paywall-worker.js`:

```javascript
function isBotUserAgent(ua) {
  if (!ua) return true;
  const lowerUA = ua.toLowerCase();
  
  // Add your custom patterns
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'python', 'curl', 'wget', 'headless',
    'puppeteer', 'selenium', 'playwright'
  ];
  
  // Check for custom exclusions
  const allowedBots = ['googlebot', 'bingbot'];
  if (allowedBots.some(b => lowerUA.includes(b))) {
    return false;
  }
  
  return botPatterns.some(p => lowerUA.includes(p));
}
```

### Origin Forwarding

The worker automatically forwards allowed traffic to your origin server:

```javascript
function forwardToOrigin(request, originBaseUrl) {
  const url = new URL(request.url);
  const originUrl = originBaseUrl + url.pathname + url.search;

  return fetch(new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  }));
}
```

### Adding Rate Limiting

Protect against abuse by adding rate limits:

```javascript
// Use Cloudflare's Rate Limiting API
const rateLimitKey = `rate:${clientIP}`;
const count = await env.RATE_LIMIT_KV.get(rateLimitKey);

if (count && parseInt(count) > 100) {
  return new Response("Rate limit exceeded", { status: 429 });
}

await env.RATE_LIMIT_KV.put(rateLimitKey, 
  String((parseInt(count) || 0) + 1),
  { expirationTtl: 3600 }
);
```

## 🛠 Troubleshooting

### Worker Not Triggering

- ✅ Verify route is configured correctly in Cloudflare Dashboard
- ✅ Check worker is deployed (not just saved as draft)  
- ✅ Ensure domain DNS is proxied through Cloudflare (orange cloud)
- ✅ Review worker logs for errors: `wrangler tail`

### Whitelist Check Failing

- ✅ Confirm Cloudflare API token has correct permissions
- ✅ Check zone ID matches your domain
- ✅ Verify firewall rule exists for the IP address
- ✅ Wait up to 60 seconds for rule propagation

### Configuration Not Loading

- ✅ Verify `API_BASE_URL` points to your Gatekeeper dashboard
- ✅ Check `WORKER_API_KEY` is set correctly
- ✅ Ensure dashboard API endpoint is accessible
- ✅ Review cache timeout (5 minutes default)

### 402 Responses for Regular Users

- ✅ Check bot detection logic isn't too aggressive
- ✅ Verify User-Agent contains browser tokens
- ✅ Test with different browsers
- ✅ Review worker logs to see detection reasoning

## 📚 API Reference

### Worker Environment Variables

```typescript
interface Env {
  API_BASE_URL: string;        // Dashboard API URL
  WORKER_API_KEY: string;      // Auth key for dashboard
  PAYMENT_ADDRESS: string;     // Movement wallet address
  PRICE_AMOUNT: string;        // Payment amount
  PRICE_CURRENCY: string;      // Currency type
  ACCESS_SERVER_URL: string;   // Payment verification endpoint
}
```

### Request Headers (From Scrapers)

```
x-zone-id: <cloudflare-zone-id>
x-secret-key: <project-secret-key>
```

### Response Format (402 Payment Required)

```json
{
  "error": "Payment Required",
  "message": "Bot access requires payment",
  "payment_context": {
    "address": "0x...",
    "amount": "0.01",
    "currency": "MOVE"
  },
  "user_context": {
    "ip": "192.168.1.1",
    "path": "/protected"
  },
  "instructions": {
    "step_1": "Transfer 0.01 MOVE to 0x...",
    "step_2": "POST tx_hash to https://access-server.com/buy-access",
    "step_3": "Retry your request"
  },
  "access_server": "https://access-server.com/buy-access",
  "timestamp": "2026-01-07T12:00:00.000Z"
}
```

## 🔒 Security Best Practices

1. **Environment Variables** - Never hardcode secrets in worker code
2. **API Authentication** - Always use `WORKER_API_KEY` for dashboard communication
3. **HTTPS Only** - Ensure all external requests use HTTPS
4. **Input Validation** - Validate zone IDs, tokens, and IP addresses
5. **Rate Limiting** - Implement request throttling for production
6. **Logging** - Use structured logging for security auditing
7. **Token Rotation** - Regularly rotate API keys and tokens

## 🌟 Performance Tips

- **Edge Caching** - Configuration cached for 5 minutes reduces API calls
- **Minimal Overhead** - Bot detection runs in < 5ms
- **Global Distribution** - Runs on Cloudflare's edge network worldwide
- **Zero Cold Starts** - V8 isolates provide instant execution
- **Concurrent Requests** - Handles thousands of requests per second

## 📊 Monitoring

View worker metrics in Cloudflare Dashboard:

1. Go to **Workers & Pages** → Your Worker
2. Click **Metrics** tab
3. Monitor:
   - Requests per second
   - CPU time usage
   - Error rates
   - Status code distribution

## 🤝 Contributing

This worker is part of the Gatekeeper Bot Firewall project. To contribute:

1. Fork the repository
2. Make your changes
3. Test thoroughly with `wrangler dev`
4. Submit a pull request

## 📄 License

Part of the Gatekeeper Bot Firewall ecosystem.

---

**Built with ❤️ for the decentralized web**

For more information, visit your Gatekeeper Dashboard or check the main project documentation.
