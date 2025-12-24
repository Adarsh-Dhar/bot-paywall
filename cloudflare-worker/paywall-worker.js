/**
 * SIMPLE CLOUDFLARE WORKER - Works on Free Plan
 * No KV, No Bot Management required
 * Uses basic bot detection
 */

const CONFIG = {
  PAYMENT_ADDRESS: "0xdb466d22253732426f60d1a9ce33b080cf44160ed383277e399160ffdcc70b05",
  PRICE_AMOUNT: "0.01",
  PRICE_CURRENCY: "MOVE",
  ORIGIN_URL: "https://test-cloudflare-website.adarsh.software",
  ACCESS_SERVER_URL: "http://localhost:5000",
  CLOUDFLARE_ZONE_ID: "11685346bf13dc3ffebc9cc2866a8105",
  CLOUDFLARE_API_TOKEN: "oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
};

export default {
  async fetch(request, env, ctx) {
    try {
      const clientIP = request.headers.get("CF-Connecting-IP");
      const url = new URL(request.url);

      console.log("Request received", { ip: clientIP, path: url.pathname });

      // Check if IP is whitelisted (using Cloudflare API)
      const isWhitelisted = await checkWhitelist(clientIP);
      
      if (isWhitelisted) {
        console.log("IP whitelisted, allowing access", { ip: clientIP });
        return forwardToOrigin(request);
      }

      // Check if it's a bot
      const isBot = detectBot(request);
      
      console.log("Bot detection", { ip: clientIP, isBot });

      if (isBot) {
        console.log("Bot detected, requiring payment", { ip: clientIP });
        return generate402Response(clientIP, url.pathname);
      }

      // Allow humans
      console.log("Human traffic allowed", { ip: clientIP });
      return forwardToOrigin(request);
      
    } catch (error) {
      // Don't crash - return error response
      console.error("Worker error:", error.message, error.stack);
      return new Response("Internal Server Error: " + error.message, { status: 500 });
    }
  }
};

// Check if IP is whitelisted using Cloudflare API
async function checkWhitelist(clientIP) {
  if (!clientIP) return false;
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CONFIG.CLOUDFLARE_ZONE_ID}/firewall/access_rules/rules?configuration.value=${clientIP}`,
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`,
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
function forwardToOrigin(request) {
  const url = new URL(request.url);
  const originUrl = CONFIG.ORIGIN_URL + url.pathname + url.search;
  
  const newRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return fetch(newRequest);
}

// Generate 402 response
function generate402Response(clientIP, path) {
  const response = {
    error: "Payment Required",
    message: "Bot access requires payment",
    payment_context: {
      address: CONFIG.PAYMENT_ADDRESS,
      amount: CONFIG.PRICE_AMOUNT,
      currency: CONFIG.PRICE_CURRENCY
    },
    user_context: {
      ip: clientIP,
      path: path
    },
    instructions: {
      step_1: `Transfer ${CONFIG.PRICE_AMOUNT} ${CONFIG.PRICE_CURRENCY} to ${CONFIG.PAYMENT_ADDRESS}`,
      step_2: `POST tx_hash to ${CONFIG.ACCESS_SERVER_URL}/buy-access`,
      step_3: "Retry your request"
    },
    access_server: `${CONFIG.ACCESS_SERVER_URL}/buy-access`,
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `X402-Payment address="${CONFIG.PAYMENT_ADDRESS}"`,
      "Access-Control-Allow-Origin": "*"
    }
  });
}