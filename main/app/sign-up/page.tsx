'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { clientTokenStorage } from '@/lib/token-storage';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in request/response
        body: JSON.stringify({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Sign up failed');
        setLoading(false);
        return;
      }

      // Store tokens in localStorage (for client-side API calls)
      if (data.accessToken && data.refreshToken) {
        clientTokenStorage.setTokens(data.accessToken, data.refreshToken);
      }

      // Redirect to home or the redirect URL
      // Use window.location for hard redirect to ensure cookies are available
      const redirect = searchParams.get('redirect') || '/';
      window.location.href = redirect;
    } catch (err) {
      console.error('Sign up error:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Sign Up</h1>
          <p className="mt-2 text-sm text-zinc-400">Gatekeeper Bot Firewall</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-[#f5c518]/60 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/20"
              placeholder="you@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-zinc-300">
                First Name (optional)
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-[#f5c518]/60 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/20"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-zinc-300">
                Last Name (optional)
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-[#f5c518]/60 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/20"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-[#f5c518]/60 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/20"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-zinc-300">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-[#f5c518]/60 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/20"
              placeholder="Confirm your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/20 px-4 py-3 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <a href="/sign-in" className="text-[#f5c518] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
