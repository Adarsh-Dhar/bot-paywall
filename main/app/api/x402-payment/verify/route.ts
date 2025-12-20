import { NextRequest, NextResponse } from 'next/server';
import { processManualPayment, getBotPaymentSystem, startBotPaymentSystem } from '@/lib/automated-bot-payment-system';

export async function POST(request: NextRequest) {
  try {
    // Ensure bot payment system is initialized
    if (!getBotPaymentSystem()) {
      console.log('Bot payment system not initialized, starting it now...');
      await startBotPaymentSystem({
        enableConsoleLogging: true,
        enableFileLogging: false,
        cleanupDelayMs: 60000, // 60 seconds
        monitoringCheckInterval: 5000, // 5 seconds
        configuredClientIP: '210.212.2.133', // Use the specific client IP
        webscrapperPath: process.cwd().replace('/main', '') + '/webscrapper' // Fix the path
      });
      console.log('Bot payment system initialized successfully');
    }

    const body = await request.json();
    const { transactionId, clientIP, expectedAmount, expectedCurrency } = body;

    // Validate required fields
    if (!transactionId || !clientIP) {
      return NextResponse.json(
        { 
          verified: false, 
          error: 'Missing required fields: transactionId and clientIP' 
        },
        { status: 400 }
      );
    }

    // Validate expected payment parameters
    if (expectedAmount !== 0.01 || expectedCurrency !== 'MOVE') {
      return NextResponse.json(
        { 
          verified: false, 
          error: 'Invalid payment parameters. Expected 0.01 MOVE tokens.' 
        },
        { status: 400 }
      );
    }

    // Process the payment through the bot payment system
    const result = await processManualPayment(transactionId, clientIP);

    if (result.success) {
      return NextResponse.json({
        verified: true,
        transactionId,
        clientIP,
        amount: expectedAmount,
        currency: expectedCurrency,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          verified: false, 
          error: result.error || 'Payment verification failed' 
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('X402 payment verification error:', error);
    return NextResponse.json(
      { 
        verified: false, 
        error: 'Internal server error during payment verification' 
      },
      { status: 500 }
    );
  }
}