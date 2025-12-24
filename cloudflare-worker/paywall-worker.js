/**
 * CLOUDFLARE WORKER - X402 BOT PAYWALL (PRODUCTION)
 * 
 * Uses Cloudflare's NATIVE Bot Management for accurate bot detection.
 * Stores whitelist in KV for fast access (no API calls).
 * 
 * Prerequisites:
 * 1. Bot Management (requires Pro/Business/Enterprise plan)
 * 2. KV Namespace created: npx wrangler kv:namespace create "PAYMENT_WHITELIST"
 */

// Configuration
const CONFIG = {
  PAYMENT_ADDRESS: "0xc205d2924138e17e0035ecf74c98c40f486431276e20158ef3cf3697e9e967d1",
  PRICE_AMOUNT: "0.01",
  PRICE_CURRENCY: "MOVE",
  ORIGIN_URL: "https://test-cloudflare-website.adarsh.software",
  ACCESS_SERVER_URL: "http://localhost:5000",
  
  // Bot Management Thresholds
  BOT_SCORE_THRESHOLD: 30,  // Score < 30 = likely bot (1-99 scale)
  ALLOW_VERIFIED_BOTS: false, // Set true to allow Google/Bing for SEO
  
  // Logging
  ENABLE_LOGGING: true
};

export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get("CF-Connecting-IP");
    const url = new URL(request.url);
    
    if (CONFIG.ENABLE_LOGGING) {
      console.log("🔍 Request received", {
        ip: clientIP,
        path: url.pathname,
        userAgent: request.headers.get("User-Agent")?.substring(0, 50)
      });
    }

    // ================================================================
    // STEP 1: CHECK WHITELIST (Fast KV lookup - no API calls)
    // ================================================================
    const accessStatus = await env.PAYMENT_WHITELIST.get(clientIP);
    
    if (accessStatus === "active") {
      if (CONFIG.ENABLE_LOGGING) {
        console.log("✅ IP whitelisted (KV)", { ip: clientIP });
      }
      return forwardToOrigin(request);
    }

    // ================================================================
    // STEP 2: CLOUDFLARE BOT MANAGEMENT (Native Detection)
    // ================================================================
    const botDetectionResult = detectBotNative(request);
    
    if (CONFIG.ENABLE_LOGGING) {
      console.log("🤖 Bot detection", {
        ip: clientIP,
        isBot: botDetectionResult.isBot,
        score: botDetectionResult.score,
        verifiedBot: botDetectionResult.verifiedBot,
        method: botDetectionResult.method
      });
    }

    // ================================================================
    // STEP 3: BLOCK BOTS WITH 402 PAYMENT REQUIRED
    // ================================================================
    if (botDetectionResult.isBot) {
      if (CONFIG.ENABLE_LOGGING) {
        console.log("🚫 Bot blocked, requiring payment", {
          ip: clientIP,
          reason: botDetectionResult.reason
        });
      }
      return generateX402Response(clientIP, url.pathname, botDetectionResult);
    }

    // ================================================================
    // STEP 4: ALLOW HUMANS
    // ================================================================
    if (CONFIG.ENABLE_LOGGING) {
      console.log("✅ Human traffic allowed", { ip: clientIP });
    }
    return forwardToOrigin(request);
  }
};

// ================================================================
// BOT DETECTION USING CLOUDFLARE'S NATIVE BOT MANAGEMENT
// ================================================================

/**
 * Uses Cloudflare's built-in Bot Management signals
 * This is MUCH more accurate than header parsing!
 * 
 * Requires: Pro, Business, or Enterprise plan with Bot Management
 */
