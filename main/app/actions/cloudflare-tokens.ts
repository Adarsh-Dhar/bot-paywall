'use server';

/**
 * Cloudflare Token Management Actions
 * Tokens are stored on Project.api_keys (encrypted)
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/token-encryption';
import { revalidatePath } from 'next/cache';

export interface CloudflareTokenResponse {
  success: boolean;
  error?: string;
  accountId?: string;
  tokenName?: string;
  permissions?: string[];
}

export interface UserCloudflareToken {
  id: string;
  userId: string;
  accountId: string | null;
  tokenName: string | null;
  permissions: string[] | null;
  isActive: boolean;
  lastVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate a Cloudflare API token by making a test API call
 */
async function validateCloudflareToken(token: string): Promise<{
  valid: boolean;
  accountId?: string;
  tokenName?: string;
  permissions?: string[];
  error?: string;
}> {
  try {
    const cleanToken = token.trim().replace(/[\r\n\t\s]+/g, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanToken)) {
      return { valid: false, error: 'Token contains invalid characters. Please copy the token exactly from Cloudflare.' };
    }

    let tokenName = '';
    let accountId = '';
    let validationSuccess = false;
    let errorMessage = '';

    try {
      const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' },
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        if (verifyData.success && verifyData.result) {
          validationSuccess = true;
          tokenName = verifyData.result.name || 'API Token';
        } else {
          errorMessage = verifyData.errors?.[0]?.message || 'Token verification failed';
        }
      } else {
        const errorData = await verifyResponse.json().catch(() => ({}));
        errorMessage = errorData.errors?.[0]?.message || `API returned ${verifyResponse.status}`;
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Failed to verify token';
    }

    if (!validationSuccess) {
      return { valid: false, error: errorMessage || 'Unable to validate token. Please check your token permissions.' };
    }

    try {
      const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' },
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success && accountsData.result && accountsData.result.length > 0) {
          accountId = accountsData.result[0].id;
        }
      }
    } catch (e) {
      console.warn('Accounts endpoint failed:', e instanceof Error ? e.message : e);
    }

    if (!accountId) {
      try {
        const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' },
        });

        if (zonesResponse.ok) {
          const zonesData = await zonesResponse.json();
          if (zonesData.success && zonesData.result && zonesData.result.length > 0) {
            accountId = zonesData.result[0].account?.id || '';
          }
        }
      } catch (zonesError) {
        console.warn('Zones endpoint failed:', zonesError instanceof Error ? zonesError.message : zonesError);
      }
    }

    if (!accountId) {
      return {
        valid: false,
        error: 'Unable to retrieve account ID. Your token must have at least one of these permissions: "Account:Read", "Zone:Read", or "All accounts" access. Please create a new token with the required permissions.',
      };
    }

    return {
      valid: true,
      accountId,
      tokenName: tokenName || 'API Token',
      permissions: ['Zone:Read', 'Zone:Edit'],
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Token validation failed' };
  }
}

/**
 * Verify token and save it to ALL of the user's projects
 */
export async function saveCloudflareToken(token: string): Promise<CloudflareTokenResponse> {
  try {
    const cleanToken = token.trim().replace(/[\r\n\t\s]+/g, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanToken)) {
      return { success: false, error: 'Token contains invalid characters. Please copy the token exactly from Cloudflare.' };
    }

    const authResult = await auth();
    if (!authResult) return { success: false, error: 'User not authenticated' };
    const { userId, email } = authResult;

    const validationResult = await validateCloudflareToken(cleanToken);
    if (!validationResult.valid) {
      return { success: false, error: validationResult.error || 'Invalid token. Please check your Cloudflare API token.' };
    }
    if (!validationResult.accountId) {
      return { success: false, error: 'Unable to retrieve account ID. Please ensure your token has Account or Zone read permissions.' };
    }
    if (!validationResult.tokenName) {
      return { success: false, error: 'Unable to retrieve token name. Please check your token is valid.' };
    }

    const encryptedToken = encryptToken(cleanToken);

    await prisma.user.upsert({
      where: { userId },
      update: {},
      create: { userId, email },
    });

    const updateResult = await prisma.project.updateMany({
      where: { userId },
      data: { api_keys: encryptedToken, updatedAt: new Date() },
    });

    console.log(`✅ Updated Cloudflare token for ${updateResult.count} projects`);
    revalidatePath('/dashboard');

    return {
      success: true,
      accountId: validationResult.accountId,
      tokenName: validationResult.tokenName,
      permissions: validationResult.permissions,
    };
  } catch (error) {
    console.error('saveCloudflareToken error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An error occurred' };
  }
}

/**
 * Alias for saveCloudflareToken (backwards compatibility)
 */
export async function verifyAndSaveToken(token: string): Promise<{ success: boolean; error?: string }> {
  return saveCloudflareToken(token);
}

/**
 * Check if the user has at least one project with a token configured
 */
export async function getCloudflareTokenStatus(): Promise<{ hasToken: boolean; isActive: boolean; lastVerified?: Date }> {
  try {
    const authResult = await auth();
    if (!authResult) return { hasToken: false, isActive: false };

    const projectWithToken = await prisma.project.findFirst({
      where: { userId: authResult.userId, api_keys: { not: null } },
      select: { api_keys: true, updatedAt: true },
    });

    return { hasToken: !!projectWithToken, isActive: !!projectWithToken, lastVerified: projectWithToken?.updatedAt };
  } catch (error) {
    return { hasToken: false, isActive: false };
  }
}

/**
 * Get user's Cloudflare token info (compatible shape)
 */
export async function getUserCloudflareTokenInfo(): Promise<UserCloudflareToken | null> {
  try {
    const authResult = await auth();
    if (!authResult) return null;
    const { userId } = authResult;

    const projectWithToken = await prisma.project.findFirst({
      where: { userId, api_keys: { not: null } },
      select: { id: true, api_keys: true, createdAt: true, updatedAt: true },
    });

    if (!projectWithToken) return null;

    return {
      id: projectWithToken.id,
      userId,
      accountId: null,
      tokenName: 'API Token',
      permissions: ['Zone:Read', 'Zone:Edit'],
      isActive: true,
      lastVerified: projectWithToken.updatedAt,
      createdAt: projectWithToken.createdAt,
      updatedAt: projectWithToken.updatedAt,
    };
  } catch (error) {
    console.error('getUserCloudflareTokenInfo error:', error);
    return null;
  }
}

/**
 * Get decrypted token for API calls (server-side only)
 */
export async function getUserCloudflareToken(): Promise<string | null> {
  try {
    const authResult = await auth();
    if (!authResult) return null;
    const { userId } = authResult;

    const projectWithToken = await prisma.project.findFirst({
      where: { userId, api_keys: { not: null } },
      select: { api_keys: true },
    });

    if (!projectWithToken?.api_keys) return null;
    return decryptToken(projectWithToken.api_keys);
  } catch (error) {
    console.error('getUserCloudflareToken error:', error);
    return null;
  }
}

/**
 * Delete token from all user projects
 */
export async function removeCloudflareToken(): Promise<{ success: boolean; error?: string }> {
  try {
    const authResult = await auth();
    if (!authResult) return { success: false, error: 'User not authenticated' };
    const { userId } = authResult;

    await prisma.project.updateMany({
      where: { userId },
      data: { api_keys: null },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('removeCloudflareToken error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An error occurred' };
  }
}

/**
 * Alias for removeCloudflareToken (backwards compatibility)
 */
export async function deleteCloudflareToken(): Promise<{ success: boolean; error?: string }> {
  return removeCloudflareToken();
}
