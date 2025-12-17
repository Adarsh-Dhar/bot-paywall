/**
 * Debug utility for Gatekeeper setup
 * Run this to check if all environment variables and services are configured
 */

export function debugGatekeeperSetup() {
  const checks = {
    'Clerk Publishable Key': !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    'Clerk Secret Key': !!process.env.CLERK_SECRET_KEY,
    'Supabase URL': !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    'Supabase Anon Key': !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Supabase Service Role Key': !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Cloudflare API Token': !!process.env.CLOUDFLARE_API_TOKEN,
    'Cloudflare Account ID': !!process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  console.log('🔍 Gatekeeper Setup Debug Report');
  console.log('================================\n');

  let allConfigured = true;
  for (const [key, value] of Object.entries(checks)) {
    const status = value ? '✅' : '❌';
    console.log(`${status} ${key}`);
    if (!value) allConfigured = false;
  }

  console.log('\n================================');
  if (allConfigured) {
    console.log('✅ All environment variables are configured!');
  } else {
    console.log('❌ Some environment variables are missing.');
    console.log('See GATEKEEPER_SETUP.md for instructions.');
  }

  return allConfigured;
}

// Run on import if in development
if (process.env.NODE_ENV === 'development') {
  if (typeof window === 'undefined') {
    // Server-side only
    debugGatekeeperSetup();
  }
}
