/**
 * SIMPLE CLOUDFLARE WORKER - Works on Free Plan
 * No KV, No Bot Management required
 * Uses basic bot detection
 * Fetches configuration from database via API
 */

// Configuration cache (in-memory, cleared on worker restart)
let configCache = {
  data: null,
  expiresAt: 0,
};

// Default configuration (fallback if API is unavailable - should not be used)
const DEFAULT_CONFIG = {
  PAYMENT_ADDRESS: "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b",
  PRICE_AMOUNT: "0.01",
  PRICE_CURRENCY: "MOVE",
  ACCESS_SERVER_URL: "http://localhost:5000",
};

export default {
  async fetch(request, env, ctx) {
    try {
      const clientIP = request.headers.get("CF-Connecting-IP");
      const url = new URL(request.url);
      const hostname = url.hostname;

      console.log("Request received", { ip: clientIP, path: url.pathname, hostname });

      // 1. Get configuration from DB (might fail)
      const config = await getConfig(hostname, env);

      // 2. Extract credentials from Request Headers (Sent by Scraper)
      // This acts as a fallback or override
      const headerZoneId = request.headers.get('x-zone-id');
      const headerSecret = request.headers.get('x-secret-key');

      // 3. Determine which credentials to use
      // Use header values if present, otherwise fall back to config
      const activeZoneId = headerZoneId || config?.zoneId;
      const activeToken = headerSecret || config?.cloudflareToken;

      // Check if we have enough info to proceed
      if (!activeZoneId || !activeToken) {
        // Fallback to error if neither config nor headers provided data
        if (!config) {
          return new Response(
            JSON.stringify({
              error: "Configuration not found",
              message: `No configuration found for domain: ${hostname}. Please ensure the domain is registered in the system.`
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }

      // 4. Check Whitelist using the determined credentials
      const isWhitelisted = await checkWhitelist(clientIP, activeZoneId, activeToken);

      if (isWhitelisted) {
        console.log("IP whitelisted, allowing access", { ip: clientIP });
        return forwardToOrigin(request, config?.originUrl || url.origin);
      }

      // Check if it's a bot
      const isBot = detectBot(request);
      
      console.log("Bot detection", { ip: clientIP, isBot });

      if (isBot) {
        console.log("Bot detected, requiring payment", { ip: clientIP });
        return generate402Response(clientIP, url.pathname, config || {
          paymentAddress: env.PAYMENT_ADDRESS || DEFAULT_CONFIG.PAYMENT_ADDRESS,
          priceAmount: env.PRICE_AMOUNT || DEFAULT_CONFIG.PRICE_AMOUNT,
          priceCurrency: env.PRICE_CURRENCY || DEFAULT_CONFIG.PRICE_CURRENCY,
          accessServerUrl: env.ACCESS_SERVER_URL || DEFAULT_CONFIG.ACCESS_SERVER_URL,
        });
      }

      // Allow humans
      console.log("Human traffic allowed", { ip: clientIP });
      return forwardToOrigin(request, config?.originUrl || url.origin);

    } catch (error) {
      // Don't crash - return error response
      console.error("Worker error:", error.message, error.stack);
      return new Response("Internal Server Error: " + error.message, { status: 500 });
    }
  }
};

/**
 * Get configuration from database API
 * Caches configuration in memory for 5 minutes
 */
async function getConfig(hostname, env) {
  // Check cache first
  const now = Date.now();
  if (configCache.data && configCache.expiresAt > now) {
    return configCache.data;
  }

  const apiBaseUrl = env.API_BASE_URL || env.API_URL || 'http://localhost:3000';
  const workerApiKey = env.WORKER_API_KEY;

  // If the apiBaseUrl points to localhost or 127.0.0.1, assume the API is not reachable from Cloudflare
  // and fall back to environment configuration to avoid errors when deployed at the edge.
  const apiIsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(apiBaseUrl);

  if (!workerApiKey || apiIsLocalhost) {
    if (apiIsLocalhost && workerApiKey) {
      console.warn('API_BASE_URL appears to point to localhost which is not reachable from Cloudflare. Falling back to environment configuration (no config API).');
    } else {
      console.warn('WORKER_API_KEY missing; falling back to environment configuration (no config API).');
    }

    const fallbackConfig = {
      zoneId: env.CLOUDFLARE_ZONE_ID || env.CLOUDFLARE_ZONE || null,
      cloudflareToken: env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_TOKEN || null,
      originUrl: env.ORIGIN_URL || null,
      paymentAddress: env.PAYMENT_ADDRESS || DEFAULT_CONFIG.PAYMENT_ADDRESS,
      priceAmount: env.PRICE_AMOUNT || DEFAULT_CONFIG.PRICE_AMOUNT,
      priceCurrency: env.PRICE_CURRENCY || DEFAULT_CONFIG.PRICE_CURRENCY,
      accessServerUrl: env.ACCESS_SERVER_URL || env.BOT_PAYMENT_SYSTEM_URL || DEFAULT_CONFIG.ACCESS_SERVER_URL,
    };

    // Cache fallback for 1 minute to avoid noisy logs
    configCache = {
      data: fallbackConfig,
      expiresAt: now + (1 * 60 * 1000),
    };

    return configCache.data;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/worker/config?hostname=${encodeURIComponent(hostname)}`,
      {
        headers: {
          // Only include the API key header when present
          ...(workerApiKey ? { 'X-Worker-API-Key': workerApiKey } : {}),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      // If unauthorized, fall back to environment configuration instead of failing
      if (response.status === 401 || response.status === 403) {
        console.warn('Config API returned unauthorized (401/403). Falling back to environment configuration.');
        const fallbackConfig = {
          zoneId: env.CLOUDFLARE_ZONE_ID || env.CLOUDFLARE_ZONE || null,
          cloudflareToken: env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_TOKEN || null,
          originUrl: env.ORIGIN_URL || null,
          paymentAddress: env.PAYMENT_ADDRESS || DEFAULT_CONFIG.PAYMENT_ADDRESS,
          priceAmount: env.PRICE_AMOUNT || DEFAULT_CONFIG.PRICE_AMOUNT,
          priceCurrency: env.PRICE_CURRENCY || DEFAULT_CONFIG.PRICE_CURRENCY,
          accessServerUrl: env.ACCESS_SERVER_URL || env.BOT_PAYMENT_SYSTEM_URL || DEFAULT_CONFIG.ACCESS_SERVER_URL,
        };

        // Cache fallback for 1 minute
        configCache = {
          data: fallbackConfig,
          expiresAt: now + (1 * 60 * 1000),
        };

        return configCache.data;
      }

      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to fetch config:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    
    if (!data.success) {
      console.error('Config API returned error:', data.error);
      return null;
    }

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
      expiresAt: now + (5 * 60 * 1000), // 5 minutes
    };

    return configCache.data;
  } catch (error) {
    console.error('Error fetching config from API:', error.message);
    return null;
  }
}

// Check if IP is whitelisted using Cloudflare API
async function checkWhitelist(clientIP, zoneId, cloudflareToken) {
  if (!clientIP || !zoneId || !cloudflareToken) {
    console.error('Missing required parameters for whitelist check. Cannot verify IP against Cloudflare.', {
      hasIP: !!clientIP,
      hasZoneId: !!zoneId, 
      hasToken: !!cloudflareToken,
      hint: 'Ensure x-zone-id and x-secret-key headers are sent, or configure via environment/API.'
    });
    return false;
  }
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/access_rules/rules?configuration.value=${clientIP}`,
      {
        headers: {
          "Authorization": `Bearer ${cloudflareToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success && data.result && data.result.length > 0) {
      const whitelistRule = data.result.find(rule => 
        rule.mode === "whitelist" && 
        rule.configuration.value === clientIP
      );
      
      return !!whitelistRule;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking whitelist:", error.message);
    return false;
  }
}

// Simple bot detection
function detectBot(request) {
  const userAgent = request.headers.get("User-Agent") || "";
  
  // No User-Agent = bot
  if (!userAgent || userAgent.length < 5) {
    return true;
  }
  
  // Check for bot keywords
  const botKeywords = [
    "bot", "crawler", "spider", "scraper",
    "python-requests", "python/", "curl/", "wget/",
    "simplebot", "scrapy", "selenium"
  ];
  
  const userAgentLower = userAgent.toLowerCase();
  for (const keyword of botKeywords) {
    if (userAgentLower.includes(keyword)) {
      return true;
    }
  }
  
  // Check if it's a real browser
  if (userAgent.includes("Mozilla/") && userAgent.includes("Chrome")) {
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("text/html")) {
      return false; // Real browser
    }
  }
  
  return false;
}

// Forward to origin
function forwardToOrigin(request, originBaseUrl) {
  const url = new URL(request.url);
  const originUrl = originBaseUrl + url.pathname + url.search;
  
  const newRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return fetch(newRequest);
}

// Generate 402 response
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