import { NextRequest, NextResponse } from 'next/server';
import { processManualPayment, getBotPaymentSystem, startBotPaymentSystem } from '@/lib/automated-bot-payment-system';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Ensure bot payment system is initialized (without Cloudflare credentials)
    if (!getBotPaymentSystem()) {
      await startBotPaymentSystem({
        enableConsoleLogging: true,
        enableFileLogging: false,
        cleanupDelayMs: 60000, // 60 seconds
        monitoringCheckInterval: 5000, // 5 seconds
        // Use env/explicit configuration only; no hardcoded IP
        configuredClientIP: process.env.CONFIGURED_CLIENT_IP,
        webscrapperPath: process.cwd().replace('/main', '') + '/webscrapper' // Fix the path
      });
    }

    // Authenticate user
    const authResult = await auth();
    if (!authResult) {
      return NextResponse.json(
        { 
          verified: false, 
          error: 'User not authenticated' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionId, clientIP, projectId, expectedAmount, expectedCurrency } = body;

    // Validate required fields
    if (!transactionId || !clientIP || !projectId) {
      return NextResponse.json(
        { 
          verified: false, 
          error: 'Missing required fields: transactionId, clientIP, and projectId are required' 
        },
        { status: 400 }
      );
    }

    // Validate project exists and belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: authResult.userId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { 
          verified: false, 
          error: 'Project not found or unauthorized' 
        },
        { status: 404 }
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
    const result = await processManualPayment(transactionId, projectId, clientIP);

    if (result.success) {
      return NextResponse.json({
        verified: true,
        transactionId,
        clientIP,
        projectId,
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
        error: error instanceof Error ? error.message : 'Internal server error during payment verification' 
      },
      { status: 500 }
    );
  }
}