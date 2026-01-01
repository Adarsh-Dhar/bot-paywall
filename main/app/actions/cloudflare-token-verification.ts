'use server';

/**
 * Cloudflare Token Verification Actions
 * Handles token verification and zone ID lookup
 */

import { z } from 'zod';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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

export interface ZoneInfo {
  id: string;
  name: string;
  status: string;
  nameservers: string[];
}

export interface GetZonesResult {
  success: boolean;
  zones?: ZoneInfo[];
  message: string;
  error?: string;
}

export interface SaveDomainResult {
  success: boolean;
  projectId?: string;
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
    const authResult = await auth();
    if (!authResult) {
      return {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
    }
    const { userId } = authResult;

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
    const permissions = data.result?.policies?.map((policy: { effect: string; resources: string; permission_groups?: string[] }) =>
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
    const authResult = await auth();
    if (!authResult) {
      return {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
    }
    const { userId } = authResult;

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
        message: 'Invalid domain: ' + error.issues.map((e: { message: string }) => e.message).join(', '),
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

/**
 * Phase 3: Save the domain and zone ID to the database
 * Creates a new project or updates an existing one
 * @param domain - The domain name
 * @param zoneId - The Cloudflare Zone ID
 * @param nameservers - Optional nameservers array
 * @param websiteUrl - The full website URL
 */
export async function saveDomainToDatabase(
  domain: string,
  zoneId: string,
  nameservers?: string[],
  websiteUrl?: string
): Promise<SaveDomainResult> {
  try {
    // Validate inputs
    const validatedDomain = domainSchema.parse(domain);

    if (!zoneId || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return {
        success: false,
        message: 'Invalid Zone ID format',
        error: 'VALIDATION_ERROR',
      };
    }

    // Check authentication
    const authResult = await auth();
    if (!authResult) {
      return {
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      };
    }
    const { userId, email } = authResult;

    // Get the user's Cloudflare token to save as api_keys
    const cloudflareToken = await getUserCloudflareToken();

    // Use a transaction to ensure user exists and project is created
    const result = await prisma.$transaction(async (tx) => {
      // Ensure user exists in database
      await tx.user.upsert({
        where: { userId: userId },
        update: {},
        create: {
          userId: userId,
          email: email,
        },
      });

      // Check if project with this domain already exists for this user
      const existingProject = await tx.project.findFirst({
        where: {
          userId: userId,
          websiteUrl: websiteUrl || `https://${validatedDomain}`,
        },
      });

      if (existingProject) {
        // Update existing project with zone ID and api_token
        return await tx.project.update({
          where: { id: existingProject.id },
          data: {
            zoneId: zoneId,
            status: 'ACTIVE',
            updatedAt: new Date(),
            api_token: cloudflareToken || existingProject.api_token,
          },
        });
      } else {
        // Create new project with the websiteUrl, zone ID, and api_token
        const secretKey = crypto.randomBytes(32).toString('hex');
        return await tx.project.create({
          data: {
            userId: userId,
            websiteUrl: websiteUrl || `https://${validatedDomain}`,
            zoneId: zoneId,
            status: 'ACTIVE',
            secretKey: secretKey,
            api_token: cloudflareToken || '',
          },
        });
      }
    });

    return {
      success: true,
      projectId: result.id,
      message: `Domain "${validatedDomain}" saved successfully with Zone ID`,
    };
  } catch (error) {
    console.error('saveDomainToDatabase error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Invalid domain: ' + error.issues.map((e: { message: string }) => e.message).join(', '),
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

/**
 * Get all zones available for the user's Cloudflare token
 * This allows users to select from available zones when setting up a project
 */
export async function getZonesForToken(): Promise<GetZonesResult> {
  try {
    // Check authentication
    const authResult = await auth();
    if (!authResult) {
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

    // Fetch all zones from Cloudflare
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones?per_page=50`, {
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
        message: `Failed to fetch zones: ${data.errors?.[0]?.message || 'Unknown error'}`,
        error: 'FETCH_FAILED',
      };
    }

    if (!data.result || data.result.length === 0) {
      return {
        success: false,
        message: 'No zones found in your Cloudflare account. Please add a domain to Cloudflare first.',
        error: 'NO_ZONES',
      };
    }

    // Map zones to our format
    const zones: ZoneInfo[] = data.result.map((zone: ZoneInfo) => ({
      id: zone.id,
      name: zone.name,
      status: zone.status,
      nameservers: zone.nameservers || [],
    }));

    return {
      success: true,
      zones,
      message: `Found ${zones.length} zone(s)`,
    };
  } catch (error) {
    console.error('getZonesForToken error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }
}
