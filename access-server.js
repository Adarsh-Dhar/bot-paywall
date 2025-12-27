import express from "express";
import cors from "cors";
// import { x402Paywall } from "x402plus"; // Temporarily disabled as per your file
import fetch from "node-fetch";
import "dotenv/config";

// Startup diagnostic
console.log('Startup diagnostic:', {
  has_WORKER_API_KEY: !!process.env.WORKER_API_KEY,
  has_ACCESS_SERVER_API_KEY: !!process.env.ACCESS_SERVER_API_KEY,
  has_MAIN_APP_API_URL: !!process.env.MAIN_APP_API_URL,
  port: process.env.PORT || process.env.SERVER_PORT || 5000
});

const app = express();
const PORT = process.env.PORT || 5000;

// Main app API configuration
const MAIN_APP_CONFIG = {
  API_BASE_URL: process.env.MAIN_APP_API_URL || "https://d2b57a8a3394.ngrok-free.app",
  WORKER_API_KEY: (process.env.WORKER_API_KEY || process.env.ACCESS_SERVER_API_KEY || '').trim()
};

// Cloudflare API base URL
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

// REMOVED: Fallback Cloudflare credentials from environment
// const FALLBACK_CLOUDFLARE_CONFIG = { ... }

/**
 * Fetch Cloudflare credentials from main app API based on domain
 * Tries the full hostname first, then tries the root domain (without subdomain)
 * STRICT: Only uses DB config, no .env fallback
 */
async function getCloudflareConfig(domain) {
  if (!domain) {
    throw new Error("Domain is required to fetch Cloudflare configuration");
  }

  if (!MAIN_APP_CONFIG.WORKER_API_KEY) {
    throw new Error("WORKER_API_KEY or ACCESS_SERVER_API_KEY environment variable is required");
  }

  // Debug: Log API key info
  const apiKeyPreview = MAIN_APP_CONFIG.WORKER_API_KEY.trim().substring(0, 8) + '...';
  console.log(`🔑 Using API key: ${apiKeyPreview}`);

  // Try the full hostname first
  let hostnameToTry = domain;
  let lastError = null;

  try {
    const url = `${MAIN_APP_CONFIG.API_BASE_URL}/api/worker/config?hostname=${encodeURIComponent(hostnameToTry)}`;
    console.log(`📡 Fetching config from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-Worker-API-Key': MAIN_APP_CONFIG.WORKER_API_KEY.trim(),
        'Authorization': `Bearer ${MAIN_APP_CONFIG.WORKER_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log(`✅ Found config for hostname: ${hostnameToTry}`);
        return {
          zoneId: data.zoneId,
          apiToken: data.cloudflareToken,
          domain: data.domain,
          projectId: data.projectId
        };
      }
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ API request failed: ${response.status} - ${response.statusText}`);
      lastError = new Error(`Failed to fetch config for ${hostnameToTry}: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Fetch error:`, error.message);
    lastError = error;
  }

  // If that failed and it's a subdomain, try the root domain
  const parts = domain.split('.');
  if (parts.length > 2 && parts[0] !== 'www') {
    const rootDomain = parts.slice(1).join('.');
    console.log(`⚠️ Config not found for ${hostnameToTry}, trying root domain: ${rootDomain}`);

    try {
      const response = await fetch(
          `${MAIN_APP_CONFIG.API_BASE_URL}/api/worker/config?hostname=${encodeURIComponent(rootDomain)}`,
          {
            headers: {
              'X-Worker-API-Key': MAIN_APP_CONFIG.WORKER_API_KEY.trim(),
              'Authorization': `Bearer ${MAIN_APP_CONFIG.WORKER_API_KEY.trim()}`,
              'Content-Type': 'application/json'
            }
          }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Found config for root domain: ${rootDomain}`);
          return {
            zoneId: data.zoneId,
            apiToken: data.cloudflareToken,
            domain: data.domain,
            projectId: data.projectId
          };
        }
      }
    } catch (error) {
      // Ignore, we'll throw the original error
    }
  }

  // REMOVED: Fallback to environment variables block
  // If we reach here, we failed to get config from DB
  console.error(`❌ Error fetching Cloudflare config for domain ${domain}:`, lastError?.message || 'Unknown error');
  throw lastError || new Error(`Failed to fetch configuration for domain: ${domain} (DB lookup failed)`);
}

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

