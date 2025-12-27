/**
 * Worker Configuration API
 * Provides project configuration (zoneId, token) for Cloudflare workers
 * Authenticated via WORKER_API_KEY environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/token-encryption';

/**
 * Get project configuration by hostname/domain
 * Requires WORKER_API_KEY for authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate using worker API key
    const apiKey = request.headers.get('X-Worker-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    // Support both WORKER_API_KEY and ACCESS_SERVER_API_KEY to ease migration
    const expectedApiKey = process.env.WORKER_API_KEY || process.env.ACCESS_SERVER_API_KEY;

    if (!process.env.WORKER_API_KEY && process.env.ACCESS_SERVER_API_KEY) {
      console.log('ℹ️ Using ACCESS_SERVER_API_KEY as the worker API key (fallback)');
    }

    if (!expectedApiKey) {
      console.error('❌ WORKER_API_KEY not configured in main app environment');
      return NextResponse.json(
        { error: 'Worker API key not configured on server' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      console.error('❌ No API key provided in request headers');
      return NextResponse.json(
        { error: 'Unauthorized: Missing API key. Provide X-Worker-API-Key header' },
        { status: 401 }
      );
    }

    // Compare keys (trim to handle whitespace issues)
    const trimmedApiKey = apiKey.trim();
    const trimmedExpectedKey = expectedApiKey.trim();

    if (trimmedApiKey !== trimmedExpectedKey) {
      console.error('❌ API key mismatch:', {
        provided: trimmedApiKey.substring(0, 8) + '...',
        expected: trimmedExpectedKey.substring(0, 8) + '...',
        providedLength: trimmedApiKey.length,
        expectedLength: trimmedExpectedKey.length
      });
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key. Keys do not match.' },
        { status: 401 }
      );
    }

    // Get hostname from query parameter
    const { searchParams } = new URL(request.url);
    const hostname = searchParams.get('hostname');

    if (!hostname) {
      return NextResponse.json(
        { error: 'hostname parameter is required' },
        { status: 400 }
      );
    }

    // Extract domain from hostname (remove www. prefix if present)
    const domain = hostname.replace(/^www\./, '');

    // Find project by domain name
    const project = await prisma.project.findFirst({
      where: {
        name: domain,
      },
      include: {
        user: {
          include: {
            cloudflareToken: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: `Project not found for domain: ${domain}` },
        { status: 404 }
      );
    }

    if (!project.zoneId) {
      return NextResponse.json(
        { error: `Zone ID not found for project: ${domain}` },
        { status: 404 }
      );
    }

    const tokenRecord = project.user?.cloudflareToken && project.user.cloudflareToken.isActive
      ? project.user.cloudflareToken
      : null;
    if (!tokenRecord) {
      return NextResponse.json(
        { error: `Cloudflare token not found for project owner` },
        { status: 404 }
      );
    }

    // Decrypt token
    let cloudflareToken: string;
    try {
      cloudflareToken = decryptToken(tokenRecord.encryptedToken);
    } catch (decryptError) {
      console.error('Token decryption error:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt Cloudflare token' },
        { status: 500 }
      );
    }

    // Return configuration
    return NextResponse.json({
      success: true,
      domain: project.name,
      zoneId: project.zoneId,
      cloudflareToken: cloudflareToken,
      projectId: project.id,
      originUrl: project.websiteUrl || `https://${project.name}`,
    });
  } catch (error) {
    console.error('Worker config API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
