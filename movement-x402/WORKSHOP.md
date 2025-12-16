# x402 Workshop: Pay-Per-Request APIs on Movement

## Workshop Overview

**What we're building:** A paywall API that charges 1 MOVE to unlock premium content.

**Time:** ~45 minutes

**Format:** Code-along with explanations

---

## PART 1: Understanding x402

### [EXPLAIN] What is x402?

> "HTTP has always had a 402 'Payment Required' status code - it's been reserved since 1999. But nobody standardized how it should work. x402 finally defines the protocol."

> "The idea is simple: instead of paywalls requiring accounts and subscriptions, you just... pay. Per request. With crypto."

### [DIAGRAM] Draw on whiteboard:

```
Client                    Server                   Facilitator
  │                         │                          │
  │─── GET /content ───────>│                          │
  │                         │                          │
  │<── 402 + requirements ──│                          │
  │                         │                          │
  │ [user signs tx in wallet]                          │
  │                         │                          │
  │─── GET /content ───────>│                          │
  │    X-PAYMENT: <signed>  │                          │
  │                         │── verify + submit tx ───>│
  │                         │<── tx confirmed ─────────│
  │<── 200 + content ───────│                          │
```

### [EXPLAIN] Key insight

> "Notice: the user signs a transaction but DOESN'T submit it. The facilitator submits it. This means the server only releases content AFTER payment is confirmed on-chain. Atomic exchange."

---

## PART 2: Server Walkthrough

### [EXPLAIN] What we built

> "I've already set up the server. Let's walk through the code so you understand what's happening."

### Open `server/src/index.ts`

```typescript
import express from "express";
import cors from "cors";
import { x402Paywall } from "x402plus";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 4402;
```

> "Standard Express setup. The key import is `x402Paywall` from x402plus - this middleware handles the entire 402 flow."

---

```typescript
app.use(cors({
  origin: "http://localhost:3000",
  exposedHeaders: ["X-PAYMENT-RESPONSE"]
}));
```

### [EXPLAIN] Why exposedHeaders?

> "When payment succeeds, the facilitator returns confirmation in the X-PAYMENT-RESPONSE header. Browsers block custom headers by default - we need to explicitly expose it for our frontend to read."

---

```typescript
app.use(
  x402Paywall(
    process.env.MOVEMENT_PAY_TO as string,
    {
      "GET /api/premium-content": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "100000000",
        description: "Premium workshop content",
        mimeType: "application/json",
        maxTimeoutSeconds: 600
      }
    },
    {
      url: "https://facilitator.stableyard.fi"
    }
  )
);
```

### [EXPLAIN] The x402Paywall middleware

> "This is where the magic happens. Three arguments:"

> "**First argument: Pay-to address**"
> "Where does the money go? Your wallet address, loaded from .env"

> "**Second argument: Route configuration**"
> "A map of which endpoints require payment and how much."
> "- `network: 'movement'` - Movement mainnet"
> "- `asset: '0x1::aptos_coin::AptosCoin'` - native MOVE token"
> "- `maxAmountRequired: '100000000'` - 1 MOVE. Why 100 million? MOVE has 8 decimals, like satoshis to bitcoin."

> "**Third argument: Facilitator config**"
> "The facilitator is a service that verifies signatures and submits transactions. We're using Stableyard's public facilitator."

---

```typescript
app.get("/api/premium-content", (_req, res) => {
  res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
```

### [EXPLAIN] How the middleware intercepts requests

> "Here's the key insight: this handler only runs AFTER payment is confirmed."

> "When a request comes in, x402Paywall intercepts it. If there's no X-PAYMENT header, it returns 402 with payment requirements. Your handler never executes."

> "If there IS an X-PAYMENT header, the middleware forwards it to the facilitator, which verifies the signature and submits the transaction. Only after on-chain confirmation does your handler run."

> "So this redirect? It only happens after the user has paid."

---

### [DEMO] Test the 402 response

```bash
curl -i http://localhost:4402/api/premium-content
```

> "Let's see what the client receives. You get HTTP 402 and a JSON body with `accepts` - an array of payment options the server accepts."

---

## PART 3: Frontend Payment Hook

### [EXPLAIN] The challenge

> "Now the interesting part - the frontend. We need to:"
> "1. Build a transfer transaction"
> "2. Get user to sign it (but NOT submit)"
> "3. Serialize it in the exact format x402 expects"
> "4. Send it in the X-PAYMENT header"

> "I've wrapped all of this in a React hook. Let's walk through it."

