import { NextResponse } from 'next/server';

export const runtime = 'edge'; // Important for Cloudflare

export async function GET() {
  // The user paid! Give them the data.
  const premiumData = {
    secret: "The Movement Network is fast.",
    alpha: "Buy high, sell low.",
    timestamp: Date.now()
  };

  return NextResponse.json(premiumData);
}