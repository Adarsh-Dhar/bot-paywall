# x402 Track Movement Hackathon

This guide explains how to integrate the x402 payment standard on the Movement network using the x402plus SDK. It covers the protocol overview, server and client setup, facilitator configuration, and a working demo flow for hackathon builders.

### **What you’ll build**

- A Movement-protected API route (pay-per-request).
- A client that receives a 402 and retries with a valid X-PAYMENT header.
- A facilitator that verifies and settles Movement transactions (we default to a hosted one, or you can run your own).

---

## **1) Overview**

- x402 is “pay-per-request” for APIs. If the request lacks payment, the server replies 402 with Payment Requirements. The client signs and retries with `X-PAYMENT`.
- For Movement, the flow uses a Move transaction: build and sign a transfer, then send base64-encoded BCS bytes for the authenticator and raw transaction in the `X-PAYMENT` header.
- A “facilitator” service verifies and settles the payment off your API server.

Key parts:

- Server: Express middleware (`x402Paywall`) that enforces payment and talks to the facilitator.
- Client: wraps `fetch` to automatically handle 402 → sign → retry.
- Facilitator: validates `X-PAYMENT` and settles on-chain.

---

## **2) Prerequisites**

- Node.js 18+
- Movement fullnode RPC (testnet or mainnet)
- A Movement account (private key or wallet integration)
- Facilitator URL (defaults to `https://facilitator.stableyard.fi`)

Networks and assets:

- Use `movement` for mainnet and `movement-testnet` for testnet in the `network` field.
- Only MOVE is supported for now. Set `asset` to the MOVE coin type (e.g., `0x1::aptos_coin::AptosCoin`). USDC and other assets are not yet supported.

---

## **3) Server (Express) – Movement Paywall**

Install:

```bash
npm i x402plus

```

Add a Movement-protected route (uses the Movement “exact” scheme with Aptos-like transaction signing):

```tsx
import express from "express";
import { x402Paywall } from "x402plus";

const app = express();

app.use(
  x402Paywall(
    // Receiver Movement address (32-byte). Short forms will be padded by our demo if needed.
    process.env.MOVEMENT_PAY_TO as string,
    {
      "GET /api/premium-image-movement": {
        // Must match what the client and facilitator expect.
        // Networks: "movement" (mainnet), "movement-testnet" (testnet)
        network: process.env.MOVEMENT_NETWORK || "movement",
        // Only MOVE is supported for now.
        // Set the MOVE coin type here (adjust if your chain uses a different canonical type string).
        asset: process.env.MOVEMENT_ASSET || "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: process.env.MOVEMENT_MAX_AMOUNT_REQUIRED || "1000000",
        description: "Premium image (Movement)",
        mimeType: "image/jpeg",
        maxTimeoutSeconds: Number(process.env.MOVEMENT_MAX_TIMEOUT_SECONDS || 600)
      }
    },
    {
      // Hosted facilitator (override via env as needed)
      url: process.env.MOVEMENT_FACILITATOR_URL || "https://facilitator.stableyard.fi"
    }
  )
);

app.get("/api/premium-image-movement", (_req, res) => {
  res.json({ ok: true, demo: "Movement content unlocked" });
});

```

Notes:

- The middleware returns 402 with Payment Requirements when `X-PAYMENT` is missing.
- On retry with `X-PAYMENT`, it calls the facilitator `/verify` and `/settle` before letting the handler run.
- The server sets `X-PAYMENT-RESPONSE` with facilitator result (e.g., tx hash).

---

## **4) Client – Movement Signing Options**

You can integrate either via a Movement wallet (preferred) or by using the Aptos TS SDK for a demo.

### **Option A: Wallet-based signing (recommended)**

- Use a Movement-compatible wallet’s `signTransaction` API to sign a Move transfer.
- Serialize to BCS, then use `buildAptosLikePaymentHeader(...)` to produce `X-PAYMENT`.

Example (pseudo):

