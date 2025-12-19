import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { botCleanupService } from '@/lib/bot-cleanup';
import { z } from 'zod';

// Simple IP validation regex
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// Schema for validating IP addresses
const ipAddressSchema = z.object({
  ipAddress: z.string().regex(ipRegex, 'Invalid IP address format'),
  reason: z.string().optional(),
});

const deleteSchema = z.object({
  ipAddress: z.string().regex(ipRegex, 'Invalid IP address format'),
});

// GET - List all allowed bot IPs
export async function GET() {
  try {
    // Ensure cleanup service is running
    botCleanupService.start();
    
    const allowedBots = await prisma.botsAllowed.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Add expiry information to each bot
    const botsWithExpiry = allowedBots.map(bot => ({
      ...bot,
      timeRemaining: botCleanupService.getTimeRemaining(bot.createdAt),
      isExpired: botCleanupService.isExpired(bot.createdAt),
    }));

    return NextResponse.json({
      success: true,
      data: botsWithExpiry,
    });
  } catch (error) {
    console.error('Error fetching allowed bots:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch allowed bots' },
      { status: 500 }
    );
  }
}

// POST - Add a new allowed bot IP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ipAddressSchema.parse(body);

    // Ensure cleanup service is running
    botCleanupService.start();

    const existingBot = await prisma.botsAllowed.findUnique({
      where: { ipAddress: validatedData.ipAddress },
    });

    if (existingBot) {
      return NextResponse.json(
        { success: false, error: 'IP address already exists in allowed list' },
        { status: 409 }
      );
    }

    const newBot = await prisma.botsAllowed.create({
      data: {
        ipAddress: validatedData.ipAddress,
        reason: validatedData.reason,
      },
    });

    const timeRemaining = botCleanupService.getTimeRemaining(newBot.createdAt);

    return NextResponse.json({
      success: true,
      data: {
        ...newBot,
        timeRemaining,
        isExpired: false,
      },
      message: 'Bot IP added to allowed list successfully (will auto-expire in 1 minute)',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error adding allowed bot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add bot to allowed list' },
      { status: 500 }
    );
  }
}

// DELETE - Remove an allowed bot IP
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = deleteSchema.parse(body);

    const existingBot = await prisma.botsAllowed.findUnique({
      where: { ipAddress: validatedData.ipAddress },
    });

    if (!existingBot) {
      return NextResponse.json(
        { success: false, error: 'IP address not found in allowed list' },
        { status: 404 }
      );
    }

    await prisma.botsAllowed.delete({
      where: { ipAddress: validatedData.ipAddress },
    });

    return NextResponse.json({
      success: true,
      message: 'Bot IP removed from allowed list successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error removing allowed bot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove bot from allowed list' },
      { status: 500 }
    );
  }
}