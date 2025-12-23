const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk');

// Configuration Constants
const CONFIG = {
  CLOUDFLARE_TOKEN: 'oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB',
  CLOUDFLARE_ZONE_ID: '11685346bf13dc3ffebc9cc2866a8105',
  CLOUDFLARE_API_URL: 'https://api.cloudflare.com/client/v4',
  PAYMENT_DESTINATION: '0xYOUR_WALLET_ADDRESS_HERE',
  REQUIRED_AMOUNT_OCTAS: 1000000, // 0.01 MOVE
  SUBSCRIPTION_DURATION_MS: 60000, // 60 seconds
  SERVER_PORT: 3000
};

// In-memory storage for active timers
const activeTimers = new Map();

// Utility functions for activeTimers management
function getActiveTimersCount() {
  return activeTimers.size;
}

function getActiveIPs() {
  return Array.from(activeTimers.keys());
}

function hasActiveTimer(ip) {
  return activeTimers.has(ip);
}

function clearAllTimers() {
  for (const [ip, timer] of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}

// Initialize Express app
const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Middleware setup
app.use(bodyParser.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      error: 'Invalid JSON in request body',
      code: 400 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    code: 500 
  });
});

// Initialize Aptos client
const aptosConfig = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(aptosConfig);

// Aptos SDK wrapper functions
async function fetchTransactionByHash(txHash) {
  try {
    if (!txHash || typeof txHash !== 'string') {
      throw new Error('Invalid transaction hash format');
    }
    
    // Remove 0x prefix if present, then add it back (ensures consistent format)
    const cleanHash = txHash.replace(/^0x/, '').toLowerCase();
    
    // Validate hex string length (should be 64 characters)
    if (cleanHash.length !== 64 || !/^[0-9a-f]+$/.test(cleanHash)) {
      throw new Error('Transaction hash must be 64 character hex string');
    }
    
    const normalizedHash = `0x${cleanHash}`;
    
    console.log(`Fetching transaction: ${normalizedHash}`);
    const transaction = await aptos.getTransactionByHash({ 
      transactionHash: normalizedHash 
    });
    
    return transaction;
  } catch (error) {
    console.error('Aptos SDK error:', error.message);
    
    // Handle specific Aptos SDK errors
    if (error.message.includes('timeout') || error.message.includes('ECONNABORTED')) {
      throw new Error('Blockchain network timeout - please try again');
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      throw new Error('Transaction not found on blockchain');
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      throw new Error('Blockchain API rate limit exceeded - please try again later');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      throw new Error('Unable to connect to blockchain network');
    } else if (error.message.includes('Invalid transaction hash')) {
      throw new Error('Invalid transaction hash format');
    } else {
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
  }
}

// Test Aptos connection
async function testAptosConnection() {
  try {
    const ledgerInfo = await aptos.getLedgerInfo();
    console.log(`Connected to Aptos network. Chain ID: ${ledgerInfo.chain_id}`);
    return true;
  } catch (error) {
    console.error('Failed to connect to Aptos network:', error.message);
    return false;
  }
}

// Utility function to get client IP
function getClientIP(req) {
  // Priority order for IP detection:
  // 1. Explicitly provided scraper_ip (handled in endpoint)
  // 2. X-Forwarded-For header (for proxies/load balancers)
  // 3. X-Real-IP header (for nginx proxy)
  // 4. req.ip (Express built-in, requires trust proxy)
  // 5. Connection remote address
  // 6. Socket remote address
  
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    const firstIP = forwardedFor.split(',')[0].trim();
    if (isValidIP(firstIP)) {
      return firstIP;
    }
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }
  
  if (req.ip && isValidIP(req.ip)) {
    return req.ip;
  }
  
  const connectionIP = req.connection?.remoteAddress || 
                      req.socket?.remoteAddress ||
                      req.connection?.socket?.remoteAddress;
  
  if (connectionIP && isValidIP(connectionIP)) {
    return connectionIP;
  }
  
  return 'unknown';
}

// Utility function to validate IP address format
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(cleanIP)) {
    const parts = cleanIP.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(ip);
}

