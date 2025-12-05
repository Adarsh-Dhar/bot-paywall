// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyPayment } from './lib/movement'
import { kv } from '@vercel/kv'

export async function middleware(req: NextRequest) {
  // 1. Check if the user is trying to use the "Backdoor"
  const paymentHash = req.headers.get('X-Payment-Hash')

  // If no payment proof is provided, allow normal users but Challenge Bots
  if (!paymentHash) {
    // Logic: If it looks like a bot (User-Agent check), force them to pay
    const userAgent = req.headers.get('user-agent') || ''
    const isBot = userAgent.includes('Python') || userAgent.includes('Scraper') || userAgent.includes('Bot')

    if (isBot) {
      return NextResponse.json(
        { 
          error: "Payment Required", 
          message: "Bots must pay 0.01 MOVE to access this resource.",
          receiver: process.env.MOVEMENT_WALLET_ADDRESS || "",
          price: "10000000000000000", // 0.01 MOVE in Wei
          currency: "MOVE"
        },
        { status: 402 } // HTTP 402 Payment Required
      )
    }
    
    // Normal humans pass through (Next.js logic)
    return NextResponse.next()
  }

  // 2. Payment Proof Provided - Verify it
  
  try {
    // A. Check Cache (Replay Attack Protection)
    // We check if this TxHash was already used to buy access
    const isUsed = await kv.get(`tx:${paymentHash}`)
    if (isUsed) {
      return NextResponse.json({ error: "Payment Proof already used." }, { status: 403 })
    }

    // B. Verify on Blockchain
    const verification = await verifyPayment(paymentHash)
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason }, { status: 403 })
    }

    // C. Mark as Used (Expire in 24 hours or keep forever depending on your model)
    // If you want "Per Request" payment, keep it forever.
    await kv.set(`tx:${paymentHash}`, 'used')
  } catch (error) {
    console.error("KV Error:", error)
    return NextResponse.json({ error: "Payment verification service unavailable." }, { status: 503 })
  }

  // 3. Grant Access
  // We add a header so your app knows this is a "Premium Bot"
  const response = NextResponse.next()
  response.headers.set('X-Bot-Tier', 'Premium')
  return response
}

export const config = {
  matcher: [
    // Apply to all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

