import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 4402;

console.log("Environment PORT:", process.env.PORT);
console.log("Using PORT:", PORT);

app.use(cors({
  origin: "http://localhost:3000",
  exposedHeaders: ["X-PAYMENT-RESPONSE"]
}));

app.use(express.json());

// Store verified payments with IP addresses (in production, use a database)
const verifiedPayments = new Map<string, string>(); // transactionHash -> IP address
const whitelistedIPs = new Set<string>(); // IPs that have made verified payments

// Helper function to get client IP
function getClientIP(req: any): string {
  // Check for X-Forwarded-For header first (for testing different IPs)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
}

app.get("/api/premium-content", (req, res) => {
  const clientIP = getClientIP(req);
  const paymentProof = req.headers['x-payment-proof'] as string;
  
  console.log(`Request received for premium content from IP: ${clientIP}`);
  console.log("Payment proof header:", paymentProof);
  
  // First check if IP is already whitelisted (has made a previous verified payment)
  if (whitelistedIPs.has(clientIP)) {
    console.log(`✅ IP ${clientIP} is whitelisted, granting access`);
    return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  }
  
  // If not whitelisted, check for payment proof
  if (paymentProof) {
    try {
      const proof = JSON.parse(paymentProof);
      console.log("Parsed payment proof:", proof);
      
      // Check if this transaction hash has been verified before
      if (verifiedPayments.has(proof.transactionHash)) {
        const previousIP = verifiedPayments.get(proof.transactionHash);
        if (previousIP === clientIP) {
          console.log(`✅ Payment already verified for IP ${clientIP}, granting access`);
          whitelistedIPs.add(clientIP);
          return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        } else {
          console.log(`❌ Transaction ${proof.transactionHash} was used by different IP: ${previousIP}`);
          return res.status(403).json({
            error: "Forbidden",
            message: "This payment has already been used by another IP address"
          });
        }
      }
      
      // Verify new payment (in production, verify on blockchain)
      if (proof.transactionHash && proof.transactionHash.startsWith('0x') && proof.transactionHash.length === 66) {
        console.log(`✅ Payment proof accepted for IP ${clientIP}, granting access`);
        verifiedPayments.set(proof.transactionHash, clientIP);
        whitelistedIPs.add(clientIP);
        return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      } else {
        console.log("❌ Invalid transaction hash format");
        return res.status(400).json({
          error: "Bad Request",
          message: "Invalid transaction hash format"
        });
      }
    } catch (e) {
      console.log("❌ Invalid payment proof format:", e);
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid payment proof format"
      });
    }
  }
  
  // No payment proof provided - return 402 Payment Required (not 403)
  console.log(`💳 Payment required for IP ${clientIP} - no payment proof provided`);
  res.status(402).json({
    x402Version: 1,
    accepts: [{
      scheme: "exact",
      network: "movement",
      maxAmountRequired: "100000000", // 1 MOVE
      resource: `http://localhost:${PORT}/api/premium-content`,
      description: "Premium workshop content",
      mimeType: "application/json",
      payTo: process.env.MOVEMENT_PAY_TO as string,
      maxTimeoutSeconds: 600,
      asset: "0x1::aptos_coin::AptosCoin"
    }]
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/debug/whitelist", (req, res) => {
  const clientIP = getClientIP(req);
  res.json({
    clientIP: clientIP,
    isWhitelisted: whitelistedIPs.has(clientIP),
    totalWhitelistedIPs: whitelistedIPs.size,
    totalVerifiedPayments: verifiedPayments.size,
    whitelistedIPs: Array.from(whitelistedIPs),
    verifiedPayments: Object.fromEntries(verifiedPayments)
  });
});

app.post("/debug/clear-whitelist", (req, res) => {
  whitelistedIPs.clear();
  verifiedPayments.clear();
  console.log("🧹 Whitelist and verified payments cleared");
  res.json({ 
    message: "Whitelist cleared successfully",
    whitelistedIPs: Array.from(whitelistedIPs),
    verifiedPayments: Object.fromEntries(verifiedPayments)
  });
});

app.listen(PORT, () => {
  console.log(`Simple x402 server running at http://localhost:${PORT}`);
  console.log(`Pay-to address: ${process.env.MOVEMENT_PAY_TO}`);
});