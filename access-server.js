import express from "express";
import cors from "cors";
// import { x402Paywall } from "x402plus"; // Temporarily disabled as per your file
import fetch from "node-fetch";
import "dotenv/config";

// Startup diagnostic
const ACCESS_SERVER_URL = process.env.ACCESS_SERVER_URL || 'http://localhost:5000';
const urlObj = new URL(ACCESS_SERVER_URL);
const PORT = parseInt(urlObj.port) || 5000;

console.log('Startup diagnostic:', {
  has_ACCESS_SERVER_API_KEY: !!process.env.ACCESS_SERVER_API_KEY,
  has_MAIN_APP_API_URL: !!process.env.MAIN_APP_API_URL,
  ACCESS_SERVER_URL: ACCESS_SERVER_URL
});

const app = express();

// Main app API configuration
const MAIN_APP_CONFIG = {
  API_BASE_URL: process.env.MAIN_APP_API_URL ,
  ACCESS_SERVER_API_KEY: process.env.ACCESS_SERVER_API_KEY?.trim() || ''
};

// Cloudflare API base URL
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

// Store scheduled cleanup timeouts to prevent garbage collection
const scheduledCleanups = new Map();

// Config cache to prevent repeated fetches
const configCache = new Map();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// REMOVED: Fallback Cloudflare credentials from environment
// const FALLBACK_CLOUDFLARE_CONFIG = { ... }

/**
 * Fetch Cloudflare credentials from main app API based on domain
 * Tries the full hostname first, then tries the root domain (without subdomain)
 * STRICT: Only uses DB config, no .env fallback
 * Uses caching to prevent repeated fetches
 */
