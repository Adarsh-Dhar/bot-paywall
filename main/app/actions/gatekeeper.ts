'use server';

/**
 * Gatekeeper Server Actions
 * Core server-side operations for domain registration and verification
 */

import { auth } from '@/lib/mock-auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { lookupZoneId } from '@/app/actions/cloudflare-token-verification';
import { prisma } from '@/lib/prisma';
import { verifyProjectStatus } from '@/app/actions/cloudflare-verification';
import crypto from 'crypto';

export interface RegisterDomainResult {
  success: boolean;
  project?: {
    id: string;
    name: string;
    zoneId: string;
    gatekeeperToken: string;
    status: string;
  };
  error?: string;
}

export interface ProjectWithToken {
  id: string;
  name: string;
  zoneId: string | null;
  status: string;
  gatekeeperToken: string;
  createdAt: string;
}

/**
 * Generate a random Gatekeeper API token
 */
function generateGatekeeperToken(): string {
  // Generate a random 32-character token with gk_live_ prefix
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `gk_live_${randomBytes}`;
}

/**
 * Register a new domain and generate Gatekeeper API token
 */
export async function registerDomain(domain: string): Promise<RegisterDomainResult> {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    if (!domainRegex.test(domain)) {
      return {
        success: false,
        error: 'Invalid domain format',
      };
    }

    // Check if domain already exists for this user
    const existingProject = await prisma.project.findFirst({
      where: {
        userId: userId,
        name: domain,
      },
    });

    if (existingProject) {
      return {
        success: false,
        error: 'Domain already registered',
      };
    }

    // Look up zone ID for the domain
    const zoneResult = await lookupZoneId(domain);
    if (!zoneResult.success || !zoneResult.zoneId) {
      return {
        success: false,
        error: zoneResult.message || 'Failed to find zone for domain. Make sure the domain is added to your Cloudflare account.',
      };
    }

    // Generate Gatekeeper API token
    const gatekeeperToken = generateGatekeeperToken();

    // Create project in database
    const project = await prisma.project.create({
      data: {
        userId: userId,
        name: domain,
        zoneId: zoneResult.zoneId,
        nameservers: zoneResult.nameservers || [],
        status: zoneResult.status === 'active' ? 'ACTIVE' : 'PENDING_NS',
        secretKey: gatekeeperToken,
      },
    });

    // If zone is already active, deploy WAF rule immediately
    if (zoneResult.status === 'active') {
      try {
        await verifyProjectStatus(project.id);
      } catch (error) {
        console.error('Failed to deploy WAF rule immediately:', error);
        // Don't fail the registration, user can deploy later
      }
    }

    return {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        zoneId: project.zoneId!,
        gatekeeperToken: project.secretKey,
        status: project.status,
      },
    };
  } catch (error) {
    console.error('registerDomain error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get all projects for the authenticated user
 */
export async function getUserProjects(): Promise<ProjectWithToken[]> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      zoneId: project.zoneId,
      status: project.status,
      gatekeeperToken: project.secretKey,
      createdAt: project.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('getUserProjects error:', error);
    return [];
  }
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<ProjectWithToken | null> {
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

    if (!project) {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      zoneId: project.zoneId,
      status: project.status,
      gatekeeperToken: project.secretKey,
      createdAt: project.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('getProject error:', error);
    return null;
  }
}

/**
 * Deploy WAF skip rule for a project
 */
export async function deploySkipRule(projectId: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await verifyProjectStatus(projectId);
    
    if (result.status === 'PROTECTED') {
      return {
        success: true,
        message: 'WAF skip rule deployed successfully! Your domain is now protected.',
      };
    } else if (result.status === 'PENDING_NS') {
      return {
        success: false,
        message: 'Domain is still pending nameserver update. Please wait for DNS propagation.',
      };
    } else {
      return {
        success: false,
        message: result.message || 'Failed to deploy WAF skip rule.',
      };
    }
  } catch (error) {
    console.error('deploySkipRule error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Simple function to check if user has connected Cloudflare
 */
export async function checkCloudflareConnection(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return false;
    }

    const userToken = await getUserCloudflareToken();
    return !!userToken;
  } catch (error) {
    console.error('checkCloudflareConnection error:', error);
    return false;
  }
}


