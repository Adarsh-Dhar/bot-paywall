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

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
      );
    }

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

    await prisma.refreshToken.updateMany({
      where: {
        userId: user.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const accessToken = generateAccessToken(user.userId, user.email);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.userId,
        expiresAt,
      },
    });

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

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[SignIn] Setting cookies:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken.length,
        cookieHeaders: response.headers.get('set-cookie') ? 'present' : 'missing',
      });
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
