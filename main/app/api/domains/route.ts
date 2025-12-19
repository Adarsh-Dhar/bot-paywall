import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Domain management has been simplified. Please use the Cloudflare connection flow.' },
    { status: 400 }
  );
}
