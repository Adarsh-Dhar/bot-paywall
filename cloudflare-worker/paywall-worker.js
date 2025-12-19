// CLOUDFLARE WORKER CODE (The Gatekeeper) - FULL BOT BLOCKING MODE
// This worker blocks all bots completely - no payments, no bypass

// Configuration from environment variables
function getConfig(env) {
  return {
    logging: env?.LOGGING === "true",
    originUrl: env?.ORIGIN_URL || "https://test-paywall-website.adarsh.software",
    zoneId: env?.ZONE_ID || "11685346bf13dc3ffebc9cc2866a8105",
    apiToken: env?.API_TOKEN || ""
  };
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
      // Check if any rule is a whitelist rule for this IP
      const whitelistRule = data.result.find(rule => 
        rule.mode === "whitelist" && 
        rule.configuration.value === clientIP
      );
      
      if (whitelistRule) {
        if (config.logging) {
          console.log("✅ IP found in Cloudflare whitelist rules", { clientIP, ruleId: whitelistRule.id });
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    if (config.logging) {
      console.log("❌ Error checking Cloudflare firewall rules", { error: error.message });
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
  
  // Check for obvious bot patterns in User-Agent
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /python/i,
    /requests/i,
    /curl/i,
    /wget/i,
    /beautifulsoup/i,
    /scrapy/i,
    /selenium/i,
    /phantomjs/i,
    /headless/i,
    /automation/i
  ];
  
  // Check if User-Agent matches bot patterns
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }
  
  // Check for incomplete browser User-Agent (missing Chrome/Safari/Firefox)
  if (userAgent.includes("Mozilla") && userAgent.includes("AppleWebKit")) {
    // Real browsers have Chrome, Safari, Firefox, or Edge in their UA
    if (!userAgent.includes("Chrome") && 
        !userAgent.includes("Safari") && 
        !userAgent.includes("Firefox") && 
        !userAgent.includes("Edge")) {
      return true;
    }
  }
  
  // Check for missing critical browser headers
  if (!acceptLanguage || acceptLanguage.length < 2) {
    return true; // Real browsers always send Accept-Language
  }
  
  if (!acceptEncoding || !acceptEncoding.includes("gzip")) {
    return true; // Real browsers always support gzip
  }
  
  // Check for suspicious Accept header (real browsers send text/html first)
  if (acceptHeader === "*/*" && !acceptHeader.includes("text/html")) {
    return true;
  }
  
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.logging) {
      console.log("Bot Blocker processing request", {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get("User-Agent"),
        origin: config.originUrl
      });
    }
    
    // Get client IP address
    const clientIP = request.headers.get("CF-Connecting-IP") || 
                     request.headers.get("X-Forwarded-For")?.split(',')[0]?.trim() || 
                     request.headers.get("X-Real-IP") || "";
    
    // Check if this IP is whitelisted in Cloudflare firewall rules
    const isWhitelisted = await isIPWhitelisted(clientIP, config);
    
    if (isWhitelisted) {
      if (config.logging) {
        console.log("✅ IP whitelisted in Cloudflare firewall rules, bypassing bot detection", { clientIP });
      }
      // Skip bot detection for whitelisted IPs
    } else {
      // Detect if this is a bot request
      const isBot = detectBot(request);
      if (isBot) {
        if (config.logging) {
          console.log("🚫 Bot detected - BLOCKING ACCESS", { clientIP });
        }
        
        // Block all bots with 403 Forbidden
        return new Response(
          JSON.stringify({
            error: "Access Denied",
            message: "Bot access is not allowed. This site is protected against automated scraping.",
            blocked_user_agent: request.headers.get("User-Agent"),
            client_ip: clientIP,
            timestamp: new Date().toISOString()
          }),
          {
            status: 403,
            headers: { 
              "Content-Type": "application/json",
              "X-Bot-Protection": "active"
            },
          }
        );
      }
    }
    
    // For regular browser requests, forward to origin
    if (config.logging) {
      console.log("✅ Human browser detected, forwarding to origin");
    }
    
    // Create a new request to the origin server
    const originRequest = new Request(config.originUrl + new URL(request.url).pathname + new URL(request.url).search, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return fetch(originRequest);
  },
};



