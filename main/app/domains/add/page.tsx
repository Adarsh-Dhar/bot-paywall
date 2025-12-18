'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/mock-auth';

export default function AddDomainPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add domain');
      }

      setSuccess('Domain added successfully! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setError(message);
      console.error('Error adding domain:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-zinc-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#f5c518]/20 border-t-[#f5c518] mx-auto" />
          <p className="text-sm text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 card-surface">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white">Add Domain</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Protect your domain with Gatekeeper Bot Firewall
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-white">
                Domain Name
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 transition focus:border-[#f5c518]/60 focus:outline-none focus:ring-1 focus:ring-[#f5c518]/40"
              />
              <p className="mt-2 text-xs text-zinc-400">
                Enter your domain without www or protocol (e.g., example.com)
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Next Steps</p>
              <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5c518]/20 text-xs font-semibold text-[#f5c518]">
                    1
                  </span>
                  <span>Update your domain nameservers to Cloudflare</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5c518]/20 text-xs font-semibold text-[#f5c518]">
                    2
                  </span>
                  <span>Verify nameserver propagation</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5c518]/20 text-xs font-semibold text-[#f5c518]">
                    3
                  </span>
                  <span>Deploy WAF rules automatically</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!domain.trim() || loading}
                className="flex-1 rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/20 px-4 py-3 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
