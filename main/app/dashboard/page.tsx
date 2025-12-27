'use client';

/**
 * Dashboard Page
 * Displays all user projects in a grid layout
 * Requirements: 6.1, 6.2
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';

export default function DashboardPage() {
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkTokenStatus();
  }, []);

  async function checkTokenStatus() {
    try {
      setLoading(true);
      const token = await getUserCloudflareToken();
      setHasToken(!!token);
    } catch (error) {
      console.error('Failed to check token status:', error);
      setHasToken(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Gatekeeper</h1>
          <p className="text-slate-600 mt-2">Bot Firewall Protection</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-slate-600">Loading...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8">
            {hasToken ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Cloudflare Connected</h2>
                <p className="text-slate-600 mb-6">
                  Your Cloudflare API token is connected and ready to use.
                </p>
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3">What&apos;s Next?</h3>
                  <p className="text-slate-600 text-sm mb-4">
                    Your Gatekeeper bot firewall is now ready to protect your domains. 
                    The system will automatically detect and challenge bot traffic while allowing legitimate users through.
                  </p>
                  <button
                    onClick={() => router.push('/verify-token')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                  >
                    Verify Token & Lookup Zones
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Connect Cloudflare</h2>
                <p className="text-slate-600 mb-6">
                  Connect your Cloudflare account to start protecting your domains with Gatekeeper.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/connect-cloudflare')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Connect Cloudflare Account
                  </button>
                  <button
                    onClick={() => router.push('/verify-token')}
                    className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                  >
                    Verify Token & Lookup Zones
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
