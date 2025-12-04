import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';

// --- CONFIGURATION ---
const MOVEMENT_CHAIN = {
  id: 30732,
  name: 'Movement Bardock',
  network: 'movement-bardock',
  nativeCurrency: { name: 'MOVE', symbol: 'MOVE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mevm.testnet.imola.movementlabs.xyz'] },
  },
  testnet: true,
};

const MERCHANT_WALLET =
  process.env.NEXT_PUBLIC_MERCHANT_WALLET ?? '0xYOUR_WALLET_ADDRESS_HERE';
const PRICE_PER_REQUEST = '0.1'; // MOVE price per API call

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (!url.pathname.startsWith('/api/premium')) {
    return NextResponse.next();
  }

  // --- STEP 1: BOT DETECTION ---
  const userAgent = req.headers.get('user-agent') ?? '';
  const isBot = /bot|crawler|spider|gpt|claude|python|curl/i.test(userAgent);

  if (!isBot) {
    // return NextResponse.next(); // Uncomment to allow humans for free
  }

  // --- STEP 2: CHECK FOR PAYMENT ---
  const paymentHeader = req.headers.get('X-Payment');

  if (!paymentHeader) {
    return new NextResponse(
      JSON.stringify({
        error: 'Payment Required. This data is for paying agents only.',
      }),
      {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Accepts': JSON.stringify({
            chain: 'Movement Bardock',
            chainId: MOVEMENT_CHAIN.id,
            token: 'MOVE',
            amount: PRICE_PER_REQUEST,
            recipient: MERCHANT_WALLET,
          }),
        },
      },
    );
  }

  // --- STEP 3: VERIFY PAYMENT ---
  try {
    const decoded = JSON.parse(atob(paymentHeader));
    const txHash = decoded?.txHash;

    if (!txHash) throw new Error('Missing txHash');

    const client = createPublicClient({
      chain: MOVEMENT_CHAIN,
      transport: http(),
    });

    const tx = await client.getTransaction({ hash: txHash });
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') throw new Error('Transaction failed');
    if (tx.to?.toLowerCase() !== MERCHANT_WALLET.toLowerCase()) {
      throw new Error('Wrong recipient');
    }

    const paidAmount = parseFloat(formatEther(tx.value));
    if (paidAmount < parseFloat(PRICE_PER_REQUEST)) {
      throw new Error('Insufficient payment');
    }

    // TODO: Add D1 replay-protection call. For demo we assume uniqueness.

    const response = NextResponse.next();
    response.headers.set('X-Access-Granted', 'true');
    return response;
  } catch (error) {
    console.error(error);
    return new NextResponse(
      JSON.stringify({ error: 'Invalid Payment Proof' }),
      { status: 403 },
    );
  }
}

export const config = {
  matcher: '/api/premium/:path*',
};