### Open `hooks/use-x402-payment.ts`

```typescript
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
} from "@aptos-labs/ts-sdk";
import { buildAptosLikePaymentHeader } from "x402plus";

const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";
```

### [EXPLAIN] Why Aptos SDK?

> "Movement is Aptos-compatible - same Move VM, same transaction format. So we use the Aptos SDK."

> "From the wallet adapter we get `signTransaction`. From x402plus we get `buildAptosLikePaymentHeader` to format our payment."

---

```typescript
const toBytes = (obj: Record<string, number>) =>
  new Uint8Array(Object.keys(obj).map(Number).sort((a, b) => a - b).map(k => obj[k]));
```

### [EXPLAIN] Byte conversion utility

> "Quick utility function. The wallet adapter returns byte arrays as plain objects like `{0: 123, 1: 45}` instead of proper Uint8Array. This converts them."

---

```typescript
export function useX402Payment() {
  const { account, signTransaction } = useWallet();

  const payForAccess = async (paymentRequirements: any): Promise<string> => {
    if (!account) throw new Error("Wallet not connected");
```

### [EXPLAIN] Hook structure

> "Our hook exposes one function: `payForAccess`. Give it the payment requirements from the 402 response, it returns the X-PAYMENT header string."

---

```typescript
    const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: MOVEMENT_RPC }));
    const tx = await aptos.transaction.build.simple({
      sender: account.address,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [paymentRequirements.payTo, paymentRequirements.maxAmountRequired],
      },
    });
```

### [EXPLAIN] Building the transaction

> "We build a simple transfer transaction using the Aptos SDK."

> "The payment requirements from the 402 response tell us everything we need:"
> "- `payTo` - the recipient address (server's wallet)"
> "- `maxAmountRequired` - how much to transfer"

> "This builds the transaction but doesn't sign or submit it yet."

---

```typescript
    const signed = await signTransaction({ transactionOrPayload: tx });
```

### [EXPLAIN] Sign, don't submit

> "This is critical: we use `signTransaction`, NOT `signAndSubmitTransaction`."

> "We only want the signature. The facilitator will submit the transaction after verifying it. This is what makes x402 atomic - you don't pay until the server confirms it can deliver."

---

```typescript
    const pubKeyBytes = toBytes(signed.authenticator.public_key.key.data);
    const sigBytes = toBytes(signed.authenticator.signature.data.data);
    const authenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(pubKeyBytes),
      new Ed25519Signature(sigBytes)
    );
```

### [EXPLAIN] BCS serialization

> "Here's the technical bit. The wallet returns the signature in a nested object. We need to repackage it."

> "BCS - Binary Canonical Serialization - is how Move/Aptos serializes data. The facilitator expects this exact format."

> "We extract:"
> "- 32-byte Ed25519 public key"
> "- 64-byte Ed25519 signature"

> "Then wrap them in SDK classes that know how to serialize to BCS properly."

---

```typescript
    return buildAptosLikePaymentHeader(paymentRequirements, {
      signatureBcsBase64: Buffer.from(authenticator.bcsToBytes()).toString("base64"),
      transactionBcsBase64: Buffer.from(tx.bcsToBytes()).toString("base64"),
    });
  };

  return { payForAccess, isConnected: !!account };
}
```

### [EXPLAIN] Building the X-PAYMENT header

> "Finally, `buildAptosLikePaymentHeader` from x402plus takes:"
> "- The original payment requirements"
> "- The BCS-serialized authenticator (signature + public key)"
> "- The BCS-serialized transaction"

> "It wraps everything in the JSON structure x402 expects and base64 encodes it. That string goes in the X-PAYMENT header."

---

## PART 4: UI Component

### [EXPLAIN] Putting it together

> "Now let's see how we use the hook in a React component. This is where the user interaction happens."

### Open `components/premium-content.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useX402Payment } from "@/hooks/use-x402-payment";
import { toast } from "sonner";

const SERVER_URL = "http://localhost:4402";

