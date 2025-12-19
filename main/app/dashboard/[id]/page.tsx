'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main dashboard since we no longer have individual project pages
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-slate-600">Redirecting to dashboard...</div>
    </div>
  );
}
