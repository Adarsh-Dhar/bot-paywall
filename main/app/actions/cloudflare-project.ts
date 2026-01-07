'use server';

/**
 * Cloudflare Project-specific Actions
 * Handles per-project API token and zone management
 */

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { encryptToken } from '@/lib/token-encryption';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface ZoneInfo {
  id: string;
  name: string;
  status: string;
  nameservers: string[];
}

export interface GetZonesWithTokenResult {
  success: boolean;
  zones?: ZoneInfo[];
  message: string;
  error?: string;
}

export interface SaveProjectResult {
  success: boolean;
  projectId?: string;
  message: string;
  error?: string;
}

const domainSchema = z.string().min(1, 'Domain is required').regex(
  /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/,
  'Invalid domain format'
);

/**
 * Fetch zones using a provided API token
 * This allows getting zones for per-project tokens
 */
export async function getZonesWithProvidedToken(apiToken: string): Promise<GetZonesWithTokenResult> {
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

    // Clean the token
    const cleanedToken = apiToken.trim().replace(/[\r\n\t\s]+/g, '');

    if (!cleanedToken || cleanedToken.length < 20) {
      return {
        success: false,
        message: 'Invalid API token provided',
        error: 'INVALID_TOKEN',
      };
    }

    // Fetch all zones from Cloudflare using the provided token
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones?per_page=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanedToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: `Failed to fetch zones: ${data.errors?.[0]?.message || 'Invalid token or API error'}`,
        error: 'FETCH_FAILED',
      };
    }

    if (!data.result || data.result.length === 0) {
      return {
        success: false,
        message: 'No zones found for this API token. Please add a domain to Cloudflare first.',
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
    console.error('getZonesWithProvidedToken error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Save project with its own API token and zone ID
 * Domain is extracted from websiteUrl, not stored separately
 */
export async function saveProjectWithToken(
  websiteUrl: string,
  apiToken: string,
  zoneId: string,
  nameservers?: string[],
  gatekeeperSecret?: string,
  paymentAddress?: string,
  paymentAmount?: string
): Promise<SaveProjectResult> {
  try {
    if (!zoneId || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return {
        success: false,
        message: 'Invalid Zone ID format',
        error: 'VALIDATION_ERROR',
      };
    }

    // Validate website URL
    let validatedUrl = websiteUrl.trim();
    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
      validatedUrl = 'https://' + validatedUrl;
    }

    try {
      new URL(validatedUrl);
    } catch {
      return {
        success: false,
        message: 'Invalid website URL',
        error: 'VALIDATION_ERROR',
      };
    }

    // Clean the token
    const cleanedToken = apiToken.trim().replace(/[\r\n\t\s]+/g, '');

    if (!cleanedToken || cleanedToken.length < 20) {
      return {
        success: false,
        message: 'Invalid API token provided',
        error: 'INVALID_TOKEN',
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

    // Use a transaction to ensure user exists and project is created
    const result = await prisma.$transaction(async (tx) => {
      // Ensure user exists in database
      // Use email (unique) to avoid conflicts when the same email is reused with a new userId
      await tx.user.upsert({
        where: { email },
        update: { userId },
        create: {
          userId,
          email,
        },
      });

      // Check if project with this websiteUrl already exists (globally)
      const existingProject = await tx.project.findFirst({
        where: {
          websiteUrl: validatedUrl
        }
      });

      if (existingProject) {
        throw new Error('A project with this website URL already exists.');
      }

      // Create new project with provided gatekeeperSecret and payment info
      return await tx.project.create({
        data: {
          userId: userId,
          websiteUrl: validatedUrl,
          zoneId: zoneId,
          status: 'ACTIVE',
          secretKey: gatekeeperSecret || crypto.randomBytes(32).toString('hex'),
          api_token: encryptToken(cleanedToken),
          paymentAddress: paymentAddress?.trim() ? paymentAddress.trim() : undefined,
          paymentAmount: paymentAmount?.trim() ? paymentAmount.trim() : undefined,
        },
      });
    });

    return {
      success: true,
      projectId: result.id,
      message: `Project saved successfully`,
    };
  } catch (error) {
    console.error('saveProjectWithToken error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Validation error: ' + error.issues.map((e: any) => e.message).join(', '),
        error: 'VALIDATION_ERROR',
      };
    }
    // Handle duplicate error
    if (error instanceof Error && error.message.includes('already exists')) {
      return {
        success: false,
        message: error.message,
        error: 'DUPLICATE',
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }
}