// Payment Verifier Component
class PaymentVerifier {
  async verifyPayment(txHash) {
    try {
      console.log(`Verifying payment for transaction: ${txHash}`);
      
      // Fetch transaction using Aptos SDK wrapper
      const transaction = await fetchTransactionByHash(txHash);
      
      // Verify transaction success
      if (!transaction.success) {
        console.log('Transaction failed');
        return false;
      }
      
      // Extract payment details from transaction events
      const paymentDetails = this.extractPaymentDetails(transaction);
      
      if (!paymentDetails) {
        console.log('No valid payment found in transaction');
        return false;
      }
      
      // Verify receiver address matches configured wallet
      if (paymentDetails.receiver !== CONFIG.PAYMENT_DESTINATION) {
        console.log(`Payment sent to wrong address: ${paymentDetails.receiver}, expected: ${CONFIG.PAYMENT_DESTINATION}`);
        return false;
      }
      
      // Verify payment amount >= required amount
      if (paymentDetails.amount < CONFIG.REQUIRED_AMOUNT_OCTAS) {
        console.log(`Insufficient payment: ${paymentDetails.amount}, required: ${CONFIG.REQUIRED_AMOUNT_OCTAS}`);
        return false;
      }
      
      console.log('Payment Verified');
      return true;
      
    } catch (error) {
      console.error('Payment verification error:', error.message);
      return false;
    }
  }
  
  extractPaymentDetails(transaction) {
    let paymentAmount = 0;
    let receiverAddress = null;
    
    // Check transaction events for coin transfer
    if (transaction.events) {
      for (const event of transaction.events) {
        // Look for coin deposit events (indicates a transfer)
        if (event.type.includes('CoinStore') && event.type.includes('DepositEvent')) {
          paymentAmount = parseInt(event.data.amount || '0');
          receiverAddress = event.account_address;
          break;
        }
        
        // Alternative: look for withdraw/deposit event pairs
        if (event.type.includes('coin::CoinStore') && event.data.amount) {
          paymentAmount = parseInt(event.data.amount);
          receiverAddress = event.account_address;
          break;
        }
      }
    }
    
    // Fallback: check transaction payload for direct transfer
    if (!receiverAddress && transaction.payload) {
      if (transaction.payload.function === '0x1::coin::transfer' || 
          transaction.payload.function === '0x1::aptos_coin::transfer') {
        const args = transaction.payload.arguments;
        if (args && args.length >= 2) {
          receiverAddress = args[0]; // First argument is usually the receiver
          paymentAmount = parseInt(args[1]); // Second argument is usually the amount
        }
      }
    }
    
    if (!receiverAddress || paymentAmount === 0) {
      return null;
    }
    
    return {
      receiver: receiverAddress,
      amount: paymentAmount
    };
  }
}

// Cloudflare Client Component
class CloudflareClient {
  constructor() {
    this.baseURL = `${CONFIG.CLOUDFLARE_API_URL}/zones/${CONFIG.CLOUDFLARE_ZONE_ID}/firewall/access_rules/rules`;
    this.headers = {
      'Authorization': `Bearer ${CONFIG.CLOUDFLARE_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }
  
  async findExistingRule(ip) {
    try {
      const response = await axios.get(`${this.baseURL}?configuration.value=${ip}`, {
        headers: this.headers,
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success && response.data.result.length > 0) {
        return response.data.result[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding existing rule:', error.message);
      
      // Handle specific error types
      if (error.code === 'ECONNABORTED') {
        throw new Error('Cloudflare API timeout - service temporarily unavailable');
      } else if (error.response) {
        // HTTP error response from Cloudflare
        const status = error.response.status;
        if (status === 401 || status === 403) {
          throw new Error('Cloudflare API authentication failed');
        } else if (status === 429) {
          throw new Error('Cloudflare API rate limit exceeded - please try again later');
        } else if (status >= 500) {
          throw new Error('Cloudflare API server error - service temporarily unavailable');
        } else {
          throw new Error(`Cloudflare API error: ${error.response.data?.errors?.[0]?.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        // Network error
        throw new Error('Unable to connect to Cloudflare API - network error');
      } else {
        // Other error
        throw new Error(`Cloudflare API request failed: ${error.message}`);
      }
    }
  }
  
