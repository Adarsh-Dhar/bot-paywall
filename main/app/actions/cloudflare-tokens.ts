'use server';

/**
 * Cloudflare Token Management Actions
 * Handle user Cloudflare API token storage and validation
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/token-encryption';

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
  permissions: any;
  isActive: boolean;
  lastVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate a Cloudflare API token by making a test API call
 * Returns real token name and account ID from Cloudflare API
 */
async function validateCloudflareToken(token: string): Promise<{
  valid: boolean;
  accountId?: string;
  tokenName?: string;
  permissions?: string[];
  error?: string;
}> {
  try {
    let tokenName = '';
    let accountId = '';
    let validationSuccess = false;
    let errorMessage = '';

    // Step 1: Verify token endpoint to get token name and status
    try {
      const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        if (verifyData.success && verifyData.result) {
          validationSuccess = true;
          // Extract token name from verify endpoint
          tokenName = verifyData.result.name || 'API Token';
          
          // Extract permissions if available
          const permissions = verifyData.result.policies?.map((policy: any) => 
            `${policy.resources?.map((r: any) => r.id || r.tag).join(',')}:${policy.permission_groups?.join(',')}`
          ).join(', ') || 'Zone:Read, Zone:Edit';
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
      return {
        valid: false,
        error: errorMessage || 'Unable to validate token. Please check your token permissions.',
      };
    }

    // Step 2: Get account ID from accounts endpoint
    try {
      const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success && accountsData.result && accountsData.result.length > 0) {
          accountId = accountsData.result[0].id;
        }
      }
    } catch (e) {
      // If accounts endpoint fails, try zones endpoint as fallback
      try {
        const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (zonesResponse.ok) {
          const zonesData = await zonesResponse.json();
          if (zonesData.success && zonesData.result && zonesData.result.length > 0) {
            accountId = zonesData.result[0].account?.id || '';
          }
        }
      } catch (zonesError) {
        // Account ID extraction failed, but token is still valid
        console.warn('Could not extract account ID from accounts or zones endpoint');
      }
    }

    if (!accountId) {
      return {
        valid: false,
        error: 'Unable to retrieve account ID. Please ensure your token has Account or Zone read permissions.',
      };
    }

    return {
      valid: true,
      accountId,
      tokenName: tokenName || 'API Token',
      permissions: ['Zone:Read', 'Zone:Edit'], // Default permissions
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    };
  }
}

/**
 * Save a user's Cloudflare API token
 */
export async function saveCloudflareToken(token: string): Promise<CloudflareTokenResponse> {
  try {
    const authResult = await auth();
    if (!authResult) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }
    const { userId, email } = authResult;

    // Always validate the token to get real token name and account ID
    const validationResult = await validateCloudflareToken(token);
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error || 'Invalid token. Please check your Cloudflare API token.',
      };
    }

    if (!validationResult.accountId) {
      return {
        success: false,
        error: 'Unable to retrieve account ID. Please ensure your token has Account or Zone read permissions.',
      };
    }

    if (!validationResult.tokenName) {
      return {
        success: false,
        error: 'Unable to retrieve token name. Please check your token is valid.',
      };
    }

    const validation = {
      valid: true,
      accountId: validationResult.accountId,
      tokenName: validationResult.tokenName,
      permissions: validationResult.permissions || ['Zone:Read', 'Zone:Edit']
    };

    // Encrypt the token
    const encryptedToken = encryptToken(token);

    // Use a transaction to ensure user exists before creating token
    const result = await prisma.$transaction(async (tx: any) => {
      // Ensure user exists in database
      await tx.user.upsert({
        where: { userId: userId },
        update: {},
        create: {
          userId: userId,
          email: email,
        },
      });

      // Upsert the token (update if exists, create if not)
      return await tx.cloudflareToken.upsert({
        where: { userId },
        update: {
          encryptedToken,
          accountId: validation.accountId,
          tokenName: validation.tokenName,
          permissions: validation.permissions,
          isActive: true,
          lastVerified: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          encryptedToken,
          accountId: validation.accountId,
          tokenName: validation.tokenName,
          permissions: validation.permissions,
          isActive: true,
          lastVerified: new Date(),
        },
      });
    });

    return {
      success: true,
      accountId: validation.accountId,
      tokenName: validation.tokenName,
      permissions: validation.permissions,
    };
  } catch (error) {
    console.error('saveCloudflareToken error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

/**
 * Get user's Cloudflare token info (without the actual token)
 */
export async function getUserCloudflareTokenInfo(): Promise<UserCloudflareToken | null> {
  try {
    const authResult = await auth();
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    const token = await prisma.cloudflareToken.findUnique({
      where: {
        userId,
        isActive: true,
      },
    });

    return token;
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
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    const tokenRecord = await prisma.cloudflareToken.findUnique({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!tokenRecord) {
      return null;
    }

    return decryptToken(tokenRecord.encryptedToken);
  } catch (error) {
    console.error('getUserCloudflareToken error:', error);
    return null;
  }
}

/**
 * Remove user's Cloudflare token
 */
export async function removeCloudflareToken(): Promise<{ success: boolean; error?: string }> {
  try {
    const authResult = await auth();
    if (!authResult) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }
    const { userId } = authResult;

    await prisma.cloudflareToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    return { success: true };
  } catch (error) {
    console.error('removeCloudflareToken error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}