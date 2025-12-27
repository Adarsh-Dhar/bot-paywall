import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/token-encryption';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-Worker-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.WORKER_API_KEY || process.env.ACCESS_SERVER_API_KEY;

    if (!expectedApiKey || !apiKey || apiKey.trim() !== expectedApiKey.trim()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hostname = searchParams.get('hostname');
    if (!hostname) {
      return NextResponse.json({ error: 'Hostname required' }, { status: 400 });
    }

    const cleanHostname = hostname.replace(/^www\./, '');
    console.log(`🔍 API: Searching for config for: ${cleanHostname}`);

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
        console.log(`⚠️ API: Checking root domain: ${rootDomain}`);
        project = await prisma.project.findFirst({
          where: { name: rootDomain },
          select: { id: true, name: true, zoneId: true, websiteUrl: true, api_keys: true }
        });
      }
    }

    if (!project) {
      console.error(`❌ API: Project not found for ${cleanHostname}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.zoneId) {
      return NextResponse.json({ error: 'Zone ID missing in project' }, { status: 404 });
    }

    if (!project.api_keys) {
      console.error(`❌ API: Project ${project.name} has no api_keys configured`);
      return NextResponse.json({ error: 'Cloudflare token not found in project api_keys' }, { status: 404 });
    }

    try {
      const decryptedToken = decryptToken(project.api_keys);
      console.log(`✅ API: Config found for ${project.name}`);

      return NextResponse.json({
        success: true,
        domain: project.name,
        zoneId: project.zoneId,
        cloudflareToken: decryptedToken,
        projectId: project.id,
        originUrl: project.websiteUrl || `https://${project.name}`,
      });
    } catch (err) {
      console.error('Token decryption failed:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
