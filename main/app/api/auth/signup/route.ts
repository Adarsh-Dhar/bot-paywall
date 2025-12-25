import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '@/lib/auth';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Generate userId (using cuid pattern or simple UUID-like string)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create user
    const user = await prisma.user.create({
      data: {
        userId,
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.userId, user.email);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.userId,
        expiresAt,
      },
    });

    // Create response first
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        accessToken,
        refreshToken,
      },
      { status: 201 }
    );

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
    response.cookies.set('refresh_token', refreshToken, {
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

    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

