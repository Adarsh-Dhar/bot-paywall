'use server';

/**
 * Gatekeeper Server Actions
 * Core server-side operations for domain registration and verification
 */

import { auth } from '@/lib/mock-auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';

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


