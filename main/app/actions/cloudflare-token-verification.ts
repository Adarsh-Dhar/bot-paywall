'use server';

/**
 * Cloudflare Token Verification Actions
 * Handles token verification and zone ID lookup
 */

import { z } from 'zod';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { auth } from '@/lib/mock-auth';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface TokenVerificationResult {
  success: boolean;
  status?: 'active' | 'inactive' | 'expired';
  message: string;
  permissions?: string[];
  error?: string;
}

export interface ZoneLookupResult {
  success: boolean;
  zoneId?: string;
  zoneName?: string;
  status?: string;
  nameservers?: string[];
  message: string;
  error?: string;
}

/**
 * Phase 1: Verify the Cloudflare API token
 * Checks if the token is active and has correct permissions
 */
export async function verifyCloudflareToken(): Promise<TokenVerificationResult> {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
    }

    // Get user's Cloudflare token
    const userToken = await getUserCloudflareToken();
    if (!userToken) {
      return {
        success: false,
        message: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
        error: 'NO_TOKEN',
      };
    }

    // Verify token with Cloudflare API
    const response = await fetch(`${CLOUDFLARE_API_BASE}/user/tokens/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: `Token verification failed: ${data.errors?.[0]?.message || 'Unknown error'}`,
        error: 'VERIFICATION_FAILED',
      };
    }

    const tokenStatus = data.result?.status || 'unknown';
    const permissions = data.result?.policies?.map((policy: any) => 
      `${policy.effect}:${policy.resources}:${policy.permission_groups?.join(',')}`
    ) || [];

    return {
      success: true,
      status: tokenStatus,
      message: tokenStatus === 'active' 
        ? 'Token is active and valid' 
        : `Token status: ${tokenStatus}`,
      permissions,
    };
  } catch (error) {
    console.error('verifyCloudflareToken error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }
}

const domainSchema = z.string().min(1, 'Domain is required').regex(
  /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/,
  'Invalid domain format'
);

/**
 * Phase 2: Look up Zone ID for a domain
 * Finds the Cloudflare Zone ID for a given domain name
 */
export async function lookupZoneId(domain: string): Promise<ZoneLookupResult> {
  try {
    // Validate domain format
    const validatedDomain = domainSchema.parse(domain);

    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
    }

    // Get user's Cloudflare token
    const userToken = await getUserCloudflareToken();
    if (!userToken) {
      return {
        success: false,
        message: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
        error: 'NO_TOKEN',
      };
    }

    // Look up zone by domain name
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones?name=${encodeURIComponent(validatedDomain)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: `Zone lookup failed: ${data.errors?.[0]?.message || 'Unknown error'}`,
        error: 'LOOKUP_FAILED',
      };
    }

    if (!data.result || data.result.length === 0) {
      return {
        success: false,
        message: `No zone found for domain "${validatedDomain}". Make sure the domain is added to your Cloudflare account.`,
        error: 'ZONE_NOT_FOUND',
      };
    }

    const zone = data.result[0];
    
    return {
      success: true,
      zoneId: zone.id,
      zoneName: zone.name,
      status: zone.status,
      nameservers: zone.name_servers || [],
      message: `Zone found: ${zone.name} (${zone.id}) - Status: ${zone.status}`,
    };
  } catch (error) {
    console.error('lookupZoneId error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Invalid domain: ' + error.issues.map((e: any) => e.message).join(', '),
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }
}