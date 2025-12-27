import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authFromRequest } from '@/lib/auth-edge';

// Public routes that don't require authentication
const publicRoutes = [
  '/sign-in',
  '/sign-up',
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/auth/refresh',
  '/api/health',
  '/api/worker/config',
  '/api/projects/public'
];

// Check if a path is public
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug: Log all requests in development
  if (process.env.NODE_ENV === 'development') {
    const allCookies = Array.from(request.cookies.getAll());
    console.log(`[Middleware] ${request.method} ${pathname}`, {
      cookieCount: allCookies.length,
      cookieNames: allCookies.map(c => c.name),
      hasAccessToken: !!request.cookies.get('access_token'),
    });
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // For API routes, check authentication
  if (pathname.startsWith('/api/')) {
    const authResult = await authFromRequest(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add user info to request headers for downstream handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', authResult.userId);
    requestHeaders.set('x-user-email', authResult.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For page routes, check authentication and redirect if needed
  const authResult = await authFromRequest(request);

  if (!authResult) {
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] No auth result for path:', pathname);
      console.log('[Middleware] Cookies:', Array.from(request.cookies.getAll()).map(c => ({ name: c.name, hasValue: !!c.value })));
    }
    
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware] Auth successful for path:', pathname, 'userId:', authResult.userId);
  }

  // Add user info to request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', authResult.userId);
  requestHeaders.set('x-user-email', authResult.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

