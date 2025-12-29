import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/token-encryption';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const apiKey = request.headers.get('X-Worker-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.WORKER_API_KEY || process.env.ACCESS_SERVER_API_KEY;

    if (!expectedApiKey || !apiKey || apiKey.trim() !== expectedApiKey.trim()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Hostname
    const { searchParams } = new URL(request.url);
    const hostname = searchParams.get('hostname');

    if (!hostname) {
      return NextResponse.json({ error: 'Hostname required' }, { status: 400 });
    }

    const cleanHostname = hostname.replace(/^www\./, '');
    console.log(`🔍 API: Searching for config for: ${cleanHostname}`);

    // 3. Smart Project Search
    let project = await prisma.project.findFirst({
      where: { name: cleanHostname },
      select: { id: true, name: true, zoneId: true, websiteUrl: true, api_keys: true }
    });

    if (!project) {
      console.log(`⚠️ API: No name match. Checking URL...`);
      project = await prisma.project.findFirst({
        where: { websiteUrl: { contains: cleanHostname } },
        select: { id: true, name: true, zoneId: true, websiteUrl: true, api_keys: true }
      });
    }

    if (!project) {
      const parts = cleanHostname.split('.');
      if (parts.length > 2) {
        const rootDomain = parts.slice(-2).join('.');
        project = await prisma.project.findFirst({
          where: { name: rootDomain },
          select: { id: true, name: true, zoneId: true, websiteUrl: true, api_keys: true }
        });
      }
    }

    // 4. Validate
    if (!project) {
      console.error(`❌ API: Project not found for ${cleanHostname}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.zoneId) {
      return NextResponse.json({ error: 'Zone ID missing in project' }, { status: 404 });
    }

    if (!project.api_keys) {
      console.error(`❌ API: Project ${project.name} has no api_keys configured`);
      return NextResponse.json({ error: 'Cloudflare token not found' }, { status: 404 });
    }

    // 5. Get Token (Handle both Encrypted and Plain Text)
    let cloudflareToken: string;
    try {
      // Attempt to decrypt
      cloudflareToken = decryptToken(project.api_keys);
    } catch (err: unknown) {
      // If decryption fails due to format, assume it is a plain text token (manual entry)
      if (err instanceof Error && (err.message === 'Invalid encrypted token format' || err.message.includes('format'))) {
        console.warn(`⚠️ API: Token for ${project.name} is not encrypted. Using as plain text.`);
        cloudflareToken = project.api_keys;
      } else {
        if (err instanceof Error) {
          console.error('Token decryption failed:', err);
        } else {
          console.error('Token decryption failed:', String(err));
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    // 6. Return Config
    console.log(`✅ API: Config found for ${project.name}`);

    return NextResponse.json({
      success: true,
      domain: project.name,
      zoneId: project.zoneId,
      cloudflareToken: cloudflareToken,
      projectId: project.id,
      originUrl: project.websiteUrl || `https://${project.name}`,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}