function detectBotNative(request) {
  const cf = request.cf;
  const userAgent = request.headers.get("User-Agent") || "";

  // ------------------------------------------------------------
  // Method 1: Cloudflare Bot Management (Most Accurate)
  // ------------------------------------------------------------
  if (cf?.botManagement) {
    const score = cf.botManagement.score;
    const verifiedBot = cf.botManagement.verifiedBot;
    const jsDetection = cf.botManagement.jsDetection;
    
    // Handle verified bots (Google, Bing, etc.)
    if (verifiedBot) {
      if (CONFIG.ALLOW_VERIFIED_BOTS) {
        return {
          isBot: false,
          score: score,
          verifiedBot: true,
          method: "cloudflare_native",
          reason: "Verified bot (allowed for SEO)"
        };
      } else {
        return {
          isBot: true,
          score: score,
          verifiedBot: true,
          method: "cloudflare_native",
          reason: "Verified bot (not allowed)"
        };
      }
    }

    // Score-based detection
    // Score 1-29 = likely bot
    // Score 30-99 = likely human
    if (score < CONFIG.BOT_SCORE_THRESHOLD) {
      return {
        isBot: true,
        score: score,
        verifiedBot: false,
        method: "cloudflare_native",
        reason: `Bot score ${score} < threshold ${CONFIG.BOT_SCORE_THRESHOLD}`
      };
    }

    // Passed bot management checks
    return {
      isBot: false,
      score: score,
      verifiedBot: false,
      method: "cloudflare_native",
      reason: "Passed Cloudflare Bot Management"
    };
  }

  // ------------------------------------------------------------
  // Method 2: Cloudflare Threat Score (Fallback for Free Plans)
  // ------------------------------------------------------------
  if (cf?.clientThreatScore !== undefined) {
    // Threat score 0-100 (higher = more threatening)
    // > 50 = likely malicious
    // This is available on all plans!
    const threatScore = cf.clientThreatScore;
    
    if (threatScore > 50) {
      return {
        isBot: true,
        score: threatScore,
        verifiedBot: false,
        method: "cloudflare_threat_score",
        reason: `High threat score: ${threatScore}`
      };
    }
  }

  // ------------------------------------------------------------
  // Method 3: Minimal Heuristic Fallback (If no CF signals)
  // ------------------------------------------------------------
  // This is a last resort if Bot Management isn't available
  
  // Check for completely missing User-Agent (obvious bot)
  if (!userAgent || userAgent.length < 5) {
    return {
      isBot: true,
      score: 0,
      verifiedBot: false,
      method: "heuristic_fallback",
      reason: "Missing or empty User-Agent"
    };
  }

  // Check for obvious bot keywords in User-Agent
  const obviousBotKeywords = [
    "python-requests",
    "curl/",
    "wget/",
    "scrapy",
    "bot",
    "crawler",
    "spider"
  ];
  
  const userAgentLower = userAgent.toLowerCase();
  for (const keyword of obviousBotKeywords) {
    if (userAgentLower.includes(keyword)) {
      return {
        isBot: true,
        score: 0,
        verifiedBot: false,
        method: "heuristic_fallback",
        reason: `User-Agent contains "${keyword}"`
      };
    }
  }

  // Default: allow (couldn't definitively detect bot)
  return {
    isBot: false,
    score: null,
    verifiedBot: false,
    method: "heuristic_fallback",
    reason: "No bot indicators found"
  };
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Forward request to origin server
 */
function forwardToOrigin(request) {
  const url = new URL(request.url);
  const originUrl = CONFIG.ORIGIN_URL + url.pathname + url.search;
  
  const newRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow"
  });
  
  return fetch(newRequest);
}

/**
 * Generate 402 Payment Required response
 */
function generateX402Response(clientIP, path, botInfo) {
  const responseBody = {
    error: "Payment Required",
    message: "Bot or automated access detected. Please make a payment to access this resource.",
    
    // Payment details
    payment_context: {
      address: CONFIG.PAYMENT_ADDRESS,
      amount: CONFIG.PRICE_AMOUNT,
      currency: CONFIG.PRICE_CURRENCY,
      network: "movement",
      chain_id: "m1"
    },
    
    // User context
    user_context: {
      ip: clientIP,
      requested_path: path,
      detection_method: botInfo.method,
      bot_score: botInfo.score
    },
    
    // Instructions for payment
    instructions: {
      step_1: `Transfer ${CONFIG.PRICE_AMOUNT} ${CONFIG.PRICE_CURRENCY} to ${CONFIG.PAYMENT_ADDRESS}`,
      step_2: `POST your transaction hash to ${CONFIG.ACCESS_SERVER_URL}/buy-access`,
      step_3: "Retry your request after confirmation"
    },
    
    // Access server endpoint
    access_server: `${CONFIG.ACCESS_SERVER_URL}/buy-access`,
    
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(responseBody, null, 2), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `X402-Payment address="${CONFIG.PAYMENT_ADDRESS}"`,
      "X402-Payment-Address": CONFIG.PAYMENT_ADDRESS,
      "X402-Payment-Amount": CONFIG.PRICE_AMOUNT,
      "X402-Payment-Currency": CONFIG.PRICE_CURRENCY,
      "X-Bot-Detection-Method": botInfo.method,
      "X-Bot-Score": String(botInfo.score || 0),
      "Access-Control-Allow-Origin": "*"
    }
  });
}