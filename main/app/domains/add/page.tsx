'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser } from '@/lib/mock-auth';

export default function AddDomainPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    } else if (isLoaded && isSignedIn) {
      // Redirect to Cloudflare connection instead
      router.push('/connect-cloudflare');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-zinc-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#f5c518]/20 border-t-[#f5c518] mx-auto" />
          <p className="text-sm text-zinc-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return null;
}
