/**
 * Edge-compatible Authentication Utilities
 * JWT token verification only (no Node.js crypto dependencies)
 * For use in middleware and edge runtime
 */

import { jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

// JWT configuration
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT Access Token
export interface AccessTokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    // Convert secret to Uint8Array for jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    
    // Verify token using jose (Edge-compatible)
    const { payload } = await jwtVerify(token, secret);
    
    // Type assertion to AccessTokenPayload
    const decoded = payload as AccessTokenPayload;
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Token verified successfully:', {
        userId: decoded.userId,
        email: decoded.email,
        hasIat: !!decoded.iat,
        hasExp: !!decoded.exp,
      });
    }
    
    return decoded;
  } catch (error) {
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Token verification error:', {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        tokenLength: token.length,
        tokenStart: token.substring(0, 20),
        jwtSecretLength: JWT_SECRET.length,
      });
    }
    return null;
  }
}

// Auth helpers for Edge Runtime
export interface AuthResult {
  userId: string;
  email: string;
}

/**
 * Extract and verify JWT token from NextRequest (for middleware/edge runtime)
 * Checks both Authorization header and cookies
 */
export async function authFromRequest(request: NextRequest): Promise<AuthResult | null> {
  try {
    // First, try to get token from Authorization header
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // If no Authorization header, try to get token from cookies
      const accessTokenCookie = request.cookies.get('access_token');
      token = accessTokenCookie?.value || null;
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        const allCookies = Array.from(request.cookies.getAll());
        console.log('[Auth] Cookie check:', {
          hasCookie: !!accessTokenCookie,
          cookieValue: accessTokenCookie?.value ? `${accessTokenCookie.value.substring(0, 20)}...` : 'missing',
          cookieNames: allCookies.map(c => c.name),
          cookieCount: allCookies.length,
        });
      }
    }

    if (!token) {
      return null;
    }

    const payload = await verifyAccessToken(token);

    if (!payload) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] Token verification failed');
      }
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

