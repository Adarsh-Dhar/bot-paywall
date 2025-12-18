'use server';

/**
 * Gatekeeper Server Actions
 * Core server-side operations for domain registration and verification
 */

import { auth } from '@/lib/mock-auth';
import { prisma } from '@/lib/prisma';
import {
  createCloudflareZone,
  getCloudflareZoneStatus,
  getOrCreateRuleset,
  deployWAFRule,
} from '@/lib/cloudflare-api';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { generateSecretKey } from '@/lib/secret-key-generator';
import { Project } from '@prisma/client';
import {
  RegisterDomainResponse,
  VerifyAndConfigureResponse,
} from '@/types/gatekeeper';

/**
 * Validate domain format
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation: must have at least one dot and valid characters
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

/**
 * Register a new domain and create a Cloudflare zone
 * Requirements: 1.2, 1.3, 1.4
 */
export async function registerDomain(
  domain: string
): Promise<RegisterDomainResponse> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate domain format
    if (!isValidDomain(domain)) {
      return {
        success: false,
        error: 'Invalid domain format. Please enter a valid domain name.',
      };
    }

    // Generate secret key
    const secretKey = generateSecretKey();

    // Get user's Cloudflare token
    const userToken = await getUserCloudflareToken();
    if (!userToken) {
      return {
        success: false,
        error: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
      };
    }

    // Call Cloudflare API to create zone
    const cfResponse = await createCloudflareZone(domain, userToken);

    if (!cfResponse.result) {
      return {
        success: false,
        error: 'Failed to create Cloudflare zone',
      };
    }

    const zoneId = cfResponse.result.id;
    const nameservers = cfResponse.result.nameservers;

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { userId: userId },
      update: {},
      create: {
        userId: userId,
        email: 'test@example.com',
      },
    });

    // Insert project record into database
    const project = await prisma.project.create({
      data: {
        userId,
        name: domain,
        zoneId: zoneId,
        nameservers: nameservers,
        status: 'PENDING_NS',
        secretKey: secretKey,
      },
    });

    return {
      success: true,
      zone_id: zoneId,
      nameservers: nameservers,
      secret_key: secretKey,
    };
  } catch (error) {
    console.error('registerDomain error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

/**
 * Verify nameserver update and deploy WAF rule
 * Requirements: 3.1, 3.3, 3.4, 4.1
 */
export async function verifyAndConfigure(
  projectId: string
): Promise<VerifyAndConfigureResponse> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return {
        status: 'error',
        message: 'User not authenticated',
      };
    }

    // Fetch project from database
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

    // Get user's Cloudflare token
    const userToken = await getUserCloudflareToken();
    if (!userToken) {
      return {
        status: 'error',
        message: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
      };
    }

    // Check zone status with Cloudflare
    const zoneStatus = await getCloudflareZoneStatus(project.zoneId, userToken);

    if (!zoneStatus.result || zoneStatus.result.status !== 'active') {
      return {
        status: 'pending',
        message: 'Nameservers not yet updated. Please update them at your registrar and try again.',
      };
    }

    // Zone is active, deploy WAF rule
    try {
      const rulesetId = await getOrCreateRuleset(project.zoneId, userToken);
      await deployWAFRule(project.zoneId, rulesetId, project.secretKey, userToken);
    } catch (wafError) {
      console.error('WAF deployment error:', wafError);
      return {
        status: 'error',
        message: 'Failed to deploy protection rules. Please try again.',
      };
    }

    // Update project status to 'protected'
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'PROTECTED' },
    });

    return {
      status: 'success',
      message: 'Protection Active. Backdoor Ready.',
      protected: true,
    };
  } catch (error) {
    console.error('verifyAndConfigure error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

/**
 * Get all projects for the authenticated user
 * Requirements: 6.1, 7.3
 */
export async function getProjectsByUser(): Promise<Project[]> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  } catch (error) {
    console.error('getProjectsByUser error:', error);
    return [];
  }
}

/**
 * Get a single project by ID with authorization check
 * Requirements: 7.5
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return null;
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    return project;
  } catch (error) {
    console.error('getProjectById error:', error);
    return null;
  }
}
