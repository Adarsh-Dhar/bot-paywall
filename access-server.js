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
  PAYMENT_ADDRESS: process.env.MOVEMENT_PAY_TO || "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b",
  NETWORK: "movement-testnet",
  ASSET: "0x1::aptos_coin::AptosCoin",
  AMOUNT_REQUIRED: "1000000", // 0.01 MOVE in octas
  DESCRIPTION: "Bot scraper access payment",
  TIMEOUT_SECONDS: 600,
  EXPLORER_URL: process.env.MOVEMENT_EXPLORER_URL || "https://explorer.movementnetwork.xyz"
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
 * Verify payment transaction on-chain
 */
async function verifyPaymentTransaction(txHash, expectedPayTo, expectedAmount) {
  try {
    // Query Movement testnet RPC to get transaction details
    const rpcUrl = "https://testnet.movementnetwork.xyz/v1";
    console.log(`Fetching transaction ${txHash} from ${rpcUrl}...`);
    
    // Use by_hash endpoint (standard for Aptos/Movement)
    let response = await fetch(`${rpcUrl}/transactions/by_hash/${txHash}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch transaction: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      // Transaction might not be propagated yet - give it a moment
      console.log("Transaction may not be propagated yet. Waiting 2 seconds and retrying...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retry once
      response = await fetch(`${rpcUrl}/transactions/by_hash/${txHash}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        console.error(`Retry also failed: ${response.status}`);
        return false;
      }
    }
    
    const txData = await response.json();
    
    // Check if transaction is successful
    if (txData.type !== "user_transaction") {
      console.error(`Transaction is not a user_transaction. Type: ${txData.type}`);
      return false;
    }
    
    // Check transaction success status
    if (txData.success !== true && txData.vm_status !== "Executed successfully") {
      console.error(`Transaction not successful. vm_status: ${txData.vm_status}`);
      return false;
    }
    
    // Normalize expected address (remove 0x prefix and convert to lowercase)
    const normalizedExpected = expectedPayTo.replace(/^0x/, "").toLowerCase();
    const expectedAmountNum = parseInt(expectedAmount);
    
    // Method 1: Check transaction payload for transfer_coins function
    const payload = txData.payload;
    if (payload?.function) {
      // Check for transfer functions
      if (payload.function.includes("transfer")) {
        const args = payload.arguments || [];
        
        if (args.length >= 2) {
          // Args format: [recipient, amount] for transfer_coins
          let recipient = String(args[0]).trim();
          let amount = parseInt(args[1]);
          
          // Normalize recipient address
          recipient = recipient.replace(/^0x/, "").toLowerCase();
          
          console.log(`Payload check: recipient=${recipient}, expected=${normalizedExpected}, amount=${amount}, expected=${expectedAmountNum}`);
          
          if (recipient === normalizedExpected && amount >= expectedAmountNum) {
            console.log("✅ Payment verified via payload arguments");
            return true;
          }
        }
      }
    }
    
    // Method 2: Check events for DepositEvent to the expected address
    const events = txData.events || [];
    
    for (const event of events) {
      // Look for coin DepositEvent
      if (event.type && event.type.includes("DepositEvent")) {
        const eventData = event.data || {};
        const amount = parseInt(eventData.amount || 0);
        
        // Get the account address from the event guid
        const eventAccount = event.guid?.account_address || "";
        const normalizedEventAccount = String(eventAccount).replace(/^0x/, "").toLowerCase();
        
        console.log(`DepositEvent check: account=${normalizedEventAccount}, expected=${normalizedExpected}, amount=${amount}, expected=${expectedAmountNum}`);
        
        if (normalizedEventAccount === normalizedExpected && amount >= expectedAmountNum) {
          console.log("✅ Payment verified via DepositEvent");
          return true;
        }
      }
    }
    
    console.error("❌ Payment verification failed - no matching transfer found");
    console.error(`Transaction payload:`, JSON.stringify(payload, null, 2));
    console.error(`Transaction events:`, JSON.stringify(events, null, 2));
    return false;
    
  } catch (error) {
    console.error(`Error verifying payment transaction: ${error.message}`);
    console.error(error.stack);
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
 * Schedule automatic deletion of whitelist after specified seconds
 */
function scheduleWhitelistDeletion(ip, delaySeconds = 60) {
  const timeoutId = setTimeout(async () => {
    try {
      console.log(`⏰ Auto-deleting whitelist for IP: ${ip} after ${delaySeconds} seconds`);
      const deleted = await removeExistingWhitelist(ip);
      if (deleted) {
        console.log(`✅ Successfully auto-deleted whitelist for IP: ${ip}`);
      } else {
        console.log(`⚠️ Auto-deletion attempted for IP: ${ip} (may already be deleted)`);
      }
    } catch (error) {
      console.error(`❌ Error during auto-deletion of whitelist for ${ip}:`, error.message);
    }
  }, delaySeconds * 1000);
  
  return timeoutId;
}

/**
 * Add IP to Cloudflare whitelist
 */
async function whitelistIP(ip, notes = "x402 Payment - Bot Access", autoDeleteAfterSeconds = 60) {
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
      
      // Schedule automatic deletion after specified seconds
      scheduleWhitelistDeletion(ip, autoDeleteAfterSeconds);
      console.log(`⏰ Scheduled auto-deletion of whitelist for IP: ${ip} after ${autoDeleteAfterSeconds} seconds`);
      
      return {
        success: true,
        rule_id: data.result.id,
        message: `IP ${ip} has been whitelisted`,
        auto_deletes_in: `${autoDeleteAfterSeconds} seconds`
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
 * x402 payment handler - Verifies blockchain payments before allowing access
 * Returns 402 if no payment proof, blocks if payment is invalid
 * 
 * NOTE: Temporarily disabled - handling payment verification manually in endpoint
 */
// app.use(
//   x402Paywall(
//     PAYMENT_CONFIG.PAYMENT_ADDRESS,
//     {
//       "POST /buy-access": {
//         network: PAYMENT_CONFIG.NETWORK,
//         asset: PAYMENT_CONFIG.ASSET,
//         maxAmountRequired: PAYMENT_CONFIG.AMOUNT_REQUIRED,
//         description: PAYMENT_CONFIG.DESCRIPTION,
//         mimeType: "application/json",
//         maxTimeoutSeconds: PAYMENT_CONFIG.TIMEOUT_SECONDS
//       }
//     },
//     {
//       url: process.env.FACILITATOR_URL || "https://facilitator.stableyard.fi"
//     }
//   )
// );

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
    
    // Log all payment-related headers for debugging
    console.log("📋 Payment-related headers:", {
      'x-payment-proof': req.headers['x-payment-proof'],
      'x-payment-hash': req.headers['x-payment-hash'],
      'x-transaction-hash': req.headers['x-transaction-hash'],
      'X-PAYMENT-PROOF': req.headers['X-PAYMENT-PROOF'],
      'X-Payment-Proof': req.headers['X-Payment-Proof'],
      'X-Payment-Hash': req.headers['X-Payment-Hash']
    });
    
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
        expires_in: "60 seconds"
      });
    }
    
    // Payment verification: Verify transaction on-chain
    // Extract transaction hash from request
    const transactionHash = req.body?.tx_hash || 
                           req.body?.transaction || 
                           req.body?.transaction_hash ||
                           req.headers?.['x-payment-proof'] || 
                           req.headers?.['x-payment-hash'] ||
                           req.headers?.['x-transaction-hash'] ||
                           req.headers?.['X-PAYMENT-PROOF'] ||
                           req.headers?.['X-Payment-Proof'] ||
                           req.headers?.['X-Payment-Hash'] ||
                           null;
    
    if (!transactionHash) {
      console.log("❌ No payment proof provided");
      console.log("=".repeat(80) + "\n");
      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: "exact",
          network: PAYMENT_CONFIG.NETWORK,
          asset: PAYMENT_CONFIG.ASSET,
          maxAmountRequired: PAYMENT_CONFIG.AMOUNT_REQUIRED,
          resource: `${req.protocol}://${req.get('host')}${req.path}`,
          description: PAYMENT_CONFIG.DESCRIPTION,
          mimeType: "application/json",
          payTo: PAYMENT_CONFIG.PAYMENT_ADDRESS,
          maxTimeoutSeconds: PAYMENT_CONFIG.TIMEOUT_SECONDS
        }]
      });
    }
    
    console.log(`💳 Verifying payment transaction: ${transactionHash}`);
    
    // Verify transaction on-chain
    const paymentVerified = await verifyPaymentTransaction(
      transactionHash, 
      PAYMENT_CONFIG.PAYMENT_ADDRESS,
      PAYMENT_CONFIG.AMOUNT_REQUIRED
    );
    
    if (!paymentVerified) {
      console.log("❌ Payment verification failed");
      console.log("=".repeat(80) + "\n");
      return res.status(403).json({
        success: false,
        error: "Payment verification failed",
        message: "The transaction could not be verified. Please ensure the payment was sent to the correct address with the correct amount."
      });
    }
    
    console.log("✅ Payment verified successfully");
    
    // Generate transaction URL for Movement testnet explorer
    const transactionUrl = `${PAYMENT_CONFIG.EXPLORER_URL}/txn/${transactionHash}`;
    console.log(`🔗 Transaction Hash: ${transactionHash}`);
    console.log(`🔗 Transaction URL: ${transactionUrl}`);
    
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
        transaction: {
          hash: transactionHash,
          url: transactionUrl
        },
        status: "active",
        expires_in: "60 seconds",
        auto_deletes_in: "60 seconds",
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