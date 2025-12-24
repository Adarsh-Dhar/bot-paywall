import express from "express";
import cors from "cors";
import { x402Paywall } from "x402plus";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 5000;

// Cloudflare configuration
const CLOUDFLARE_CONFIG = {
  ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || "11685346bf13dc3ffebc9cc2866a8105",
  API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB",
  API_BASE: "https://api.cloudflare.com/client/v4"
};

// Payment configuration for x402
const PAYMENT_CONFIG = {
  PAYMENT_ADDRESS: process.env.MOVEMENT_PAY_TO || "0xdb466d22253732426f60d1a9ce33b080cf44160ed383277e399160ffdcc70b05",
  NETWORK: "movement-testnet",
  ASSET: "0x1::aptos_coin::AptosCoin",
  AMOUNT_REQUIRED: "1000000", // 0.01 MOVE in octas
  DESCRIPTION: "Bot scraper access payment",
  TIMEOUT_SECONDS: 600
};

app.use(cors());
app.use(express.json());

// =============================================================================
// CLOUDFLARE WHITELIST MANAGEMENT
// =============================================================================

/**
 * Check if an IP is already whitelisted in Cloudflare
 */
async function isIPWhitelisted(ip) {
  try {
    const response = await fetch(
      `${CLOUDFLARE_CONFIG.API_BASE}/zones/${CLOUDFLARE_CONFIG.ZONE_ID}/firewall/access_rules/rules?configuration.value=${ip}`,
      {
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_CONFIG.API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success && data.result && data.result.length > 0) {
      const whitelistRule = data.result.find(rule => 
        rule.mode === "whitelist" && 
        rule.configuration.value === ip
      );
      return !!whitelistRule;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking whitelist for ${ip}:`, error.message);
    return false;
  }
}

/**
 * Remove existing whitelist rule for an IP
 */
async function removeExistingWhitelist(ip) {
  try {
    const response = await fetch(
      `${CLOUDFLARE_CONFIG.API_BASE}/zones/${CLOUDFLARE_CONFIG.ZONE_ID}/firewall/access_rules/rules?configuration.value=${ip}`,
      {
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_CONFIG.API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success && data.result && data.result.length > 0) {
      for (const rule of data.result) {
        if (rule.mode === "whitelist" && rule.configuration.value === ip) {
          const deleteResponse = await fetch(
            `${CLOUDFLARE_CONFIG.API_BASE}/zones/${CLOUDFLARE_CONFIG.ZONE_ID}/firewall/access_rules/rules/${rule.id}`,
            {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${CLOUDFLARE_CONFIG.API_TOKEN}`,
                "Content-Type": "application/json"
              }
            }
          );
          
          const deleteData = await deleteResponse.json();
          console.log(`Removed existing whitelist rule for ${ip}:`, deleteData);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error removing existing whitelist for ${ip}:`, error.message);
    return false;
  }
}

/**
 * Add IP to Cloudflare whitelist
 */
async function whitelistIP(ip, notes = "x402 Payment - Bot Access") {
  try {
    // First, remove any existing whitelist rules for this IP
    await removeExistingWhitelist(ip);
    
    // Add new whitelist rule
    const response = await fetch(
      `${CLOUDFLARE_CONFIG.API_BASE}/zones/${CLOUDFLARE_CONFIG.ZONE_ID}/firewall/access_rules/rules`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_CONFIG.API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "whitelist",
          configuration: {
            target: "ip",
            value: ip
          },
          notes: notes
        })
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Successfully whitelisted IP: ${ip}`);
      return {
        success: true,
        rule_id: data.result.id,
        message: `IP ${ip} has been whitelisted`
      };
    } else {
      console.error(`❌ Failed to whitelist IP ${ip}:`, data.errors);
      return {
        success: false,
        message: "Failed to whitelist IP",
        errors: data.errors
      };
    }
  } catch (error) {
    console.error(`Error whitelisting IP ${ip}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// X402 PAYMENT MIDDLEWARE
// =============================================================================

/**
 * Custom x402 payment handler that integrates with Cloudflare whitelisting
 */
app.use(
  x402Paywall(
    PAYMENT_CONFIG.PAYMENT_ADDRESS,
    {
      "POST /buy-access": {
        network: PAYMENT_CONFIG.NETWORK,
        asset: PAYMENT_CONFIG.ASSET,
        maxAmountRequired: PAYMENT_CONFIG.AMOUNT_REQUIRED,
        description: PAYMENT_CONFIG.DESCRIPTION,
        mimeType: "application/json",
        maxTimeoutSeconds: PAYMENT_CONFIG.TIMEOUT_SECONDS
      }
    },
    {
      url: process.env.FACILITATOR_URL || "https://facilitator.stableyard.fi"
    }
  )
);

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * POST /buy-access
 * Main endpoint for scrapers to purchase access
 * Expects: { scraper_ip: "xxx.xxx.xxx.xxx" } in body or uses request IP
 */
app.post("/buy-access", async (req, res) => {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔵 NEW ACCESS REQUEST");
    console.log("=".repeat(80));
    
    // Get the scraper's IP address
    const scraperIP = req.body.scraper_ip || 
                      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.ip || 
                      req.connection.remoteAddress;
    
    console.log(`📍 Scraper IP: ${scraperIP}`);
    console.log(`📦 Request body:`, req.body);
    
    if (!scraperIP) {
      console.log("❌ No IP address provided");
      return res.status(400).json({
        success: false,
        error: "No IP address provided",
        message: "Please provide scraper_ip in request body or ensure IP is detectable"
      });
    }
    
    // Check if already whitelisted
    const alreadyWhitelisted = await isIPWhitelisted(scraperIP);
    if (alreadyWhitelisted) {
      console.log(`✅ IP ${scraperIP} is already whitelisted`);
      return res.json({
        success: true,
        message: "IP already whitelisted",
        ip: scraperIP,
        status: "active",
        expires_in: "24 hours"
      });
    }
    
    // At this point, x402 middleware has already verified the payment
    // If we reach here, payment was successful
    console.log("💳 Payment verified by x402 middleware");
    
    // Whitelist the IP in Cloudflare
    console.log(`🔐 Whitelisting IP in Cloudflare: ${scraperIP}`);
    const whitelistResult = await whitelistIP(scraperIP, `x402 Payment - ${new Date().toISOString()}`);
    
    if (whitelistResult.success) {
      console.log("✅ Access granted successfully!");
      console.log("=".repeat(80) + "\n");
      
      return res.json({
        success: true,
        message: "Access granted - IP whitelisted",
        ip: scraperIP,
        rule_id: whitelistResult.rule_id,
        status: "active",
        expires_in: "24 hours",
        timestamp: new Date().toISOString()
      });
    } else {
      console.log("❌ Failed to whitelist IP");
      console.log("=".repeat(80) + "\n");
      
      return res.status(500).json({
        success: false,
        error: "Whitelisting failed",
        message: whitelistResult.message,
        details: whitelistResult.errors
      });
    }
    
  } catch (error) {
    console.error("❌ Error in /buy-access:", error);
    console.log("=".repeat(80) + "\n");
    
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * GET /check-access/:ip
 * Check if an IP is whitelisted
 */
app.get("/check-access/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const isWhitelisted = await isIPWhitelisted(ip);
    
    res.json({
      ip: ip,
      whitelisted: isWhitelisted,
      status: isWhitelisted ? "active" : "inactive"
    });
  } catch (error) {
    console.error("Error checking access:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * DELETE /revoke-access/:ip
 * Remove IP from whitelist
 */
app.delete("/revoke-access/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const removed = await removeExistingWhitelist(ip);
    
    if (removed) {
      res.json({
        success: true,
        message: `Access revoked for IP ${ip}`
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to revoke access"
      });
    }
  } catch (error) {
    console.error("Error revoking access:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * GET /payment-info
 * Get payment information for scrapers
 */
app.get("/payment-info", (req, res) => {
  res.json({
    payment_address: PAYMENT_CONFIG.PAYMENT_ADDRESS,
    amount: PAYMENT_CONFIG.AMOUNT_REQUIRED,
    amount_move: (parseInt(PAYMENT_CONFIG.AMOUNT_REQUIRED) / 100000000).toFixed(8),
    currency: "MOVE",
    network: PAYMENT_CONFIG.NETWORK,
    description: PAYMENT_CONFIG.DESCRIPTION,
    instructions: {
      step_1: `Transfer ${(parseInt(PAYMENT_CONFIG.AMOUNT_REQUIRED) / 100000000).toFixed(8)} MOVE to ${PAYMENT_CONFIG.PAYMENT_ADDRESS}`,
      step_2: "POST to /buy-access with your scraper_ip",
      step_3: "Wait 5-10 seconds for whitelisting to propagate",
      step_4: "Retry your scraping request"
    }
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    service: "x402 Access Server",
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 X402 ACCESS SERVER STARTED");
  console.log("=".repeat(80));
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`💳 Payment address: ${PAYMENT_CONFIG.PAYMENT_ADDRESS}`);
  console.log(`💰 Required amount: ${(parseInt(PAYMENT_CONFIG.AMOUNT_REQUIRED) / 100000000).toFixed(8)} MOVE`);
  console.log(`🌐 Cloudflare Zone: ${CLOUDFLARE_CONFIG.ZONE_ID}`);
  console.log("=".repeat(80));
  console.log("\nEndpoints:");
  console.log("  POST   /buy-access        - Purchase scraper access");
  console.log("  GET    /check-access/:ip  - Check whitelist status");
  console.log("  DELETE /revoke-access/:ip - Remove whitelist");
  console.log("  GET    /payment-info      - Get payment details");
  console.log("  GET    /health            - Health check");
  console.log("=".repeat(80) + "\n");
});