'use client';

/**
 * Cloudflare Token Verification Component
 * Displays token verification status and zone ID lookup functionality
 */

import { useState } from 'react';
import { verifyCloudflareToken, lookupZoneId, TokenVerificationResult, ZoneLookupResult } from '@/app/actions/cloudflare-token-verification';

export default function CloudflareTokenVerification() {
  const [tokenResult, setTokenResult] = useState<TokenVerificationResult | null>(null);
  const [zoneResult, setZoneResult] = useState<ZoneLookupResult | null>(null);
  const [domain, setDomain] = useState('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isLookingUpZone, setIsLookingUpZone] = useState(false);

  const handleVerifyToken = async () => {
    setIsVerifyingToken(true);
    try {
      const result = await verifyCloudflareToken();
      setTokenResult(result);
    } catch (error) {
      setTokenResult({
        success: false,
        message: 'Failed to verify token',
        error: 'UNKNOWN_ERROR',
      });
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleLookupZone = async () => {
    if (!domain.trim()) {
      setZoneResult({
        success: false,
        message: 'Please enter a domain name',
        error: 'VALIDATION_ERROR',
      });
      return;
    }

    setIsLookingUpZone(true);
    try {
      const result = await lookupZoneId(domain.trim());
      setZoneResult(result);
    } catch (error) {
      setZoneResult({
        success: false,
        message: 'Failed to lookup zone',
        error: 'UNKNOWN_ERROR',
      });
    } finally {
      setIsLookingUpZone(false);
    }
  };

  const getStatusColor = (success: boolean, status?: string) => {
    if (!success) return 'text-red-600 bg-red-50 border-red-200';
    if (status === 'active') return 'text-green-600 bg-green-50 border-green-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="space-y-6">
      {/* Phase 1: Token Verification */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Phase 1: Token Verification</h3>
            <p className="text-sm text-slate-600">
              Verify that your Cloudflare API token is active and has the correct permissions
            </p>
          </div>
          <button
            onClick={handleVerifyToken}
            disabled={isVerifyingToken}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifyingToken ? 'Verifying...' : 'Verify Token'}
          </button>
        </div>

        {tokenResult && (
          <div className={`p-4 rounded-lg border ${getStatusColor(tokenResult.success, tokenResult.status)}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    tokenResult.success && tokenResult.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {tokenResult.status || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm mb-2">{tokenResult.message}</p>
                
                {tokenResult.permissions && tokenResult.permissions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">Token Permissions:</p>
                    <div className="space-y-1">
                      {tokenResult.permissions.map((permission, index) => (
                        <div key={index} className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                          {permission}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ml-4">
                {tokenResult.success ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 2: Zone ID Lookup */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Phase 2: Zone ID Lookup</h3>
          <p className="text-sm text-slate-600">
            Find the Zone ID for your domain (required for WAF rule deployment)
          </p>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g., example.com)"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleLookupZone()}
          />
          <button
            onClick={handleLookupZone}
            disabled={isLookingUpZone || !domain.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLookingUpZone ? 'Looking up...' : 'Lookup Zone'}
          </button>
        </div>

        {zoneResult && (
          <div className={`p-4 rounded-lg border ${getStatusColor(zoneResult.success)}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm mb-2">{zoneResult.message}</p>
                
                {zoneResult.success && zoneResult.zoneId && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Zone ID:</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded flex-1">
                            {zoneResult.zoneId}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(zoneResult.zoneId!)}
                            className="p-1 text-slate-500 hover:text-slate-700"
                            title="Copy Zone ID"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-slate-700">Zone Status:</p>
                        <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                          zoneResult.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {zoneResult.status}
                        </span>
                      </div>
                    </div>

                    {zoneResult.nameservers && zoneResult.nameservers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">Nameservers:</p>
                        <div className="space-y-1">
                          {zoneResult.nameservers.map((ns, index) => (
                            <code key={index} className="block text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                              {ns}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="ml-4">
                {zoneResult.success ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps */}
      {tokenResult?.success && zoneResult?.success && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Ready for WAF Rule Deployment</h4>
              <p className="text-sm text-blue-700">
                Your token is verified and zone ID is found. You can now deploy WAF skip rules using:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• <strong>Domain:</strong> {zoneResult.zoneName}</li>
                <li>• <strong>Zone ID:</strong> {zoneResult.zoneId}</li>
                <li>• <strong>Token Status:</strong> {tokenResult.status}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}