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
  refreshToken: z.string().optional(), // Optional - can also get from cookie
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const validatedData = refreshSchema.parse(body);

    // Get refresh token from body or cookie
    const refreshToken =
      validatedData.refreshToken || (await getRefreshToken());

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 401 }
      );
    }

    // Hash the token to look it up
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Find the refresh token in database
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

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      // Mark as revoked
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      return NextResponse.json(
        { error: 'Refresh token has expired' },
        { status: 401 }
      );
    }

    // Verify the token matches
    const isValid = await verifyRefreshToken(refreshToken, tokenRecord.tokenHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // Generate new access token
    const accessToken = generateAccessToken(
      tokenRecord.user.userId,
      tokenRecord.user.email
    );

    // Optionally rotate refresh token (for better security)
    const rotateRefreshToken = true; // Can be made configurable
    let newRefreshToken = refreshToken;

    if (rotateRefreshToken) {
      // Revoke old token
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      // Generate new refresh token
      newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      // Store new refresh token
      await prisma.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: tokenRecord.user.userId,
          expiresAt,
        },
      });
    }

    // Create response first
    const response = NextResponse.json({
      accessToken,
      refreshToken: newRefreshToken,
    });

    // Set tokens in cookies directly on the response object
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: undefined as number | undefined,
    };

    // Set access token cookie (15 minutes)
    // Note: For localhost development, secure must be false
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: false, // Set to false for localhost, true for production
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    // Set refresh token cookie (7 days)
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: false, // Set to false for localhost, true for production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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

