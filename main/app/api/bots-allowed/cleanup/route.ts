import { NextResponse } from 'next/server';
import { botCleanupService } from '@/lib/bot-cleanup';

// POST - Manually trigger cleanup of expired bot IPs
export async function POST() {
  try {
    const cleanedCount = await botCleanupService.triggerCleanup();
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired bot IP(s)`,
      cleanedCount,
    });
  } catch (error) {
    console.error('Error during manual cleanup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup expired bots' },
      { status: 500 }
    );
  }
}

// GET - Get cleanup service status
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      status: 'Cleanup service is running',
      checkInterval: '10 seconds',
      expiryTime: '1 minute',
    });
  } catch (error) {
    console.error('Error getting cleanup status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get cleanup status' },
      { status: 500 }
    );
  }
}