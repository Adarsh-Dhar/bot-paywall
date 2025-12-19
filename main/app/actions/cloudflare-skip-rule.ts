'use server';

/**
 * Cloudflare Skip Rule Server Action
 * Demonstrates the skip-based WAF rule deployment
 * Requirements: 4.1, 4.2, 4.3
 */

import { z } from 'zod';
import { auth } from '@/lib/mock-auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { deployWAFRule, getOrCreateRuleset } from '@/lib/cloudflare-api';

const deploySkipRuleSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  zoneId: z.string().min(1, 'Zone ID is required'),
  secretKey: z.string().min(32, 'Secret key must be at least 32 characters'),
});

export interface DeploySkipRuleResponse {
  success: boolean;
  message: string;
  ruleId?: string;
  error?: string;
}

/**
 * Deploy a WAF skip rule for a domain
 * This creates a rule that bypasses bot protection when the X-Partner-Key header matches
 */
export async function deploySkipRule(
  domain: string,
  zoneId: string,
  secretKey: string
): Promise<DeploySkipRuleResponse> {
  try {
    // Validate input
    const validatedInput = deploySkipRuleSchema.parse({
      domain,
      zoneId,
      secretKey,
    });

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

    // Get or create ruleset for the zone
    const rulesetId = await getOrCreateRuleset(validatedInput.zoneId, userToken);

    // Deploy the WAF skip rule
    const result = await deployWAFRule(
      validatedInput.zoneId,
      rulesetId,
      validatedInput.secretKey,
      userToken
    );

    return {
      success: true,
      message: `Skip rule deployed successfully for ${validatedInput.domain}. Requests with X-Partner-Key header will bypass bot protection.`,
      ruleId: result.result?.id,
    };
  } catch (error) {
    console.error('deploySkipRule error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Invalid input: ' + error.issues.map((e: any) => e.message).join(', '),
        error: 'VALIDATION_ERROR',
      };
    }

    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
      return {
        success: false,
        message: 'Cloudflare API authentication failed. Please check your API token.',
        error: 'AUTH_ERROR',
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
 * Test the skip rule by making a request with the X-Partner-Key header
 */
export async function testSkipRule(
  domain: string,
  secretKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const testUrl = `https://${domain}`;
    
    // Make a test request with the X-Partner-Key header
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'X-Partner-Key': secretKey,
        'User-Agent': 'Gatekeeper-Test-Bot/1.0',
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Skip rule is working! Request with X-Partner-Key header was allowed through.',
      };
    } else {
      return {
        success: false,
        message: `Test failed with status ${response.status}. The skip rule may not be active yet.`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}