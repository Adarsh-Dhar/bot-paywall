'use client';

import { useRouter } from 'next/navigation';
import { MOCK_USER_EMAIL } from '@/lib/mock-auth';

export default function SignInPage() {
  const router = useRouter();

  const handleMockSignIn = () => {
    // Just redirect to home - no real authentication
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Mock Sign In</h1>
          <p className="mt-2 text-sm text-zinc-400">Gatekeeper Bot Firewall - Testing Mode</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
            <p className="font-semibold">Testing Mode</p>
            <p>No authentication required. Mock user: {MOCK_USER_EMAIL}</p>
          </div>

          <button
            onClick={handleMockSignIn}
            className="w-full rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/20 px-4 py-3 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]"
          >
            Continue as Test User
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Don't have an account?{' '}
          <a href="/sign-up" className="text-[#f5c518] hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
