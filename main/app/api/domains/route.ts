import { auth } from '@/lib/mock-auth';
import { prisma } from '@/lib/prisma';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Please sign in to add a domain' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Get user's Cloudflare token
    const cloudflareToken = await getUserCloudflareToken();
    if (!cloudflareToken) {
      return NextResponse.json(
        { error: 'Please connect your Cloudflare account first' },
        { status: 400 }
      );
    }

    // Check if domain already exists
    const existingProject = await prisma.project.findFirst({
      where: {
        userId: userId,
        name: domain,
      },
    });

    if (existingProject) {
      return NextResponse.json(
        { error: 'Domain already exists in your account' },
        { status: 400 }
      );
    }

    // Create Cloudflare zone
    let zoneId = '';
    let nameservers: string[] = [];

    try {
      const zoneResponse = await fetch('https://api.cloudflare.com/client/v4/zones', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: domain,
          type: 'full',
        }),
      });

      if (zoneResponse.ok) {
        const zoneData = await zoneResponse.json();
        if (zoneData.success) {
          zoneId = zoneData.result.id;
          nameservers = zoneData.result.name_servers || [];
        } else {
          console.error('Cloudflare zone creation failed:', zoneData.errors);
        }
      }
    } catch (error) {
      console.error('Error creating Cloudflare zone:', error);
      // Continue without zone creation for now
    }

    // Generate secret key for the project
    const secretKey = crypto.randomBytes(32).toString('hex');

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { userId: userId },
      update: {},
      create: {
        userId: userId,
        email: 'test@example.com',
      },
    });

    // Save project to database
    const project = await prisma.project.create({
      data: {
        userId: userId,
        name: domain,
        websiteUrl: `https://${domain}`,
        zoneId: zoneId || null,
        nameservers: nameservers,
        status: zoneId ? 'PENDING_NS' : 'ERROR',
        secretKey: secretKey,
      },
    });

    return NextResponse.json(
      {
        success: true,
        project: {
          id: project.id,
          domain: project.name,
          zoneId: project.zoneId,
          nameservers: project.nameservers,
          status: project.status,
          secretKey: project.secretKey,
        },
        message: 'Domain added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
