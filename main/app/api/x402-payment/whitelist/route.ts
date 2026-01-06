import { NextRequest, NextResponse } from 'next/server';
import { getBotPaymentSystem, startBotPaymentSystem } from '@/lib/automated-bot-payment-system';
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
        webscrapperPath: process.cwd().replace('/main', '') + '/webscrapper'
      });
    }

    // Authenticate user
    const authResult = await auth();
    if (!authResult) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not authenticated' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionId, clientIP, projectId, duration = 60 } = body;

    // Validate required fields
    if (!transactionId || !clientIP || !projectId) {
      return NextResponse.json(
        { 
          success: false, 
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
          success: false, 
          error: 'Project not found or unauthorized' 
        },
        { status: 404 }
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
    const result = await botPaymentSystem.processPayment(transactionId, projectId, clientIP);

    if (result.success) {
      return NextResponse.json({
        success: true,
        transactionId,
        clientIP,
        projectId,
        duration,
        whitelistRuleId: result.ruleId,
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
        error: error instanceof Error ? error.message : 'Internal server error during IP whitelisting' 
      },
      { status: 500 }
    );
  }
}