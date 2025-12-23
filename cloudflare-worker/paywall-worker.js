// CLOUDFLARE WORKER CODE - FIXED VERSION
// This worker implements X402 payment flow for bot access

// Configuration from environment variables
function getConfig(env) {
  return {
    logging: env?.LOGGING === "true",
    originUrl: env?.ORIGIN_URL || "https://test-paywall-website.adarsh.software",
    zoneId: env?.ZONE_ID || "11685346bf13dc3ffebc9cc2866a8105",
    apiToken: env?.API_TOKEN || "",
    paymentAddress: env?.PAYMENT_ADDRESS || "0x1234567890abcdef1234567890abcdef12345678",
    botPaymentSystemUrl: env?.BOT_PAYMENT_SYSTEM_URL || "http://localhost:5000"
  };
}

// Generate X402 Payment Required response
function generateX402Response(clientIP, config) {
  const paymentDetails = {
    error: "Payment Required",
    message: "Bot access requires payment. Please transfer 0.01 MOVE tokens to the specified address.",
    payment_required: true,
    payment_address: config.paymentAddress,
    payment_amount: "0.01",
    payment_currency: "MOVE",
    client_ip: clientIP,
    timestamp: new Date().toISOString(),
    instructions: "1. Transfer 0.01 MOVE to payment address. 2. POST tx_hash to access server. 3. Retry request.",
    access_server_url: `${config.botPaymentSystemUrl}/buy-access`
  };

  return new Response(
    JSON.stringify(paymentDetails, null, 2),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "X402-Payment",
        "X402-Payment-Address": config.paymentAddress,
        "X402-Payment-Amount": "0.01",
        "X402-Payment-Currency": "MOVE",
        "X-Bot-Protection": "x402-payment-required"
      }
    }
  );
}

// Check if IP is whitelisted in Cloudflare firewall rules
async function isIPWhitelisted(clientIP, config) {
  if (!config.apiToken || !clientIP) {
    return false;
  }
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/firewall/access_rules/rules?configuration.value=${clientIP}`,
      {
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
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
      
      if (whitelistRule) {
        if (config.logging) {
          console.log("✅ IP found in whitelist", { clientIP, ruleId: whitelistRule.id });
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    if (config.logging) {
      console.log("❌ Error checking whitelist", { error: error.message });
    }
    return false;
  }
}

// Bot detection function
function detectBot(request) {
  const userAgent = request.headers.get("User-Agent") || "";
  const acceptHeader = request.headers.get("Accept") || "";
  const acceptLanguage = request.headers.get("Accept-Language") || "";
  const acceptEncoding = request.headers.get("Accept-Encoding") || "";
  
  // If no User-Agent at all, it's a bot
  if (!userAgent || userAgent.trim() === "") {
    return true;
  }
  
  // Check for obvious bot patterns
  const obviousBotPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /python-requests/i,
    /python\/\d/i,
    /^curl/i,
    /^wget/i,
    /beautifulsoup/i,
    /scrapy/i,
    /selenium/i,
    /phantomjs/i,
    /headless/i,
    /automation/i,
    /^python/i,
    /httpx/i,
    /aiohttp/i
  ];
  
  // If matches bot patterns, it's definitely a bot
  if (obviousBotPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }
  
  // Check for real browser patterns
  const browserPatterns = [
    /Mozilla.*Chrome/i,
    /Mozilla.*Safari/i,
    /Mozilla.*Firefox/i,
    /Mozilla.*Edge/i,
    /Opera/i
  ];
  
  // If it looks like a real browser with proper headers
  if (browserPatterns.some(pattern => pattern.test(userAgent))) {
    if (acceptHeader && acceptHeader.includes("text/html")) {
      return false; // Definitely a real browser
    }
  }
  
  // Score-based detection for edge cases
  let botScore = 0;
  
  if (!acceptHeader || acceptHeader === "*/*") botScore += 1;
  if (!acceptLanguage) botScore += 1;
  if (!acceptEncoding) botScore += 1;
  if (userAgent.length < 20) botScore += 1;
  if (!userAgent.includes("Mozilla")) botScore += 1;
  
  return botScore >= 3;
}

// MAIN WORKER EXPORT
export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.logging) {
      console.log("🔍 Request received", {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get("User-Agent")
      });
    }
    
    // Get client IP
    const clientIP = request.headers.get("CF-Connecting-IP") || 
                     request.headers.get("X-Forwarded-For")?.split(',')[0]?.trim() || 
                     request.headers.get("X-Real-IP") || "";
    
    // STEP 1: Check if IP is whitelisted (has paid)
    const isWhitelisted = await isIPWhitelisted(clientIP, config);
    
    if (isWhitelisted) {
      if (config.logging) {
        console.log("✅ IP whitelisted, allowing access", { clientIP });
      }
      
      // Forward to origin
      const originRequest = new Request(
        config.originUrl + new URL(request.url).pathname + new URL(request.url).search,
        {
          method: request.method,
          headers: request.headers,
          body: request.body,
        }
      );
      
      return fetch(originRequest);
    }
    
    // STEP 2: Not whitelisted - check if it's a bot
    const isBot = detectBot(request);
    
    if (config.logging) {
      console.log("🤖 Bot detection", { 
        clientIP, 
        isBot,
        userAgent: request.headers.get("User-Agent")
      });
    }
    
    // STEP 3: If it's a bot, require payment
    if (isBot) {
      if (config.logging) {
        console.log("🚫 Bot detected, requiring payment", { clientIP });
      }
      
      // Return 402 Payment Required
      return generateX402Response(clientIP, config);
    }
    
    // STEP 4: Not a bot (regular browser) - allow access
    if (config.logging) {
      console.log("✅ Browser request, allowing access", { clientIP });
    }
    
    const originRequest = new Request(
      config.originUrl + new URL(request.url).pathname + new URL(request.url).search,
      {
        method: request.method,
        headers: request.headers,
        body: request.body,
      }
    );
    
    return fetch(originRequest);
  }
};