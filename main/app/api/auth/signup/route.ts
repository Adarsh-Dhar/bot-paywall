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

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
      );
    }

    const passwordHash = await hashPassword(validatedData.password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const user = await prisma.user.create({
      data: {
        userId,
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
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
