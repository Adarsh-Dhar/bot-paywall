import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRefreshToken, clearTokens } from '@/lib/server-token-storage';
import { hashRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = await getRefreshToken();

    if (refreshToken) {
      const refreshTokenHash = await hashRefreshToken(refreshToken);

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

    await clearTokens();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);

    await clearTokens();

    return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
    );
  }
}
