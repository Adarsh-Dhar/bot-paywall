import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    success: true,
    secret_data:
      'The Movement Network offers the highest throughput of any L2.',
    timestamp: new Date().toISOString(),
    alpha: 'Buy MOVE.',
  });
}

