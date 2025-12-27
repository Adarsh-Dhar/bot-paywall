import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from '@/lib/auth';
import { getRefreshToken } from '@/lib/server-token-storage';

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const validatedData = refreshSchema.parse(body);

    const refreshToken =
        validatedData.refreshToken || (await getRefreshToken());

    if (!refreshToken) {
      return NextResponse.json(
          { error: 'Refresh token is required' },
          { status: 401 }
      );
    }

    const refreshTokenHash = await hashRefreshToken(refreshToken);

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
          { error: 'Invalid refresh token' },
          { status: 401 }
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      return NextResponse.json(
          { error: 'Refresh token has expired' },
          { status: 401 }
      );
    }

    const isValid = await verifyRefreshToken(refreshToken, tokenRecord.tokenHash);
    if (!isValid) {
      return NextResponse.json(
          { error: 'Invalid refresh token' },
          { status: 401 }
      );
    }

    const accessToken = generateAccessToken(
        tokenRecord.user.userId,
        tokenRecord.user.email
    );

    const rotateRefreshToken = true;
    let newRefreshToken = refreshToken;

    if (rotateRefreshToken) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: tokenRecord.user.userId,
          expiresAt,
        },
      });
    }

    const response = NextResponse.json({
      accessToken,
      refreshToken: newRefreshToken,
    });

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
          { error: 'Validation error', details: error.issues },
          { status: 400 }
      );
    }

    console.error('Refresh token error:', error);
    return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
    );
  }
}
