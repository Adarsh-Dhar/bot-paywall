// lib/movement.ts

// Constants from environment variables
const MOVEMENT_RPC = process.env.MOVEMENT_RPC_URL || "https://full.testnet.movementinfra.xyz/v1";
const MY_WALLET = process.env.MOVEMENT_WALLET_ADDRESS || "";
const COST_IN_MOVE = parseFloat(process.env.MOVEMENT_COST_IN_MOVE || "0.01");
const COST_IN_WEI = BigInt(Math.floor(COST_IN_MOVE * 1e18)); // Convert to Wei

export async function verifyPayment(txHash: string) {
  try {
    // 1. Fetch Transaction Details
    const txResponse = await fetch(MOVEMENT_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionByHash",
        params: [txHash],
        id: 1,
      }),
    });

    const txData = await txResponse.json();
    const tx = txData.result;

    if (!tx) return { valid: false, reason: "Transaction not found" };

    // 2. Validate Receiver (To)
    // Normalize to lowercase for comparison
    if (tx.to.toLowerCase() !== MY_WALLET.toLowerCase()) {
      return { valid: false, reason: "Payment sent to wrong wallet" };
    }

    // 3. Validate Amount (Value)
    const valueSent = BigInt(tx.value);
    if (valueSent < COST_IN_WEI) {
      return { 
        valid: false, 
        reason: `Insufficient payment. Sent ${tx.value}, needed ${COST_IN_WEI.toString()}` 
      };
    }

    // 4. Verify Success (Get Receipt to ensure it didn't fail on-chain)
    const receiptResponse = await fetch(MOVEMENT_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 1,
      }),
    });

    const receiptData = await receiptResponse.json();
    const receipt = receiptData.result;

    if (!receipt || receipt.status !== "0x1") {
      return { valid: false, reason: "Transaction failed on-chain" };
    }

    return { valid: true };
  } catch (error) {
    console.error("RPC Error:", error);
    return { valid: false, reason: "RPC connection failed" };
  }
}