```tsx
import { withX402Fetch, buildAptosLikePaymentHeader } from "x402plus";

const fetchWithPayment = withX402Fetch(fetch, {
  signer: {
    async signExact(accepts) {
      // Ask wallet to build+sign the transfer transaction
      const { signatureBcsBase64, transactionBcsBase64 } = await wallet.signMoveTransfer({
        toAddress: accepts.payTo,
        amount: accepts.maxAmountRequired,
        network: accepts.network
      });
      return buildAptosLikePaymentHeader(accepts, {
        signatureBcsBase64,
        transactionBcsBase64
      });
    },
    async signIntent() {
      throw new Error("Intent not supported for Movement");
    }
  }
});

const res = await fetchWithPayment("/api/premium-image-movement");

```

### **Option B: Movement TypeScript SDK (demo, no wallet)**

```bash
npm i @aptos-labs/ts-sdk

```

```tsx
import { withX402Fetch, createMovementSigner } from "x402plus";
import { Aptos, AptosConfig, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const signer = createMovementSigner(async (accepts) => {
  const config = new AptosConfig({ fullnode: "https://your-movement-fullnode" });
  const aptos = new Aptos(config);
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(process.env.MOVEMENT_PRIVATE_KEY!)
  });

  // Build standard transfer on Movement
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [accepts.payTo, accepts.maxAmountRequired]
    }
  });

  const authenticator = aptos.transaction.sign({ signer: account, transaction: tx });
  return {
    signatureBcsBase64: Buffer.from(authenticator.bcsToBytes()).toString("base64"),
    transactionBcsBase64: Buffer.from(tx.bcsToBytes()).toString("base64")
  };
});

const fetchWithPayment = withX402Fetch(fetch, { signer, prefer: "exact" });
const res = await fetchWithPayment("/api/premium-image-movement");

```

---

## **5) X-PAYMENT format for Movement**

`X-PAYMENT` header is base64 of this JSON:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "movement",
  "payload": {
    "signature": "<base64-bcs-authenticator>",
    "transaction": "<base64-bcs-raw-transaction>"
  }
}

```

The facilitator decodes, verifies correctness (recipient, amount, validity), and settles.

---

## **6) Explorer links**

Your facilitator response (in `X-PAYMENT-RESPONSE`) typically includes a `txHash` or `transaction` hash. Use your Movement explorer base URL to deep-link for users.

---

## **7) Debugging**

- Set `DEBUG_X402=true` on your server to log facilitator requests (verify/settle) and payloads.
- Check that `network` matches across server route, client, and facilitator.
- Ensure `payTo` is a 32-byte address (64 hex chars, 0x-prefixed). If short, left-pad to 64 hex chars.
- If you see “Invalid scheme or payload”, confirm the facilitator is Movement-aware and not an EVM-only facilitator.

Common errors:

- Address too short → normalize to 32 bytes.
- Wrong asset/coin type → ensure Move coin type matches what the facilitator supports (e.g., `0x1::aptos_coin::AptosCoin` for MOVE; use the proper USDC type for Movement).
- Wrong network label → facilitator will reject if unknown.

---

## **8) Security notes**

- Prefer wallet-based signing in production (no raw private keys in the browser).
- Use HTTPS for all endpoints.
- Consider rate limiting and idempotency on facilitator endpoints.

---

## **9) Quick demo checklist**

1. Backend
    - Set env:
        - `MOVEMENT_FACILITATOR_URL=https://facilitator.stableyard.fi`
        - `MOVEMENT_NETWORK=movement` (or your label)
        - `MOVEMENT_ASSET=0x1::aptos_coin::AptosCoin` (or Movement USDC type)
        - `MOVEMENT_PAY_TO=0x<receiver_address>`
    - Start the server; confirm `/api/premium-image-movement` returns 402 without `X-PAYMENT`.
2. Client
    - Use Option A (wallet) or Option B (TS SDK) to sign.
    - Call the endpoint via `withX402Fetch`, confirm payment and that content is unlocked.
3. Verify
    - Inspect `X-PAYMENT-RESPONSE` and view the transaction on a Movement explorer.

---

## **10) Resources**

- https://www.npmjs.com/package/x402plus