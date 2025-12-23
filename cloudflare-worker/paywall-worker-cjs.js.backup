// CommonJS wrapper for the Cloudflare Worker for testing purposes

// Configuration - These should be set via Cloudflare Worker environment variables
const MY_WALLET = "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b";
const PRICE_MOVE = 0.01;
const PRICE_WEI = BigInt(PRICE_MOVE * 1e18);

// Dummy transaction configuration
const DUMMY_CONFIG = {
  enabled: true,
  successRate: 0.9,
  seed: "cloudflare-worker-seed"
};

// In-memory dummy transaction store for the worker
const dummyTransactions = new Map();

// Helper to generate deterministic dummy transactions
function generateDummyTransaction(txHash) {
  let seed = hashString(txHash + DUMMY_CONFIG.seed);
  
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
  
  const isSuccess = deterministicRandom() < DUMMY_CONFIG.successRate;
  
  const transaction = {
    hash: txHash,
    to: MY_WALLET.toLowerCase(),
    from: `0x${generateHex(40)}`,
    value: `0x${PRICE_WEI.toString(16)}`,
    gas: "0x5208",
    gasPrice: `0x${(Math.floor(deterministicRandom() * 20000000000) + 1000000000).toString(16)}`,
    nonce: `0x${Math.floor(deterministicRandom() * 1000).toString(16)}`,
    blockNumber: `0x${(Math.floor(deterministicRandom() * 1000000) + 1000000).toString(16)}`,
    blockHash: `0x${generateHex(64)}`,
    transactionIndex: `0x${Math.floor(deterministicRandom() * 100).toString(16)}`,
    status: isSuccess ? "0x1" : "0x0"
  };
  
  dummyTransactions.set(txHash, transaction);
  return transaction;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function verifyDummyPayment(txHash) {
  // Validate transaction hash format (should be 64 hex characters, optionally prefixed with 0x)
  const cleanHash = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
    return false; // Invalid hash format
  }

  let tx = dummyTransactions.get(txHash);
  if (!tx) {
    tx = generateDummyTransaction(txHash);
  }

  const toValid = tx.to.toLowerCase() === MY_WALLET.toLowerCase();
  const valueWei = BigInt(tx.value);
  const amountValid = valueWei >= PRICE_WEI;
  const statusValid = tx.status === "0x1";

  return toValid && amountValid && statusValid;
}

const worker = {
  async fetch(request, env, ctx) {
    const txHash = request.headers.get("X-Payment-Hash");

    if (!txHash) {
      return new Response(
        JSON.stringify({
          error: "Payment Required",
          message: "Pay 0.01 MOVE to access this resource.",
          payment_address: MY_WALLET,
          price_move: PRICE_MOVE,
          chain_id: 30732,
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const isValid = await verifyDummyPayment(txHash);
      if (isValid) {
        return new Response("🔓 ACCESS GRANTED: Here is your scraped data.", {
          status: 200,
        });
      } else {
        return new Response("❌ Invalid or Insufficient Payment", { status: 403 });
      }
    } catch (e) {
      return new Response(`Verification Error: ${e.message}`, { status: 500 });
    }
  },
};

module.exports = worker;