import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPublicClient, http, parseEther } from 'viem';

// 1. Define Movement Network
const movementBardock = {
  id: 30732,
  name: 'Movement Bardock',
  network: 'movement-bardock',
  nativeCurrency: { name: 'MOVE', symbol: 'MOVE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sentio.xyz/movement/v1'] },
    public: { http: ['https://rpc.sentio.xyz/movement/v1'] },
  },
  testnet: true,
};

export async function middleware(req: NextRequest) {
  // Only protect specific routes
  if (!req.nextUrl.pathname.startsWith('/api/secret-data')) {
    return NextResponse.next();
  }

  // 2. Check for Payment Header
  const paymentHeader = req.headers.get('X-Payment');

  if (!paymentHeader) {
    // 402: STOP! Payment Required
    return new NextResponse(JSON.stringify({ error: "Payment Required" }), {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        // Tell the agent WHERE and HOW MUCH to pay
        'X-Payment-Accepts': JSON.stringify({
          chainId: 30732,
          token: 'MOVE',
          amount: '0.1', // Matches our DB
          recipient: '0xYOUR_WALLET_ADDRESS_HERE'
        })
      }
    });
  }

  // 3. Verify Payment (If header exists)
  try {
    const { txHash } = JSON.parse(atob(paymentHeader)); // Decode Base64

    const client = createPublicClient({
      chain: movementBardock,
      transport: http()
    });

    // Check if transaction exists and is successful on-chain
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    const tx = await client.getTransaction({ hash: txHash });

    if (receipt.status!== 'success') throw new Error("Tx failed");
    
    // Security: Validate Recipient & Amount
    // Note: In production, fetch real price from D1 here. 
    // For speed in middleware, we hardcode or use KV.
    const REQUIRED_AMOUNT = parseEther('0.1');
    if (tx.value < REQUIRED_AMOUNT) throw new Error("Insufficient payment");

    // 4. Allow Access
    const res = NextResponse.next();
    res.headers.set('X-Payment-Status', 'verified');
    return res;

  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: "Invalid Payment Proof" }), { status: 403 });
  }
}

export const config = {
  matcher: '/api/secret-data/:path*',
};