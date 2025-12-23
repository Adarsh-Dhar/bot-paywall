// CLOUDFLARE WORKER CODE (The Gatekeeper) - X402 PAYMENT MODE
// This worker implements X402 payment flow for bot access

// Configuration from environment variables
function getConfig(env) {
  return {
    logging: env?.LOGGING === "true",
    originUrl: env?.ORIGIN_URL || "https://test-paywall-website.adarsh.software",
    zoneId: env?.ZONE_ID || "11685346bf13dc3ffebc9cc2866a8105",
    apiToken: env?.API_TOKEN || "",
    paymentAddress: env?.PAYMENT_ADDRESS || "0x1234567890abcdef1234567890abcdef12345678",
    botPaymentSystemUrl: env?.BOT_PAYMENT_SYSTEM_URL || "https://your-domain.com/api/x402-payment"
  };
}

// Generate X402 Payment Required response
function generateX402Response(clientIP, config) {
  const paymentDetails = {
    error: "Payment Required",
    message: "Bot access requires X402 payment. Please transfer 0.01 MOVE tokens to the specified address.",
    payment_required: true,
    payment_address: config.paymentAddress,
    payment_amount: "0.01",
    payment_currency: "MOVE",
    client_ip: clientIP,
    timestamp: new Date().toISOString(),
    instructions: "Transfer exactly 0.01 MOVE tokens to the payment address. Access will be granted automatically upon payment confirmation."
  };

  return new Response(
    JSON.stringify(paymentDetails),
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

// Verify X402 payment with bot payment system
async function verifyX402Payment(transactionId, clientIP, config) {
  if (!config.botPaymentSystemUrl || !transactionId) {
    if (config.logging) {
      console.log("❌ X402 payment verification failed - missing configuration", { 
        hasUrl: !!config.botPaymentSystemUrl, 
        hasTransactionId: !!transactionId,
        clientIP 
      });
    }
    return { verified: false, error: "Missing payment system configuration or transaction ID" };
  }

  try {
    const response = await fetch(`${config.botPaymentSystemUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify({
        transactionId,
        clientIP,
        expectedAmount: 0.01,
        expectedCurrency: 'MOVE'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (config.logging) {
        console.log("❌ X402 payment verification HTTP error", { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          transactionId, 
          clientIP 
        });
      }
      return { 
        verified: false, 
        error: `Payment verification failed: ${response.status} ${response.statusText}`,
        details: errorText
      };
    }

    const result = await response.json();
    
    if (config.logging) {
      console.log("✅ X402 payment verification response", { 
        verified: result.verified,
        transactionId, 
        clientIP,
        result 
      });
    }
    
    return {
      verified: result.verified === true,
      error: result.verified ? null : (result.error || "Payment verification failed"),
      details: result
    };
  } catch (error) {
    if (config.logging) {
      console.log("❌ X402 payment verification network error", { 
        error: error.message, 
        stack: error.stack,
        transactionId, 
        clientIP 
      });
    }
    return { 
      verified: false, 
      error: `Network error during payment verification: ${error.message}`,
      details: error.stack
    };
  }
}

// Trigger IP whitelisting through bot payment system
async function triggerIPWhitelisting(transactionId, clientIP, config) {
  if (!config.botPaymentSystemUrl) {
    if (config.logging) {
      console.log("❌ IP whitelisting failed - missing bot payment system URL", { transactionId, clientIP });
    }
    return { success: false, error: "Missing bot payment system configuration" };
  }

  try {
    const response = await fetch(`${config.botPaymentSystemUrl}/whitelist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify({
        transactionId,
        clientIP,
        duration: 60 // 60 seconds
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (config.logging) {
        console.log("❌ IP whitelisting HTTP error", { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          transactionId, 
          clientIP 
        });
      }
      return { 
        success: false, 
        error: `Whitelisting failed: ${response.status} ${response.statusText}`,
        details: errorText
      };
    }

    const result = await response.json();
    
    if (config.logging) {
      console.log("✅ IP whitelisting response", { 
        success: result.success,
        transactionId, 
        clientIP,
        result 
      });
    }
    
    return {
      success: result.success === true,
      error: result.success ? null : (result.error || "IP whitelisting failed"),
      details: result
    };
  } catch (error) {
    if (config.logging) {
      console.log("❌ IP whitelisting network error", { 
        error: error.message, 
        stack: error.stack,
        transactionId, 
        clientIP 
      });
    }
    return { 
      success: false, 
      error: `Network error during IP whitelisting: ${error.message}`,
      details: error.stack
    };
  }
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
      console.log("X402 Payment Gateway processing request", {
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
        console.log("✅ IP whitelisted in Cloudflare firewall rules, allowing access", { clientIP });
      }
      // Allow access for whitelisted IPs - forward to origin
      const originRequest = new Request(config.originUrl + new URL(request.url).pathname + new URL(request.url).search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      return fetch(originRequest);
    } else {
      // Detect if this is a bot request
      const isBot = detectBot(request);
      if (isBot) {
        if (config.logging) {
          console.log("🤖 Bot detected - requiring X402 payment", { clientIP });
        }
        
        // Check if this is a payment verification request
        const transactionId = request.headers.get("X402-Transaction-ID");
        if (transactionId) {
          if (config.logging) {
            console.log("💰 X402 payment verification request", { transactionId, clientIP });
          }
          
          // Verify the X402 payment
          const paymentResult = await verifyX402Payment(transactionId, clientIP, config);
          
          if (paymentResult.verified) {
            if (config.logging) {
              console.log("✅ X402 payment verified, triggering IP whitelisting", { transactionId, clientIP });
            }
            
            // Trigger IP whitelisting
            const whitelistResult = await triggerIPWhitelisting(transactionId, clientIP, config);
            
            if (whitelistResult.success) {
              // Return success response
              return new Response(
                JSON.stringify({
                  success: true,
                  message: "Payment verified and IP whitelisted. You may now access the content.",
                  transaction_id: transactionId,
                  client_ip: clientIP,
                  whitelist_duration: 60,
                  timestamp: new Date().toISOString()
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    "X-Payment-Status": "verified",
                    "X-Whitelist-Status": "active"
                  }
                }
              );
            } else {
              // Whitelisting failed - return detailed error
              if (config.logging) {
                console.log("❌ IP whitelisting failed after successful payment verification", { 
                  transactionId, 
                  clientIP, 
                  error: whitelistResult.error,
                  details: whitelistResult.details
                });
              }
              
              return new Response(
                JSON.stringify({
                  error: "Whitelisting Failed",
                  message: "Payment verified but IP whitelisting failed. Please try again in a few moments.",
                  transaction_id: transactionId,
                  client_ip: clientIP,
                  error_details: whitelistResult.error,
                  timestamp: new Date().toISOString(),
                  retry_after: 30 // Suggest retry after 30 seconds
                }),
                {
                  status: 500,
                  headers: {
                    "Content-Type": "application/json",
                    "X-Payment-Status": "verified",
                    "X-Whitelist-Status": "failed",
                    "Retry-After": "30"
                  }
                }
              );
            }
          } else {
            // Payment verification failed - return detailed error
            if (config.logging) {
              console.log("❌ X402 payment verification failed", { 
                transactionId, 
                clientIP, 
                error: paymentResult.error,
                details: paymentResult.details
              });
            }
            
            return new Response(
              JSON.stringify({
                error: "Payment Verification Failed",
                message: "The provided transaction could not be verified. Please ensure you transferred exactly 0.01 MOVE tokens to the correct address.",
                transaction_id: transactionId,
                client_ip: clientIP,
                error_details: paymentResult.error,
                payment_requirements: {
                  amount: "0.01",
                  currency: "MOVE",
                  address: config.paymentAddress
                },
                timestamp: new Date().toISOString()
              }),
              {
                status: 403,
                headers: {
                  "Content-Type": "application/json",
                  "X-Payment-Status": "failed",
                  "X-Bot-Protection": "payment-verification-failed"
                }
              }
            );
          }
        } else {
          // No payment provided, return X402 Payment Required
          return generateX402Response(clientIP, config);
        }
      }
    }
    
    // For regular browser requests or whitelisted bots, forward to origin
    if (config.logging) {
      console.log("✅ Allowing access, forwarding to origin", { clientIP });
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