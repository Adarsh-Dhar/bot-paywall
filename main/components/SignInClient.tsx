// /components/SignInClient.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { clientTokenStorage } from '@/lib/token-storage';

export default function SignInClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies in request/response
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Sign in failed');
                setLoading(false);
                return;
            }

            // Store tokens in localStorage (for client-side API calls)
            if (data.accessToken && data.refreshToken) {
                clientTokenStorage.setTokens(data.accessToken, data.refreshToken);
            }

            // Redirect to home or the redirect URL
            // Use window.location for hard redirect to ensure cookies are sent with the request
            const redirect = searchParams?.get('redirect') || '/';
            window.location.href = redirect;
        } catch (err) {
            console.error('Sign in error:', err);
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-6">
            <div className="w-full max-w-md rounded-2xl border-2 border-gray-300 bg-white p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Gatekeeper</h1>
                    <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-100 p-4 text-sm font-medium text-red-900">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="mb-2 block text-sm font-bold text-gray-900">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-bold text-gray-900">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg border-2 border-yellow-400 bg-yellow-400 px-4 py-3 text-sm font-bold text-gray-900 transition hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                    Don&apos;t have an account?{' '}
                    <a href="/sign-up" className="font-bold text-yellow-600 hover:text-yellow-700">
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}