export function PremiumContent() {
  const { payForAccess, isConnected } = useX402Payment();
  const [isLoading, setIsLoading] = useState(false);
```

### [EXPLAIN] Component setup

> "Standard React component. We pull in our `useX402Payment` hook which gives us `payForAccess` and connection status."

---

```typescript
  const handleUnlock = async () => {
    if (!isConnected) return toast.error("Connect wallet first");

    setIsLoading(true);
    const loadingToast = toast.loading("Checking payment...");

    try {
      // Step 1: Make initial request
      const res = await fetch(`${SERVER_URL}/api/premium-content`);
      if (res.status !== 402) {
        toast.success("Content unlocked!", { id: loadingToast });
        return window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
      }
```

### [EXPLAIN] Step 1: Initial request

> "First we try the request normally. If we DON'T get 402, content is already accessible - maybe it's free, maybe we already paid."

---

```typescript
      const { accepts } = await res.json();
      if (!accepts?.[0]) throw new Error("No payment requirements");

      // Step 2: Sign payment
      toast.loading("Sign in wallet...", { id: loadingToast });
      const xPayment = await payForAccess(accepts[0]);
```

### [EXPLAIN] Step 2: Parse and sign

> "We got a 402. The response body contains `accepts` - an array of payment options the server accepts."

> "We take the first option and pass it to our hook. This opens the wallet, user approves, and we get back the X-PAYMENT header string."

---

```typescript
      // Step 3: Submit with payment header
      toast.loading("Processing...", { id: loadingToast });
      const paidRes = await fetch(`${SERVER_URL}/api/premium-content`, {
        headers: { "X-PAYMENT": xPayment },
        redirect: "manual"
      });

      if (paidRes.status === 302 || paidRes.ok || paidRes.type === "opaqueredirect") {
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
        toast.success("Payment successful!", { id: loadingToast });
      } else {
        throw new Error("Payment failed");
      }
```

### [EXPLAIN] Step 3: Retry with payment

> "Now we retry the same request, but with the X-PAYMENT header containing our signed transaction."

> "The server forwards this to the facilitator. Facilitator verifies the signature, submits the transaction to Movement, waits for confirmation, then tells the server 'payment received'."

> "Server releases the content - in our case, a redirect."

> "Note: `redirect: 'manual'` is a browser quirk. Without it, CORS blocks cross-origin redirects. We handle the redirect ourselves."

---

```typescript
    } catch (err: any) {
      toast.error(err.message || "Payment failed", { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>x402 Premium Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Pay 1 MOVE to unlock exclusive content via x402 protocol.
        </p>
        <Button onClick={handleUnlock} disabled={isLoading || !isConnected} className="w-full">
          {isLoading ? "Processing..." : "Unlock (1 MOVE)"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### [EXPLAIN] The UI

> "Simple card with a button. Disabled if wallet not connected or payment in progress. That's it - all the complexity is in the hook."

---

## PART 5: Live Demo

### [DEMO] Run the full flow

> "Let's see it in action."

**Terminal 1 - Server:**
```bash
cd server && npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd workshop-code && npm run dev
```

**In browser:**
1. Open http://localhost:3000
2. Connect wallet (Movement mainnet)
3. Click "Unlock (1 MOVE)"
4. Approve in wallet
5. Wait for confirmation
6. Content unlocks

### [EXPLAIN] What just happened

> "Let's recap what happened under the hood:"

> "1. You clicked unlock - frontend made a GET request"
> "2. Server returned 402 with payment requirements"
> "3. Frontend built a transfer transaction and asked you to sign"
> "4. You signed (but didn't submit)"
> "5. Frontend sent the signed tx in X-PAYMENT header"
> "6. Server forwarded to facilitator"
> "7. Facilitator verified signature, submitted to Movement"
> "8. Transaction confirmed on-chain"
> "9. Facilitator told server 'paid'"
> "10. Server released the content"

> "All of that happened in a few seconds. You just paid for API access with crypto. No account. No subscription. No credit card. Just... payment."

---

## Wrap-up

### [EXPLAIN] Key takeaways

> "Three things to remember:"

> "**1. HTTP 402 finally works.** It's been reserved since 1999. x402 defines how to use it."

> "**2. Sign, don't submit.** Users sign transactions, facilitators submit them. This creates atomic exchange - you don't pay unless you get the content."

> "**3. It's just HTTP.** One header. Works with any client. The blockchain part is abstracted away."

### [EXPLAIN] Where this goes

> "Think about what you can build:"
> "- Pay-per-article news sites"
> "- API monetization without API keys"
> "- Micropayments for AI inference"
> "- Paywalled file downloads"
> "- Premium features without subscriptions"

> "The web finally has native payments."

---

## Q&A

> "Questions?"

---

## Resources

- [x402plus npm package](https://www.npmjs.com/package/x402plus)
- [Movement Docs](https://docs.movementnetwork.xyz)
- [Aptos TypeScript SDK](https://aptos.dev/sdks/ts-sdk)
- [x402 Protocol](https://www.x402.org)