async function getCloudflareConfig(domain) {
  if (!domain) {
    throw new Error("Domain is required to fetch Cloudflare configuration");
  }

  if (!MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY) {
    throw new Error("ACCESS_SERVER_API_KEY environment variable is required");
  }

  // Check cache first
  const cached = configCache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < CONFIG_CACHE_TTL) {
    console.log(`📦 Using cached config for domain: ${domain}`);
    return cached.config;
  }

  // Debug: Log API key info
  const apiKeyPreview = MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY.trim().substring(0, 8) + '...';
  console.log(`🔑 Using API key: ${apiKeyPreview}`);

  // Try the full hostname first
  let hostnameToTry = domain;
  let lastError = null;

  try {
    const url = `${MAIN_APP_CONFIG.API_BASE_URL}/api/worker/config?hostname=${encodeURIComponent(hostnameToTry)}`;
    console.log(`📡 Fetching config from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-API-Key': MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY.trim(),
        'Authorization': `Bearer ${MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log(`✅ Found config for hostname: ${hostnameToTry}`);
        const config = {
          zoneId: data.zoneId,
          apiToken: data.cloudflareToken,
          domain: data.domain,
          projectId: data.projectId,
          paymentAddress: data.paymentAddress,
          paymentAmount: data.paymentAmount
        };
        // Cache the config
        configCache.set(domain, { config, timestamp: Date.now() });
        return config;
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
              'X-API-Key': MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY.trim(),
              'Authorization': `Bearer ${MAIN_APP_CONFIG.ACCESS_SERVER_API_KEY.trim()}`,
              'Content-Type': 'application/json'
            }
          }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Found config for root domain: ${rootDomain}`);
          const config = {
            zoneId: data.zoneId,
            apiToken: data.cloudflareToken,
            domain: data.domain,
            projectId: data.projectId,
            paymentAddress: data.paymentAddress,
            paymentAmount: data.paymentAmount
          };
          // Cache the config for both the original domain and root domain
          configCache.set(domain, { config, timestamp: Date.now() });
          configCache.set(rootDomain, { config, timestamp: Date.now() });
          return config;
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
    console.log(`🔍 Searching for existing whitelist rules for IP: ${ip}`);
    const response = await fetch(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?configuration.value=${ip}`,
        {
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          }
        }
    );

    if (!response.ok) {
      console.error(`❌ Failed to fetch rules: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();

    if (data.success && data.result && data.result.length > 0) {
      let deletedCount = 0;
      for (const rule of data.result) {
        if (rule.mode === "whitelist" && rule.configuration.value === ip) {
          console.log(`🗑️  Deleting existing rule ${rule.id} for IP ${ip}`);
          const deleteResponse = await fetch(
              `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules/${rule.id}`,
              {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${apiToken}`,
                  "Content-Type": "application/json"
                }
              }
          );
          
          if (deleteResponse.ok) {
            deletedCount++;
            console.log(`✅ Removed existing whitelist rule ${rule.id} for ${ip}`);
          } else {
            const errorBody = await deleteResponse.text().catch(() => '');
            console.error(`❌ Failed to delete rule ${rule.id}: ${deleteResponse.status} ${errorBody}`);
          }
        }
      }
      return deletedCount > 0;
    } else {
      console.log(`ℹ️  No existing whitelist rules found for IP: ${ip}`);
      return true; // No rules to remove is considered success
    }
  } catch (error) {
    console.error(`❌ Error removing whitelist for ${ip}: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return false;
  }
}

function scheduleWhitelistDeletion(ip, zoneId, apiToken, delaySeconds = 60) {
  return setTimeout(async () => {
    try {
      console.log(`⏰ Auto-deleting whitelist rule for ${ip}`);
      await removeExistingWhitelist(ip, zoneId, apiToken);
    } catch (error) {
      console.error(`❌ Error auto-deleting whitelist: ${error.message}`);
    }
  }, delaySeconds * 1000);
}

// Prefer deleting by rule ID when we have it; fallback to IP-based cleanup otherwise.
function scheduleWhitelistDeletionByRuleId(ruleId, zoneId, apiToken, delaySeconds = 60, ipHint) {
  const scheduledAt = new Date();
  const deleteAt = new Date(scheduledAt.getTime() + delaySeconds * 1000);
  
  console.log(`⏲️  Scheduling deletion of rule ${ruleId} in ${delaySeconds} seconds`);
  console.log(`   Scheduled at: ${scheduledAt.toISOString()}`);
  console.log(`   Will delete at: ${deleteAt.toISOString()}`);
  
  // Clear any existing timeout for this rule ID
  const existingTimeout = scheduledCleanups.get(ruleId);
  if (existingTimeout) {
    console.log(`   ⚠️  Clearing existing timeout for rule ${ruleId}`);
    clearTimeout(existingTimeout);
  }
  
  const timeoutId = setTimeout(async () => {
    const deletionStartTime = new Date();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`⏰ AUTO-DELETION TRIGGERED for rule ${ruleId}${ipHint ? ` (IP: ${ipHint})` : ''}`);
    console.log(`   Scheduled at: ${scheduledAt.toISOString()}`);
    console.log(`   Deletion started at: ${deletionStartTime.toISOString()}`);
    console.log(`   Elapsed time: ${Math.round((deletionStartTime - scheduledAt) / 1000)} seconds`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
      const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`;
      console.log(`🗑️  Deleting rule ${ruleId} from Cloudflare...`);
      console.log(`   URL: ${url}`);
      
      const resp = await fetch(url, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        }
      });

      const deletionEndTime = new Date();
      
      if (!resp.ok) {
        const body = await resp.text();
        console.error(`❌ Failed to delete rule ${ruleId}: ${resp.status} ${body}`);
        console.error(`   Attempted deletion at: ${deletionEndTime.toISOString()}`);
        
        // Fallback to IP-based deletion
        if (ipHint) {
          console.log(`   🔄 Attempting fallback IP-based deletion for ${ipHint}...`);
          const fallbackResult = await removeExistingWhitelist(ipHint, zoneId, apiToken);
          if (fallbackResult) {
            console.log(`   ✅ Fallback deletion succeeded for IP ${ipHint}`);
          } else {
            console.error(`   ❌ Fallback deletion also failed for IP ${ipHint}`);
          }
        }
      } else {
        const respData = await resp.json().catch(() => ({}));
        console.log(`✅ Successfully deleted whitelist rule ${ruleId}${ipHint ? ` for ${ipHint}` : ''}`);
        console.log(`   Deletion completed at: ${deletionEndTime.toISOString()}`);
        console.log(`   Cloudflare response: ${JSON.stringify(respData, null, 2)}`);
      }
      
      // Remove from scheduled cleanups map
      scheduledCleanups.delete(ruleId);
      console.log(`📝 Removed rule ${ruleId} from cleanup map. Active cleanups: ${scheduledCleanups.size}`);
    } catch (error) {
      const errorTime = new Date();
      console.error(`❌ Error auto-deleting rule ${ruleId}: ${error.message}`);
      console.error(`   Error occurred at: ${errorTime.toISOString()}`);
      console.error(`   Stack trace: ${error.stack}`);
      
      if (ipHint) {
        console.log(`   🔄 Attempting fallback IP-based deletion for ${ipHint}...`);
        try {
          const fallbackResult = await removeExistingWhitelist(ipHint, zoneId, apiToken);
          if (fallbackResult) {
            console.log(`   ✅ Fallback deletion succeeded for IP ${ipHint}`);
          } else {
            console.error(`   ❌ Fallback deletion also failed for IP ${ipHint}`);
          }
        } catch (fallbackError) {
          console.error(`   ❌ Fallback deletion error: ${fallbackError.message}`);
        }
      }
      scheduledCleanups.delete(ruleId);
    }
  }, delaySeconds * 1000);
  
  // Store the timeout reference to prevent garbage collection
  scheduledCleanups.set(ruleId, timeoutId);
  console.log(`📝 Stored cleanup timeout for rule ${ruleId}. Active cleanups: ${scheduledCleanups.size}`);
  console.log(`   Timeout ID: ${timeoutId}`);
  
  return timeoutId;
}