async function isIPWhitelisted(ip, zoneId, apiToken) {
  if (!zoneId || !apiToken) {
    throw new Error("Zone ID and API token are required for whitelist check");
  }

  try {
    const response = await fetch(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?configuration.value=${ip}`,
        {
          headers: {
            "Authorization": `Bearer ${apiToken}`,
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

async function verifyPaymentTransaction(txHash, expectedPayTo, expectedAmount) {
  try {
    const rpcUrl = "https://testnet.movementnetwork.xyz/v1";
    console.log(`Fetching transaction ${txHash} from ${rpcUrl}...`);

    let response = await fetch(`${rpcUrl}/transactions/by_hash/${txHash}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      console.log("Transaction may not be propagated yet. Waiting 2 seconds and retrying...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await fetch(`${rpcUrl}/transactions/by_hash/${txHash}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) return false;
    }

    const txData = await response.json();

    if (txData.type !== "user_transaction") return false;
    if (txData.success !== true && txData.vm_status !== "Executed successfully") return false;

    const normalizedExpected = expectedPayTo.replace(/^0x/, "").toLowerCase();
    const expectedAmountNum = parseInt(expectedAmount);

    // Check Payload
    const payload = txData.payload;
    if (payload?.function && payload.function.includes("transfer")) {
      const args = payload.arguments || [];
      if (args.length >= 2) {
        let recipient = String(args[0]).trim().replace(/^0x/, "").toLowerCase();
        let amount = parseInt(args[1]);

        if (recipient === normalizedExpected && amount >= expectedAmountNum) {
          console.log("✅ Payment verified via payload arguments");
          return true;
        }
      }
    }

    // Check Events
    const events = txData.events || [];
    for (const event of events) {
      if (event.type && event.type.includes("DepositEvent")) {
        const eventData = event.data || {};
        const amount = parseInt(eventData.amount || 0);
        const eventAccount = String(event.guid?.account_address || "").replace(/^0x/, "").toLowerCase();

        if (eventAccount === normalizedExpected && amount >= expectedAmountNum) {
          console.log("✅ Payment verified via DepositEvent");
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error verifying payment transaction: ${error.message}`);
    return false;
  }
}

async function removeExistingWhitelist(ip, zoneId, apiToken) {
  if (!zoneId || !apiToken) throw new Error("Zone ID and API token required");

  try {
    const response = await fetch(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?configuration.value=${ip}`,
        {
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          }
        }
    );

    const data = await response.json();

    if (data.success && data.result && data.result.length > 0) {
      for (const rule of data.result) {
        if (rule.mode === "whitelist" && rule.configuration.value === ip) {
          await fetch(
              `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules/${rule.id}`,
              {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${apiToken}`,
                  "Content-Type": "application/json"
                }
              }
          );
          console.log(`Removed existing whitelist rule for ${ip}`);
        }
      }
    }
    return true;
  } catch (error) {
    console.error(`Error removing whitelist: ${error.message}`);
    return false;
  }
}

function scheduleWhitelistDeletion(ip, zoneId, apiToken, delaySeconds = 60) {
  return setTimeout(async () => {
    try {
      console.log(`⏰ Auto-deleting whitelist for IP: ${ip}`);
      await removeExistingWhitelist(ip, zoneId, apiToken);
    } catch (error) {
      console.error(`❌ Error auto-deleting whitelist: ${error.message}`);
    }
  }, delaySeconds * 1000);
}

async function whitelistIP(ip, zoneId, apiToken, notes = "x402 Payment", autoDeleteAfterSeconds = 60) {
  if (!zoneId || !apiToken) throw new Error("Zone ID and API token required");

  // Debug: Log token preview
  console.log(`🔑 Cloudflare API call with token: ${apiToken.substring(0, 8)}...`);

  try {
    await removeExistingWhitelist(ip, zoneId, apiToken);

    const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "whitelist",
        configuration: { target: "ip", value: ip },
        notes: notes
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Successfully whitelisted IP: ${ip}`);
      scheduleWhitelistDeletion(ip, zoneId, apiToken, autoDeleteAfterSeconds);
      return {
        success: true,
        rule_id: data.result.id,
        message: `IP ${ip} has been whitelisted`,
        auto_deletes_in: `${autoDeleteAfterSeconds} seconds`
      };
    } else {
      console.error(`❌ Failed to whitelist IP:`, data.errors);
      return { success: false, message: "Failed to whitelist IP", errors: data.errors };
    }
  } catch (error) {
    console.error(`Error whitelisting IP:`, error.message);
    return { success: false, message: error.message };
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

app.post("/buy-access", async (req, res) => {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔵 NEW ACCESS REQUEST");
    console.log("=".repeat(80));

    const scraperIP = req.body.scraper_ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const domain = req.body.domain || req.query.domain;

    if (!scraperIP) return res.status(400).json({ success: false, error: "No IP address provided" });
    if (!domain) return res.status(400).json({ success: false, error: "No domain provided" });

    // Fetch Cloudflare credentials - STRICT MODE (DB ONLY)
    let cloudflareConfig;
    try {
      console.log(`🔑 Fetching Cloudflare configuration for domain: ${domain}`);
      cloudflareConfig = await getCloudflareConfig(domain);
      console.log(`✅ Cloudflare configuration loaded for domain: ${domain}`);
    } catch (error) {
      console.error(`❌ Failed to fetch Cloudflare configuration: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch Cloudflare configuration",
        message: error.message,
        hint: "Ensure the project exists in the database and API keys are correct"
      });
    }

    const alreadyWhitelisted = await isIPWhitelisted(scraperIP, cloudflareConfig.zoneId, cloudflareConfig.apiToken);
    if (alreadyWhitelisted) {
      return res.json({ success: true, message: "IP already whitelisted", ip: scraperIP, status: "active" });
    }

    // Payment Verification
    const transactionHash = req.body?.tx_hash || req.headers?.['x-payment-proof'];

    if (!transactionHash) {
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
    const paymentVerified = await verifyPaymentTransaction(
        transactionHash,
        PAYMENT_CONFIG.PAYMENT_ADDRESS,
        PAYMENT_CONFIG.AMOUNT_REQUIRED
    );

    if (!paymentVerified) {
      return res.status(403).json({ success: false, error: "Payment verification failed" });
    }

    console.log("✅ Payment verified successfully");

    // Whitelist
    const whitelistResult = await whitelistIP(
        scraperIP,
        cloudflareConfig.zoneId,
        cloudflareConfig.apiToken,
        `x402 Payment - ${new Date().toISOString()}`
    );

    if (whitelistResult.success) {
      return res.json({
        success: true,
        message: "Access granted - IP whitelisted",
        ip: scraperIP,
        rule_id: whitelistResult.rule_id,
        status: "active"
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Whitelisting failed",
        message: whitelistResult.message,
        details: whitelistResult.errors
      });
    }

  } catch (error) {
    console.error("❌ Error in /buy-access:", error);
    return res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

// Other endpoints (check-access, revoke-access) follow similar patterns...
// Simply ensure they call getCloudflareConfig which now strictly enforces DB usage.

app.get("/check-access/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const domain = req.query.domain;
    if (!domain) return res.status(400).json({ error: "Domain required" });

    const cloudflareConfig = await getCloudflareConfig(domain);
    const isWhitelisted = await isIPWhitelisted(ip, cloudflareConfig.zoneId, cloudflareConfig.apiToken);

    res.json({ ip, whitelisted: isWhitelisted, status: isWhitelisted ? "active" : "inactive" });
  } catch (error) {
    res.status(500).json({ error: "Error checking access", message: error.message });
  }
});

app.delete("/revoke-access/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const domain = req.query.domain;
    if (!domain) return res.status(400).json({ error: "Domain required" });

    const cloudflareConfig = await getCloudflareConfig(domain);
    const removed = await removeExistingWhitelist(ip, cloudflareConfig.zoneId, cloudflareConfig.apiToken);

    if (removed) res.json({ success: true, message: `Access revoked for IP ${ip}` });
    else res.status(500).json({ success: false, message: "Failed to revoke access" });
  } catch (error) {
    res.status(500).json({ error: "Error revoking access", message: error.message });
  }
});

app.get("/payment-info", (req, res) => {
  res.json({
    payment_address: PAYMENT_CONFIG.PAYMENT_ADDRESS,
    amount: PAYMENT_CONFIG.AMOUNT_REQUIRED,
    amount_move: (parseInt(PAYMENT_CONFIG.AMOUNT_REQUIRED) / 100000000).toFixed(8),
    currency: "MOVE",
    network: PAYMENT_CONFIG.NETWORK
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "x402 Access Server" });
});

app.listen(PORT, () => {
  console.log(`🚀 X402 ACCESS SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔗 Connected to Main App: ${MAIN_APP_CONFIG.API_BASE_URL}`);
  console.log(`⚠️  STRICT MODE: Database configuration only (no .env fallback)`);
});