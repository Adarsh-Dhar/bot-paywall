/**
 * SIMPLE CLOUDFLARE WORKER - Bot Paywall
 * Works on Free Plan | No KV required
 * Checks Headers first (for Scraper), then API (for dynamic config)
 */

// Configuration cache (in-memory, cleared on worker restart)
let configCache = {
  data: null,
  expiresAt: 0,
};

// Default configuration (fallback)
const DEFAULT_CONFIG = {
  PAYMENT_ADDRESS: "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b",
  PRICE_AMOUNT: "0.01",
  PRICE_CURRENCY: "MOVE",
  ACCESS_SERVER_URL: "https://77f02bdf5f8f.ngrok-free.app",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP');
    const hostname = url.hostname;

    console.log("Request received", { ip: clientIP, path: url.pathname, hostname });

    // 1. Get configuration (Best effort)
    const config = await getConfig(hostname, env);

    // 2. Extract credentials from Headers (Sent by Scraper)
    const headerZoneId = request.headers.get('x-zone-id');
    const headerSecret = request.headers.get('x-secret-key');

    // 3. Determine which credentials to use
    // Use header values if present (Scraper), otherwise use API config (User)
    const activeZoneId = headerZoneId || config?.zoneId;
    const activeToken = headerSecret || config?.cloudflareToken;

    console.log("Credentials check:", {
      source: headerZoneId ? "Headers (Scraper)" : "API (Database)",
      hasCredentials: !!(activeZoneId && activeToken)
    });

    // 4. Check Whitelist (Only if we have valid credentials)
    let isWhitelisted = false;
    if (activeZoneId && activeToken) {
      isWhitelisted = await checkWhitelist(clientIP, activeZoneId, activeToken);
    } else {
      console.log("⚠️ No valid credentials found. Skipping whitelist check.");
    }

    // 5. Allow access if whitelisted
    if (isWhitelisted) {
      console.log(`✅ IP ${clientIP} is whitelisted. Access granted.`);
      return forwardToOrigin(request, config?.originUrl || url.origin);
    }

    // 6. Bot Detection (If not whitelisted)
    const isBot = isBotUserAgent(request.headers.get('User-Agent'));
    console.log("Bot detection", { ip: clientIP, isBot });

    if (isBot) {
      console.log("🤖 Bot detected, requiring payment", { ip: clientIP });
      // Return 402 to trigger the scraper's payment flow
      return injectPaywall(request, config || DEFAULT_CONFIG);
    }

    // 7. Regular User (Not a bot, not whitelisted)
    // We forward them to the content
    return forwardToOrigin(request, config?.originUrl || url.origin);
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get configuration from database API
 */
async function getConfig(hostname, env) {
  const now = Date.now();
  if (configCache.data && configCache.expiresAt > now) {
    return configCache.data;
  }

  // Use the API_BASE_URL defined in wrangler.toml
  const apiBaseUrl = env.API_BASE_URL;
  const workerApiKey = env.WORKER_API_KEY;

  try {
    const response = await fetch(
        `${apiBaseUrl}/api/worker/config?hostname=${encodeURIComponent(hostname)}`,
        {
          headers: {
            ...(workerApiKey ? { 'X-Worker-API-Key': workerApiKey } : {}),
            'Content-Type': 'application/json'
          }
        }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    // Cache for 5 minutes
    configCache = {
      data: {
        zoneId: data.zoneId,
        cloudflareToken: data.cloudflareToken,
        originUrl: data.originUrl,
        paymentAddress: env.PAYMENT_ADDRESS || DEFAULT_CONFIG.PAYMENT_ADDRESS,
        priceAmount: env.PRICE_AMOUNT || DEFAULT_CONFIG.PRICE_AMOUNT,
        priceCurrency: env.PRICE_CURRENCY || DEFAULT_CONFIG.PRICE_CURRENCY,
        accessServerUrl: env.ACCESS_SERVER_URL || DEFAULT_CONFIG.ACCESS_SERVER_URL,
      },
      expiresAt: now + (5 * 60 * 1000),
    };

    return configCache.data;
  } catch (error) {
    console.error('Error fetching config:', error.message);
    return null;
  }
}

/**
 * Check if IP is whitelisted using Cloudflare API (Debug Version)
 */
async function checkWhitelist(clientIP, zoneId, cloudflareToken) {
  if (!clientIP || !zoneId || !cloudflareToken) {
    console.error('❌ Missing params for whitelist check');
    return false;
  }

  try {
    // Clean the token to ensure no whitespace issues
    const cleanToken = cloudflareToken.trim();

    // Query Cloudflare for ANY rule matching this IP
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/access_rules/rules?configuration.value=${clientIP}`;

    console.log(`📡 Checking Cloudflare Whitelist for ${clientIP}...`);

    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await resp.json();

    // Log the RAW response to see exactly what Cloudflare says
    console.log("☁️ Cloudflare API Response:", JSON.stringify(data));

    if (data.success && data.result && data.result.length > 0) {
      // Found a rule! Now verify it's a whitelist/allow rule
      const rule = data.result[0];
      console.log(`✅ Found rule: ${rule.mode} for ${rule.configuration.value}`);

      // Accept 'whitelist' (legacy) or 'allow' (new)
      if (rule.mode === 'whitelist' || rule.mode === 'allow') {
        return true;
      }
    }

    console.log("❌ No whitelist rule found in response.");
    return false;
  } catch (e) {
    console.error("🔥 Whitelist check EXCEPTION:", e.message);
    return false;
  }
}

/**
 * Detect if User-Agent belongs to a bot
 */
function isBotUserAgent(ua) {
  if (!ua) return true; // No User-Agent is suspicious
  const lowerUA = ua.toLowerCase();

  // 1. Check for known bot keywords
  const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'python', 'curl', 'wget', 'headless', 'puppeteer'];
  if (botPatterns.some(p => lowerUA.includes(p))) {
    return true;
  }

  // 2. Check for missing standard browser tokens (Basic check)
  if (!lowerUA.includes('mozilla') && !lowerUA.includes('chrome') && !lowerUA.includes('safari')) {
    return true;
  }

  return false;
}

/**
 * Generate the 402 Payment Required Response
 */
function injectPaywall(request, config) {
  const clientIP = request.headers.get("CF-Connecting-IP");
  const url = new URL(request.url);

  const paywallConfig = {
    paymentAddress: config?.paymentAddress || DEFAULT_CONFIG.PAYMENT_ADDRESS,
    priceAmount: config?.priceAmount || DEFAULT_CONFIG.PRICE_AMOUNT,
    priceCurrency: config?.priceCurrency || DEFAULT_CONFIG.PRICE_CURRENCY,
    accessServerUrl: config?.accessServerUrl || DEFAULT_CONFIG.ACCESS_SERVER_URL
  };

  return generate402Response(clientIP, url.pathname, paywallConfig);
}

function generate402Response(clientIP, path, config) {
  const response = {
    error: "Payment Required",
    message: "Bot access requires payment",
    payment_context: {
      address: config.paymentAddress,
      amount: config.priceAmount,
      currency: config.priceCurrency
    },
    user_context: {
      ip: clientIP,
      path: path
    },
    instructions: {
      step_1: `Transfer ${config.priceAmount} ${config.priceCurrency} to ${config.paymentAddress}`,
      step_2: `POST tx_hash to ${config.accessServerUrl}/buy-access`,
      step_3: "Retry your request"
    },
    access_server: `${config.accessServerUrl}/buy-access`,
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `X402-Payment address="${config.paymentAddress}"`,
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * Forward request to the original server
 */
function forwardToOrigin(request, originBaseUrl) {
  const url = new URL(request.url);
  // Construct destination URL
  const originUrl = originBaseUrl + url.pathname + url.search;

  const newRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return fetch(newRequest);
}