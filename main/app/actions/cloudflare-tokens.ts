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
 */
async function validateCloudflareToken(token: string): Promise<{
  valid: boolean;
  accountId?: string;
  tokenName?: string;
  permissions?: string[];
  error?: string;
}> {
  try {
    // Try multiple endpoints to validate the token
    let validationSuccess = false;
    let accountId = '';
    let errorMessage = '';

    // Try 1: Verify token endpoint (works with User permissions)
    try {
      const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        if (verifyData.success) {
          validationSuccess = true;
          console.log('Token validated via verify endpoint');
        }
      }
    } catch (e) {
      console.log('Verify endpoint failed, trying zones...');
    }

    // Try 2: List zones endpoint (works with Zone permissions)
    if (!validationSuccess) {
      try {
        const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (zonesResponse.ok) {
          const zonesData = await zonesResponse.json();
          if (zonesData.success) {
            validationSuccess = true;
            console.log('Token validated via zones endpoint');
            
            // Extract account ID from first zone
            if (zonesData.result && zonesData.result.length > 0) {
              accountId = zonesData.result[0].account?.id || '';
            }
          } else {
            errorMessage = zonesData.errors?.[0]?.message || 'Token validation failed';
          }
        } else {
          const errorData = await zonesResponse.json().catch(() => ({}));
          errorMessage = errorData.errors?.[0]?.message || `API returned ${zonesResponse.status}`;
        }
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : 'Network error';
        console.log('Zones endpoint failed:', errorMessage);
      }
    }

    // Try 3: List accounts endpoint (works with Account permissions)
    if (!validationSuccess) {
      try {
        const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.success) {
            validationSuccess = true;
            console.log('Token validated via accounts endpoint');
            
            if (accountsData.result && accountsData.result.length > 0) {
              accountId = accountsData.result[0].id;
            }
          }
        }
      } catch (e) {
        console.log('Accounts endpoint failed');
      }
    }

    if (!validationSuccess) {
      return {
        valid: false,
        error: errorMessage || 'Unable to validate token. Please check your token permissions.',
      };
    }

    return {
      valid: true,
      accountId,
      tokenName: 'Cloudflare API Token',
      permissions: ['Zone:Read', 'Zone:Edit'],
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

    // For development/testing, we'll skip validation and store the token
    // In production, you might want to enable validation
    const skipValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_TOKEN_VALIDATION === 'true';
    
    let validation: {
      valid: boolean;
      accountId: string;
      tokenName: string;
      permissions: string[];
    };

    if (!skipValidation) {
      // Validate the token first
      const validationResult = await validateCloudflareToken(token);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error || 'Invalid token',
        };
      }
      validation = {
        valid: true,
        accountId: validationResult.accountId || 'unknown',
        tokenName: validationResult.tokenName || 'API Token',
        permissions: validationResult.permissions || ['Zone:Read', 'Zone:Edit']
      };
    } else {
      console.log('Skipping token validation for development');
      validation = {
        valid: true,
        accountId: 'test-account-id',
        tokenName: 'Development Token',
        permissions: ['Zone:Read', 'Zone:Edit']
      };
    }

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