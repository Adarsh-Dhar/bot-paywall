// CLOUDFLARE WORKER CODE (The Gatekeeper) - DUMMY TRANSACTION MODE
// This worker intercepts requests at the edge and checks for payment proofs using dummy transactions

// Dummy transaction configuration from environment variables
function getConfig(env) {
  return {
    dummyWallet: env?.DUMMY_WALLET_ADDRESS || "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b",
    dummyPriceMove: parseFloat(env?.DUMMY_PRICE_MOVE || "0.01"),
    dummyPriceWei: BigInt(Math.floor((parseFloat(env?.DUMMY_PRICE_MOVE || "0.01")) * 1e18)),
    dummySeed: env?.DUMMY_TRANSACTION_SEED || "cloudflare-worker-seed",
    dummySuccessRate: parseFloat(env?.DUMMY_SUCCESS_RATE || "0.9"),
    dummyLogging: env?.DUMMY_TRANSACTION_LOGGING === "true"
  };
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.dummyLogging) {
      console.log("Dummy transaction worker processing request", {
        url: request.url,
        method: request.method,
        config: {
          dummyWallet: config.dummyWallet,
          dummyPriceMove: config.dummyPriceMove,
          dummySuccessRate: config.dummySuccessRate
        }
      });
    }
    
    // 1. Check if the user is trying to bypass with a Payment Proof
    const txHash = request.headers.get("X-Payment-Hash");

    if (!txHash) {
      // NO PAYMENT? -> Return 402 with instructions for dummy payment
      return new Response(
        JSON.stringify({
          error: "Payment Required",
          message: `Pay ${config.dummyPriceMove} dummy MOVE to access this resource.`,
          payment_address: config.dummyWallet,
          price_move: config.dummyPriceMove,
          mode: "dummy",
          note: "This is a dummy transaction system for testing purposes."
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. VERIFY THE PAYMENT USING DUMMY TRANSACTIONS
    try {
      const isValid = await verifyDummyPayment(txHash, config);
      if (isValid) {
        if (config.dummyLogging) {
          console.log(`Dummy payment verified successfully: ${txHash}`);
        }
        
        // PAYMENT VALID! -> Fetch the actual hidden content
        // In a real app, you would fetch(request) to your origin server here.
        // For this demo, we return the secret data directly.
        return new Response("🔓 ACCESS GRANTED: Here is your scraped data (dummy mode).", {
          status: 200,
          headers: { 
            "Content-Type": "text/plain",
            "X-Payment-Mode": "dummy"
          }
        });
      } else {
        if (config.dummyLogging) {
          console.log(`Dummy payment verification failed: ${txHash}`);
        }
        
        return new Response(
          JSON.stringify({
            error: "Invalid or Insufficient Payment",
            mode: "dummy",
            txHash: txHash
          }),
          { 
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    } catch (e) {
      console.error(`Dummy transaction verification error: ${e.message}`);
      return new Response(
        JSON.stringify({
          error: `Verification Error: ${e.message}`,
          mode: "dummy"
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  },
};

// In-memory dummy transaction store for the worker
const dummyTransactions = new Map();

// Helper to generate deterministic dummy transactions
function generateDummyTransaction(txHash, config) {
  // Use hash as seed for deterministic generation
  let seed = hashString(txHash + config.dummySeed);
  
  // Generate deterministic random values
  const deterministicRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  const generateHex = (length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(deterministicRandom() * 16).toString(16);
    }
    return result;
  };
  
  const isSuccess = deterministicRandom() < config.dummySuccessRate;
  
  // Generate a dummy Movement EVM transaction
  const transaction = {
    hash: txHash,
    to: config.dummyWallet.toLowerCase(),
    from: `0x${generateHex(40)}`,
    value: `0x${config.dummyPriceWei.toString(16)}`,
    gas: "0x5208", // 21000 gas
    gasPrice: `0x${(Math.floor(deterministicRandom() * 20000000000) + 1000000000).toString(16)}`,
    nonce: `0x${Math.floor(deterministicRandom() * 1000).toString(16)}`,
    blockNumber: `0x${(Math.floor(deterministicRandom() * 1000000) + 1000000).toString(16)}`,
    blockHash: `0x${generateHex(64)}`,
    transactionIndex: `0x${Math.floor(deterministicRandom() * 100).toString(16)}`,
    status: isSuccess ? "0x1" : "0x0"
  };
  
  // Store the transaction
  dummyTransactions.set(txHash, transaction);
  
  if (config.dummyLogging) {
    console.log(`Generated dummy transaction: ${txHash}`, {
      to: transaction.to,
      value: transaction.value,
      status: transaction.status,
      success: isSuccess
    });
  }
  
  return transaction;
}

// Helper to hash a string into a number
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Helper to verify dummy payment (replaces blockchain RPC calls)
async function verifyDummyPayment(txHash, config) {
  // Validate transaction hash format (should be 64 hex characters, optionally prefixed with 0x)
  const cleanHash = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
    if (config.dummyLogging) {
      console.log(`Invalid transaction hash format: ${txHash}`);
    }
    return false; // Invalid hash format
  }

  // Get or generate dummy transaction
  let tx = dummyTransactions.get(txHash);
  if (!tx) {
    tx = generateDummyTransaction(txHash, config);
  }

  // CHECKS (same validation logic as real blockchain):
  // 1. Is the receiver correct?
  const toValid = tx.to.toLowerCase() === config.dummyWallet.toLowerCase();

  // 2. Is the amount correct? (Value is in Hex Wei)
  const valueWei = BigInt(tx.value);
  const amountValid = valueWei >= config.dummyPriceWei;

  // 3. Check if transaction was successful
  const statusValid = tx.status === "0x1";

  const isValid = toValid && amountValid && statusValid;
  
  if (config.dummyLogging) {
    console.log(`Dummy payment validation result for ${txHash}:`, {
      toValid,
      amountValid,
      statusValid,
      isValid,
      transaction: tx
    });
  }

  return isValid;
}

