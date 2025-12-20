import { NextRequest, NextResponse } from 'next/server';
import { getBotPaymentSystem } from '@/lib/automated-bot-payment-system';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, clientIP, duration = 60 } = body;

    // Validate required fields
    if (!transactionId || !clientIP) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: transactionId and clientIP' 
        },
        { status: 400 }
      );
    }

    // Get the bot payment system instance
    const botPaymentSystem = getBotPaymentSystem();
    if (!botPaymentSystem) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bot payment system not initialized' 
        },
        { status: 503 }
      );
    }

    // Trigger IP whitelisting through the bot payment system
    // This will create a Cloudflare whitelist rule and schedule cleanup
    const result = await botPaymentSystem.processPayment(transactionId, clientIP);

    if (result.success) {
      return NextResponse.json({
        success: true,
        transactionId,
        clientIP,
        duration,
        whitelistRuleId: result.whitelistRuleId,
        expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'IP whitelisting failed' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('X402 IP whitelisting error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during IP whitelisting' 
      },
      { status: 500 }
    );
  }
}