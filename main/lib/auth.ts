/**
 * Authentication Utilities
 * Password hashing, JWT token generation/verification, and refresh token management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { headers, cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './prisma';

// JWT configuration
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT Access Token
export interface AccessTokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = {
    userId,
    email,
  };

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

// Refresh Token
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashRefreshToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function verifyRefreshToken(
  token: string,
  hash: string
): Promise<boolean> {
  const tokenHash = await hashRefreshToken(token);
  return tokenHash === hash;
}

// Auth helpers for Next.js
export interface AuthResult {
  userId: string;
  email: string;
}

/**
 * Extract and verify JWT token from request headers or cookies
 * Works in both API routes and server components
 * Checks cookies first (for HTTP-only cookie auth), then Authorization header
 */
export async function auth(): Promise<AuthResult | null> {
  try {
    let token: string | null = null;

    // First, try to get token from cookies (HTTP-only cookies set by server)
    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get('access_token');
    token = accessTokenCookie?.value || null;

    // If no cookie, try Authorization header
    if (!token) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Extract and verify JWT token from NextRequest (for API routes)
 * Note: For middleware/edge runtime, use authFromRequest from '@/lib/auth-edge'
 */
export function authFromRequest(request: NextRequest): AuthResult | null {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    console.error('Auth from request error:', error);
    return null;
  }
}

/**
 * Get current user from database using auth token
 */
export async function getCurrentUser(): Promise<{
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
} | null> {
  try {
    const authResult = await auth();
    if (!authResult) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { userId: authResult.userId },
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const authResult = await auth();
  if (!authResult) {
    throw new Error('Unauthorized');
  }
  return authResult;
}

// Export JWT secret for use in other modules if needed
export { JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY };

