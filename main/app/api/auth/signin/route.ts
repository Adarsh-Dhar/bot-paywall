import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '@/lib/auth';

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signinSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has a password hash (required for authentication)
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Revoke old refresh tokens (optional - for security)
    await prisma.refreshToken.updateMany({
      where: {
        userId: user.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Generate new tokens
    const accessToken = generateAccessToken(user.userId, user.email);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.userId,
        expiresAt,
      },
    });

    // Create response first
    const response = NextResponse.json({
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    });

    // Set tokens in cookies directly on the response object
    // Note: In development, secure should be false for localhost
    const isProduction = process.env.NODE_ENV === 'production';
    
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
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set to false for localhost, true for production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    // Debug: Log cookie setting in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SignIn] Setting cookies:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken.length,
        cookieHeaders: response.headers.get('set-cookie') ? 'present' : 'missing',
      });
      // Log the actual Set-Cookie headers
      const setCookieHeaders = response.headers.getSetCookie();
      console.log('[SignIn] Set-Cookie headers:', setCookieHeaders);
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