async function whitelistIP(ip, zoneId, apiToken, notes = "x402 Payment", autoDeleteAfterSeconds = 60) {
  if (!zoneId || !apiToken) throw new Error("Zone ID and API token required");

  console.log(`🔑 Cloudflare API call with token: ${apiToken.substring(0, 8)}...`);
  console.log(`💾 Whitelisting IP: ${ip} for zone: ${zoneId}`);

  try {
    // Remove existing whitelist rule first
    await removeExistingWhitelist(ip, zoneId, apiToken);

    // Use IP Access Rules endpoint with mode="whitelist"
    const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules`;
    console.log(`📤 POST to: ${url}`);
    
    const requestBody = {
      mode: "whitelist",
      configuration: {
        target: "ip",
        value: ip
      },
      notes: notes
    };
    
    console.log(`📦 Payload: ${JSON.stringify(requestBody, null, 2)}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log(`☁️ Cloudflare Response Status: ${response.status}`);
    console.log(`☁️ Cloudflare Response: ${JSON.stringify(data, null, 2)}`);

    if (data.success) {
      console.log(`✅ Successfully whitelisted IP ${ip}`);
      const ruleId = data.result.id;
      console.log(`📋 Rule ID: ${ruleId}`);
      console.log(`⏱️  Auto-deletion scheduled for ${autoDeleteAfterSeconds} seconds`);
      
      // Schedule by rule id (safer), with IP fallback
      const timeoutId = scheduleWhitelistDeletionByRuleId(ruleId, zoneId, apiToken, autoDeleteAfterSeconds, ip);
      
      console.log(`✅ Whitelist complete. Rule will be deleted in ${autoDeleteAfterSeconds} seconds.`);
      
      return {
        success: true,
        rule_id: ruleId,
        message: `IP ${ip} has been whitelisted`,
        auto_deletes_in: `${autoDeleteAfterSeconds} seconds`,
        timeout_id: timeoutId
      };
    } else {
      console.error(`❌ Failed to whitelist IP:`, JSON.stringify(data, null, 2));
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

    // Prioritize client-provided scraper_ip, then server-detected IP
    // Client provides the actual egress IP from api.ipify.org, which is more reliable than header detection
    const clientProvidedIP = req.body.scraper_ip || req.query.scraper_ip;
    const detectedIP = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const scraperIP = clientProvidedIP || detectedIP;
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
    
    // Use project-specific payment config if available, otherwise fall back to default
    const paymentAddress = cloudflareConfig.paymentAddress || PAYMENT_CONFIG.PAYMENT_ADDRESS;
    const paymentAmount = cloudflareConfig.paymentAmount || PAYMENT_CONFIG.AMOUNT_REQUIRED;

    if (!transactionHash) {
      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: "exact",
          network: PAYMENT_CONFIG.NETWORK,
          asset: PAYMENT_CONFIG.ASSET,
          maxAmountRequired: paymentAmount,
          resource: `${req.protocol}://${req.get('host')}${req.path}`,
          description: PAYMENT_CONFIG.DESCRIPTION,
          mimeType: "application/json",
          payTo: paymentAddress,
          maxTimeoutSeconds: PAYMENT_CONFIG.TIMEOUT_SECONDS
        }]
      });
    }

    console.log(`💳 Verifying payment transaction: ${transactionHash}`);
    console.log(`💰 Using payment address: ${paymentAddress}`);
    console.log(`💰 Using payment amount: ${paymentAmount} octas`);
    const paymentVerified = await verifyPaymentTransaction(
        transactionHash,
        paymentAddress,
        paymentAmount
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
      `x402 Payment - ${new Date().toISOString()}`,
      60  // Auto-delete after 1 minute
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

app.get("/payment-info", async (req, res) => {
  try {
    const domain = req.query.domain;
    
    // If domain is provided, try to get project-specific payment config
    let paymentAddress = PAYMENT_CONFIG.PAYMENT_ADDRESS;
    let paymentAmount = PAYMENT_CONFIG.AMOUNT_REQUIRED;
    
    if (domain) {
      try {
        const cloudflareConfig = await getCloudflareConfig(domain);
        if (cloudflareConfig.paymentAddress) {
          paymentAddress = cloudflareConfig.paymentAddress;
        }
        if (cloudflareConfig.paymentAmount) {
          paymentAmount = cloudflareConfig.paymentAmount;
        }
      } catch (error) {
        // If config fetch fails, use defaults
        console.log(`⚠️  Could not fetch project config for ${domain}, using defaults`);
      }
    }
    
    res.json({
      payment_address: paymentAddress,
      amount: paymentAmount,
      amount_move: (parseInt(paymentAmount) / 100000000).toFixed(8),
      currency: "MOVE",
      network: PAYMENT_CONFIG.NETWORK
    });
  } catch (error) {
    // Fallback to default config on error
    res.json({
      payment_address: PAYMENT_CONFIG.PAYMENT_ADDRESS,
      amount: PAYMENT_CONFIG.AMOUNT_REQUIRED,
      amount_move: (parseInt(PAYMENT_CONFIG.AMOUNT_REQUIRED) / 100000000).toFixed(8),
      currency: "MOVE",
      network: PAYMENT_CONFIG.NETWORK
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "x402 Access Server" });
});

// Debug endpoint to check scheduled cleanups
app.get("/debug/cleanups", (req, res) => {
  const cleanups = Array.from(scheduledCleanups.entries()).map(([ruleId, timeoutId]) => ({
    ruleId,
    timeoutId: timeoutId.toString(),
    active: true
  }));
  
  res.json({
    active_cleanups: scheduledCleanups.size,
    cleanups: cleanups,
    cache_size: configCache.size,
    cached_domains: Array.from(configCache.keys())
  });
});

app.listen(PORT, () => {
  console.log(`🚀 X402 ACCESS SERVER RUNNING AT ${ACCESS_SERVER_URL}`);
  console.log(`🔗 Connected to Main App: ${MAIN_APP_CONFIG.API_BASE_URL}`);
  console.log(`⚠️  STRICT MODE: Database configuration only (no .env fallback)`);
});