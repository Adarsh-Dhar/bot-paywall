import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRefreshToken, clearTokens } from '@/lib/server-token-storage';
import { hashRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = await getRefreshToken();

    if (refreshToken) {
      // Hash the token to look it up
      const refreshTokenHash = await hashRefreshToken(refreshToken);

      // Revoke the refresh token
      await prisma.refreshToken.updateMany({
        where: {
          tokenHash: refreshTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    // Clear tokens from cookies
    await clearTokens();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    
    // Still clear tokens even if there's an error
    await clearTokens();

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

