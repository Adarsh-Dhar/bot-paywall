'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyCloudflareToken, type TokenVerificationResult } from '@/app/actions/cloudflare-token-verification';
import { getUserCloudflareTokenInfo } from '@/app/actions/cloudflare-tokens';

export default function TokenVerificationStatus() {
  const router = useRouter();
  const [verificationResult, setVerificationResult] = useState<TokenVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    setLoading(true);
    try {
      // First check if we have a token
      const tokenInfo = await getUserCloudflareTokenInfo();
      if (tokenInfo) {
        // If we have a token, verify it
        const verification = await verifyCloudflareToken();
        setVerificationResult(verification);
      } else {
        setVerificationResult({
          success: false,
          message: 'No Cloudflare API token found',
          error: 'NO_TOKEN'
        });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      setVerificationResult({
        success: false,
        message: 'Verification failed',
        error: 'UNKNOWN_ERROR'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyCloudflareToken();
      setVerificationResult(result);
    } catch (error) {
      setVerificationResult({
        success: false,
        message: 'Failed to verify token',
        error: 'UNKNOWN_ERROR',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoToVerification = () => {
    router.push('/verify-token');
  };

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="flex items-center justify-center py-8">
          <div className="text-zinc-400">Loading token status...</div>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    if (!verificationResult?.success) return 'border-red-400/40 bg-red-400/10';
    if (verificationResult.status === 'active') return 'border-emerald-400/40 bg-emerald-400/10';
    return 'border-yellow-400/40 bg-yellow-400/10';
  };

  const getStatusIcon = () => {
    if (!verificationResult?.success) {
      return (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (verificationResult.status === 'active') {
      return (
        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Token Status</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Cloudflare API Verification</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Current token status and permissions
          </p>
        </div>
        <button
          onClick={handleVerifyToken}
          disabled={isVerifying}
          className="px-4 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-lg hover:bg-[#f5c518]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          {isVerifying ? 'Verifying...' : 'Refresh Status'}
        </button>
      </div>

      {verificationResult && (
        <div className={`rounded-xl border p-4 ${getStatusColor()}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-white">Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  verificationResult.success && verificationResult.status === 'active' 
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' 
                    : 'bg-red-400/20 text-red-300 border border-red-400/40'
                }`}>
                  {verificationResult.status || 'Error'}
                </span>
              </div>
              <p className="text-sm mb-2 text-zinc-300">{verificationResult.message}</p>
              
              {verificationResult.permissions && verificationResult.permissions.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium mb-2 text-zinc-300">Token Permissions:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {verificationResult.permissions.slice(0, 3).map((permission, index) => (
                      <div key={index} className="text-xs font-mono bg-white/10 border border-white/20 px-2 py-1 rounded text-zinc-300">
                        {permission}
                      </div>
                    ))}
                    {verificationResult.permissions.length > 3 && (
                      <div className="text-xs text-zinc-400">
                        +{verificationResult.permissions.length - 3} more permissions
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleGoToVerification}
                  className="px-3 py-1 bg-white/10 border border-white/20 text-zinc-300 rounded text-xs hover:bg-white/20 transition-colors"
                >
                  Full Verification Page
                </button>
              </div>
            </div>
            
            <div className="ml-4">
              {getStatusIcon()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}