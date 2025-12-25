'use server';

/**
 * Cloudflare Verification Module
 * Dedicated module for domain verification and auto-configuration logic
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCloudflareZoneStatus,
  deployWAFRule,
} from '@/lib/cloudflare-api';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';

export interface VerifyProjectStatusResponse {
  status: 'PENDING_NS' | 'PROTECTED' | 'error';
  message: string;
  protected?: boolean;
}

/**
 * Verify project status and auto-configure protection when domain becomes active
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export async function verifyProjectStatus(
  projectId: string
): Promise<VerifyProjectStatusResponse> {
  try {
    // Get authenticated user
    const authResult = await auth();
    if (!authResult) {
      return {
        status: 'error',
        message: 'User not authenticated',
      };
    }
    const { userId } = authResult;

    // Fetch project data including zone_id, api_token, and secret_key from database
    // Requirements: 9.2
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    if (!project) {
      return {
        status: 'error',
        message: 'Project not found or unauthorized',
      };
    }

    if (!project.zoneId) {
      return {
        status: 'error',
        message: 'Zone ID not found for this project',
      };
    }

    // Get user's Cloudflare token (decrypted)
    const userToken = await getUserCloudflareToken();
    if (!userToken) {
      return {
        status: 'error',
        message: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
      };
    }

    // Call Cloudflare API to check zone status
    const zoneStatus = await getCloudflareZoneStatus(project.zoneId, userToken);

    if (!zoneStatus.result) {
      return {
        status: 'error',
        message: 'Failed to check zone status with Cloudflare',
      };
    }

    // Handle status cases
    if (zoneStatus.result.status === 'pending') {
      // Case A: Status is 'pending' - Requirements: 9.3
      return {
        status: 'PENDING_NS',
        message: 'Waiting for Nameserver update.',
      };
    }

    if (zoneStatus.result.status === 'active') {
      // Case B: Status is 'active' - The Trigger - Requirements: 9.4, 9.5
      try {
        // Deploy WAF rule directly using the simplified approach
        await deployWAFRule(project.zoneId, project.secretKey, userToken);
        
        // Update project status to 'protected'
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'PROTECTED' },
        });

        // Return success response
        return {
          status: 'PROTECTED',
          message: 'Domain active & Firewall injected.',
          protected: true,
        };
      } catch (wafError) {
        console.error('WAF deployment error:', wafError);
        return {
          status: 'error',
          message: 'Failed to deploy protection rules. Please try again.',
        };
      }
    }

    // Unknown status
    return {
      status: 'error',
      message: `Unknown zone status: ${zoneStatus.result.status}`,
    };
  } catch (error) {
    console.error('verifyProjectStatus error:', error);
    
    // Handle 401/403 Cloudflare API errors specifically
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
      return {
        status: 'error',
        message: 'Auth Error',
      };
    }
    
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}