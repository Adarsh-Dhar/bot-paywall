import { auth } from '@/lib/mock-auth';
import { NextRequest, NextResponse } from 'next/server';

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

    // TODO: Save domain to database (Prisma)
    // For now, just return success
    console.log(`Domain ${domain} added for user ${userId}`);

    return NextResponse.json(
      {
        success: true,
        domain,
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
