/**
 * Cloudflare Client Factory
 * Creates CloudflareClient instances with credentials from the database
 */

import { CloudflareClientImpl } from './bot-payment-system/services/cloudflare-client';
import { auth } from './auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { prisma } from './prisma';

/**
 * Get CloudflareClient for a specific project
 * Fetches the project's zone ID and the user's Cloudflare token from the database
 */
export async function getCloudflareClientForProject(projectId: string): Promise<CloudflareClientImpl> {
  // Authenticate user
  const authResult = await auth();
  if (!authResult) {
    throw new Error('User not authenticated');
  }
  const { userId } = authResult;

  // Get project from database
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
    },
    select: {
      id: true,
      zoneId: true,
      userId: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.zoneId) {
    throw new Error('Zone ID not found for this project');
  }

  // Get user's Cloudflare token
  const token = await getUserCloudflareToken();
  if (!token) {
    throw new Error('Cloudflare API token not found. Please connect your Cloudflare account.');
  }

  return new CloudflareClientImpl(token, project.zoneId);
}

/**
 * Get CloudflareClient for a user with a specific zone ID
 * Fetches the user's Cloudflare token from the database
 */
export async function getCloudflareClientForUser(userId: string, zoneId: string): Promise<CloudflareClientImpl> {
  if (!zoneId) {
    throw new Error('Zone ID is required');
  }

  // Authenticate and verify user
  const authResult = await auth();
  if (!authResult) {
    throw new Error('User not authenticated');
  }

  // Verify the userId matches the authenticated user
  if (authResult.userId !== userId) {
    throw new Error('Unauthorized: User ID does not match authenticated user');
  }

  // Get user's Cloudflare token
  const token = await getUserCloudflareToken();
  if (!token) {
    throw new Error('Cloudflare API token not found. Please connect your Cloudflare account.');
  }

  return new CloudflareClientImpl(token, zoneId);
}

