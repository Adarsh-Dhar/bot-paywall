'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveCloudflareToken,
  getUserCloudflareTokenInfo,
  removeCloudflareToken,
  type UserCloudflareToken,
} from '@/app/actions/cloudflare-tokens';

export default function ConnectCloudflarePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingToken, setExistingToken] = useState<UserCloudflareToken | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    loadTokenInfo();
  }, []);

  async function loadTokenInfo() {
    setLoadingInfo(true);
    const info = await getUserCloudflareTokenInfo();
    setExistingToken(info);
    setLoadingInfo(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!token.trim()) {
      setError('Please enter your Cloudflare API token');
      return;
    }

    // Basic token format validation - Cloudflare tokens are typically 40+ characters
    if (token.length < 20) {
      setError('Token appears too short. Please enter a valid Cloudflare API token.');
      return;
    }

    try {
      setLoading(true);
      const result = await saveCloudflareToken(token);

      if (!result.success) {
        setError(result.error || 'Failed to save token');
        return;
      }

      setSuccess(true);
      setToken('');
      await loadTokenInfo();
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveToken() {
    if (!confirm('Are you sure you want to disconnect your Cloudflare account?')) {
      return;
    }

    setLoading(true);
    const result = await removeCloudflareToken();
    
    if (result.success) {
      setExistingToken(null);
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to remove token');
    }
    setLoading(false);
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#f5c518]/20 border-t-[#f5c518] mx-auto" />
          <div className="text-zinc-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Connect Your Cloudflare Account
          </h1>
          <p className="text-zinc-400">
            To protect your domains, we need access to your Cloudflare account via an API token
          </p>
        </div>

        {/* Existing Token Info */}
        {existingToken && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-300 mb-2">
                  ✓ Connected to Cloudflare
                </h3>
                <div className="space-y-1 text-sm text-emerald-200">
                  <p><strong>Token Name:</strong> {existingToken.tokenName || 'N/A'}</p>
                  <p><strong>Account ID:</strong> {existingToken.accountId || 'N/A'}</p>
                  <p><strong>Last Verified:</strong> {existingToken.lastVerified ? new Date(existingToken.lastVerified).toLocaleString() : 'Never'}</p>
                </div>
              </div>
              <button
                onClick={handleRemoveToken}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-8 backdrop-blur">
          <h2 className="text-xl font-semibold text-white mb-4">
            Step 1: Create a Cloudflare API Token
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                1
              </div>
              <div className="flex-1">
                <p className="text-zinc-300 mb-2">
                  Click the button below to open Cloudflare's API token creation page:
                </p>
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Create API Token
                </a>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                2
              </div>
              <div className="flex-1">
                <p className="text-zinc-300 mb-2">
                  Select <strong>"Create Custom Token"</strong> and configure these <strong>minimum required</strong> permissions:
                </p>
                <div className="bg-black/30 rounded-md p-4 space-y-2 text-sm font-mono">
                  <div className="flex items-center">
                    <span className="text-zinc-400 w-32">Zone</span>
                    <span className="text-zinc-500 mx-2">→</span>
                    <span className="text-zinc-300">Zone</span>
                    <span className="text-zinc-500 mx-2">→</span>
                    <span className="text-emerald-400 font-semibold">Read</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-zinc-400 w-32">Zone</span>
                    <span className="text-zinc-500 mx-2">→</span>
                    <span className="text-zinc-300">Zone</span>
                    <span className="text-zinc-500 mx-2">→</span>
                    <span className="text-emerald-400 font-semibold">Edit</span>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm mt-2">
                  Note: Make sure "Zone Resources" is set to <strong>"Include → All zones"</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                3
              </div>
              <div className="flex-1">
                <p className="text-zinc-300">
                  Click <strong>"Continue to summary"</strong> then <strong>"Create Token"</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                4
              </div>
              <div className="flex-1">
                <p className="text-zinc-300">
                  Copy the token (it will be a long string like <code className="bg-black/30 px-1 rounded text-[#f5c518]">PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso</code>) and paste it below
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Token Input Form */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold text-white mb-4">
            Step 2: Paste Your API Token
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-white mb-2">
                Cloudflare API Token
              </label>
              <input
                type="password"
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso"
                className="w-full px-4 py-2 border border-white/20 bg-white/5 text-white rounded-md focus:ring-2 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/60 placeholder-zinc-500"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-zinc-400">
                Your token is encrypted and stored securely. We never share it with anyone.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-4">
                <p className="text-sm text-emerald-300">
                  ✓ Token saved successfully! Redirecting to dashboard...
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !token.trim()}
                className="flex-1 px-6 py-3 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Verifying...' : existingToken ? 'Update Token' : 'Connect Cloudflare'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-white/10 text-zinc-300 rounded-md hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Security Notice */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-300 mb-1">Security & Privacy</h3>
              <p className="text-sm text-blue-200">
                Your API token is encrypted using AES-256-CBC encryption before being stored in our database. 
                We only use it to manage your domains and never share it with third parties. 
                You can disconnect at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}