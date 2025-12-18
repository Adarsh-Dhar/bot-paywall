import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple middleware - no authentication required in testing mode
export function middleware(request: NextRequest) {
  // Just pass through all requests - no auth checks
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

