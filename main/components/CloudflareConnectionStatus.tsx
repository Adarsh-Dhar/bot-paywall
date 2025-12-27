'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUserCloudflareTokenInfo, type UserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { verifyCloudflareToken, type TokenVerificationResult } from '@/app/actions/cloudflare-token-verification';

export default function CloudflareConnectionStatus() {
  const router = useRouter();
  const [tokenInfo, setTokenInfo] = useState<UserCloudflareToken | null>(null);
  const [verificationResult, setVerificationResult] = useState<TokenVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTokenInfo = useCallback(async () => {
    setLoading(true);
    const info = await getUserCloudflareTokenInfo();
    setTokenInfo(info);
    
    // If we have a token, verify it
    if (info) {
      try {
        const verification = await verifyCloudflareToken();
        setVerificationResult(verification);
      } catch (error) {
        console.error('Token verification failed:', error);
        setVerificationResult({
          success: false,
          message: 'Verification failed',
          error: 'UNKNOWN_ERROR'
        });
      }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTokenInfo();
  }, [loadTokenInfo]);

  const handleConnect = () => {
    router.push('/connect-cloudflare');
  };

  const handleVerifyToken = () => {
    router.push('/verify-token');
  };

  if (loading) {
    return (
      <button className="flex items-center justify-between rounded-xl border border-[#f5c518]/40 bg-[#f5c518]/15 px-4 py-3 text-left text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
        <div>
          <p>Connect Cloudflare</p>
          <p className="text-xs font-normal text-[#f5c518]/90">Loading...</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-gray-400" />
      </button>
    );
  }

  if (tokenInfo && verificationResult) {
    const isActive = verificationResult.success && verificationResult.status === 'active';
    
    return (
      <button 
        onClick={handleVerifyToken}
        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
          isActive 
            ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300 hover:border-emerald-400'
            : 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300 hover:border-yellow-400'
        }`}
      >
        <div>
          <p>{isActive ? '✓ Token Verified' : '⚠ Token Issues'}</p>
          <p className={`text-xs font-normal ${isActive ? 'text-emerald-300/90' : 'text-yellow-300/90'}`}>
            {isActive ? `Status: ${verificationResult.status}` : verificationResult.message}
          </p>
        </div>
        <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
      </button>
    );
  }

  if (tokenInfo) {
    return (
      <button 
        onClick={handleVerifyToken}
        className="flex items-center justify-between rounded-xl border border-blue-400/40 bg-blue-400/15 px-4 py-3 text-left text-sm font-semibold text-blue-300 transition hover:-translate-y-0.5 hover:border-blue-400"
      >
        <div>
          <p>✓ Cloudflare Connected</p>
          <p className="text-xs font-normal text-blue-300/90">
            Click to verify & lookup zones
          </p>
        </div>
        <span className="h-2 w-2 rounded-full bg-blue-400" />
      </button>
    );
  }

  return (
    <button 
      onClick={handleConnect}
      className="flex items-center justify-between rounded-xl border border-[#f5c518]/40 bg-[#f5c518]/15 px-4 py-3 text-left text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]"
    >
      <div>
        <p>Connect Cloudflare</p>
        <p className="text-xs font-normal text-[#f5c518]/90">API Token Required</p>
      </div>
      <span className="h-2 w-2 rounded-full bg-red-400" />
    </button>
  );
}