  async createWhitelistRule(ip) {
    try {
      const ruleData = {
        mode: 'whitelist',
        configuration: {
          target: 'ip',
          value: ip
        },
        notes: 'Bypass'
      };
      
      const response = await axios.post(this.baseURL, ruleData, {
        headers: this.headers,
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        console.log('Whitelisted IP');
        return response.data.result.id;
      } else {
        const errorMsg = response.data.errors?.[0]?.message || 'Unknown Cloudflare API error';
        throw new Error(`Cloudflare API error: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error creating whitelist rule:', error.message);
      
      // Handle specific error types
      if (error.code === 'ECONNABORTED') {
        throw new Error('Cloudflare API timeout - service temporarily unavailable');
      } else if (error.response) {
        // HTTP error response from Cloudflare
        const status = error.response.status;
        if (status === 401 || status === 403) {
          throw new Error('Cloudflare API authentication failed');
        } else if (status === 429) {
          throw new Error('Cloudflare API rate limit exceeded - please try again later');
        } else if (status >= 500) {
          throw new Error('Cloudflare API server error - service temporarily unavailable');
        } else {
          throw new Error(`Cloudflare API error: ${error.response.data?.errors?.[0]?.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        // Network error
        throw new Error('Unable to connect to Cloudflare API - network error');
      } else {
        // Re-throw if it's already a formatted error from above
        throw error;
      }
    }
  }
  
  async deleteRule(ruleId) {
    try {
      const response = await axios.delete(`${this.baseURL}/${ruleId}`, {
        headers: this.headers,
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.data.success) {
        const errorMsg = response.data.errors?.[0]?.message || 'Unknown Cloudflare API error';
        throw new Error(`Cloudflare API error: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error deleting rule:', error.message);
      
      // Handle specific error types
      if (error.code === 'ECONNABORTED') {
        throw new Error('Cloudflare API timeout - service temporarily unavailable');
      } else if (error.response) {
        // HTTP error response from Cloudflare
        const status = error.response.status;
        if (status === 401 || status === 403) {
          throw new Error('Cloudflare API authentication failed');
        } else if (status === 404) {
          // Rule not found - this might be okay in some cases
          console.warn(`Rule ${ruleId} not found - may have been already deleted`);
          return; // Don't throw error for 404 on delete
        } else if (status === 429) {
          throw new Error('Cloudflare API rate limit exceeded - please try again later');
        } else if (status >= 500) {
          throw new Error('Cloudflare API server error - service temporarily unavailable');
        } else {
          throw new Error(`Cloudflare API error: ${error.response.data?.errors?.[0]?.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        // Network error
        throw new Error('Unable to connect to Cloudflare API - network error');
      } else {
        // Re-throw if it's already a formatted error from above
        throw error;
      }
    }
  }
}

// Timer Manager Component
class TimerManager {
  startTimer(ip, ruleId, cloudflareClient) {
    // Cancel existing timer if present
    this.cancelTimer(ip);
    
    // Start new 60-second timer
    const timer = setTimeout(async () => {
      try {
        // Delete Cloudflare rule
        await cloudflareClient.deleteRule(ruleId);
        
        // Remove from activeTimers
        activeTimers.delete(ip);
        
        console.log('Timer Expired - Access Revoked');
      } catch (error) {
        console.error('Error during timer cleanup:', error.message);
        
        // Log specific error but still clean up local state
        if (error.message.includes('authentication failed')) {
          console.error('Cloudflare authentication failed during cleanup - rule may persist');
        } else if (error.message.includes('not found')) {
          console.warn('Rule already deleted or not found during cleanup');
        } else if (error.message.includes('network error')) {
          console.error('Network error during cleanup - rule may persist until manual cleanup');
        } else {
          console.error('Unknown error during cleanup:', error.message);
        }
        
        // Always remove from activeTimers even if Cloudflare deletion fails
        activeTimers.delete(ip);
        console.log('Timer Expired - Access Revoked (with cleanup errors)');
      }
    }, CONFIG.SUBSCRIPTION_DURATION_MS);
    
    // Store timer in activeTimers map
    activeTimers.set(ip, timer);
  }
  
  cancelTimer(ip) {
    const existingTimer = activeTimers.get(ip);
    if (existingTimer) {
      clearTimeout(existingTimer);
      activeTimers.delete(ip);
    }
  }
}

// Initialize components
const paymentVerifier = new PaymentVerifier();
const cloudflareClient = new CloudflareClient();
const timerManager = new TimerManager();

// Main API endpoint: POST /buy-access
app.post('/buy-access', async (req, res) => {
  try {
    const { tx_hash, scraper_ip } = req.body;
    
    // Validate required fields
    if (!tx_hash) {
      return res.status(400).json({
        error: 'Missing required field: tx_hash',
        code: 400
      });
    }
    
    // Determine IP address to whitelist
    const targetIP = scraper_ip || getClientIP(req);
    
    if (!targetIP || targetIP === 'unknown') {
      return res.status(400).json({
        error: 'Unable to determine IP address',
        code: 400
      });
    }
    
    // Verify payment
    const paymentValid = await paymentVerifier.verifyPayment(tx_hash);
    if (!paymentValid) {
      return res.status(402).json({
        error: 'Payment verification failed',
        code: 402
      });
    }
    
    // Check for existing rule and delete if found
    const existingRuleId = await cloudflareClient.findExistingRule(targetIP);
    if (existingRuleId) {
      await cloudflareClient.deleteRule(existingRuleId);
    }
    
    // Create new whitelist rule
    const ruleId = await cloudflareClient.createWhitelistRule(targetIP);
    
    // Start timer for automatic cleanup
    timerManager.startTimer(targetIP, ruleId, cloudflareClient);
    
    // Return success response
    res.status(200).json({
      status: 'granted',
      expires_in: '60s'
    });
    
  } catch (error) {
    console.error('Error in /buy-access endpoint:', error.message);
    
    // Handle specific error types with meaningful messages
    if (error.message.includes('Cloudflare API timeout') || 
        error.message.includes('service temporarily unavailable')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable - please try again later',
        code: 503
      });
    } else if (error.message.includes('Cloudflare API authentication failed')) {
      return res.status(503).json({
        error: 'Service configuration error - please contact support',
        code: 503
      });
    } else if (error.message.includes('rate limit exceeded')) {
      return res.status(429).json({
        error: 'Service temporarily busy - please try again in a few minutes',
        code: 429
      });
    } else if (error.message.includes('network error') || 
               error.message.includes('Unable to connect')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable due to network issues',
        code: 503
      });
    } else if (error.response && error.response.status) {
      // Cloudflare API error with HTTP status
      return res.status(503).json({
        error: 'External service error - please try again later',
        code: 503
      });
    } else if (error.message.includes('Payment verification failed') ||
               error.message.includes('Failed to fetch transaction')) {
      // Payment-related errors should return 402
      return res.status(402).json({
        error: 'Payment verification failed',
        code: 402
      });
    }
    
    // Generic server error for unhandled cases
    res.status(500).json({
      error: 'Internal server error',
      code: 500
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConnections: activeTimers.size
  });
});

// Start server only if this file is run directly (not imported)
if (require.main === module) {
  const server = app.listen(CONFIG.SERVER_PORT, () => {
    console.log(`Access Control Middleware listening on port ${CONFIG.SERVER_PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    // Clear all active timers
    clearAllTimers();
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

module.exports = { 
  app, 
  CONFIG, 
  activeTimers, 
  PaymentVerifier, 
  CloudflareClient, 
  TimerManager,
  getActiveTimersCount,
  getActiveIPs,
  hasActiveTimer,
  clearAllTimers,
  getClientIP,
  isValidIP,
  fetchTransactionByHash,
  testAptosConnection
};