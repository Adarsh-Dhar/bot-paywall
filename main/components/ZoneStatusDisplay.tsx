'use client';

import { useState, useEffect } from 'react';
import { lookupZoneId, type ZoneLookupResult } from '@/app/actions/cloudflare-token-verification';

interface ZoneStatusDisplayProps {
  domain?: string;
  autoLookup?: boolean;
}

export default function ZoneStatusDisplay({ domain, autoLookup = false }: ZoneStatusDisplayProps) {
  const [zoneResult, setZoneResult] = useState<ZoneLookupResult | null>(null);
  const [inputDomain, setInputDomain] = useState(domain || '');
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (autoLookup && domain) {
      handleLookupZone(domain);
    }
  }, [domain, autoLookup]);

  const handleLookupZone = async (domainToLookup?: string) => {
    const targetDomain = domainToLookup || inputDomain.trim();
    
    if (!targetDomain) {
      setZoneResult({
        success: false,
        message: 'Please enter a domain name',
        error: 'VALIDATION_ERROR',
      });
      return;
    }

    setIsLookingUp(true);
    try {
      const result = await lookupZoneId(targetDomain);
      setZoneResult(result);
    } catch (error) {
      setZoneResult({
        success: false,
        message: 'Failed to lookup zone',
        error: 'UNKNOWN_ERROR',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Zone Lookup</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Domain Zone Information</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Find Zone IDs for WAF rule deployment
          </p>
        </div>
      </div>

      {!autoLookup && (
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={inputDomain}
            onChange={(e) => setInputDomain(e.target.value)}
            placeholder="Enter domain (e.g., example.com)"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/50 focus:border-[#f5c518]/50"
            onKeyPress={(e) => e.key === 'Enter' && handleLookupZone()}
          />
          <button
            onClick={() => handleLookupZone()}
            disabled={isLookingUp || !inputDomain.trim()}
            className="px-4 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-lg hover:bg-[#f5c518]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLookingUp ? 'Looking up...' : 'Lookup Zone'}
          </button>
        </div>
      )}

      {zoneResult && (
        <div className={`rounded-xl border p-4 ${
          zoneResult.success 
            ? 'border-emerald-400/40 bg-emerald-400/10' 
            : 'border-red-400/40 bg-red-400/10'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={`text-sm mb-2 ${zoneResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                {zoneResult.message}
              </p>
              
              {zoneResult.success && zoneResult.zoneId && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-300 mb-1">Zone ID:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-white/10 border border-white/20 px-2 py-1 rounded flex-1 text-white">
                          {zoneResult.zoneId}
                        </code>
                        <button
                          onClick={() => copyToClipboard(zoneResult.zoneId!)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors"
                          title="Copy Zone ID"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-zinc-300 mb-1">Zone Status:</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        zoneResult.status === 'active' 
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' 
                          : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                      }`}>
                        {zoneResult.status}
                      </span>
                    </div>
                  </div>

                  {zoneResult.nameservers && zoneResult.nameservers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-zinc-300 mb-2">Nameservers:</p>
                      <div className="space-y-1">
                        {zoneResult.nameservers.map((ns, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono bg-white/10 border border-white/20 px-2 py-1 rounded text-white">
                              {ns}
                            </code>
                            <button
                              onClick={() => copyToClipboard(ns)}
                              className="p-1 text-zinc-400 hover:text-white transition-colors"
                              title="Copy Nameserver"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="ml-4">
              {zoneResult.success ? (
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      )}

      {!zoneResult && !autoLookup && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">Enter a domain to lookup its Zone ID</p>
        </div>
      )}
    </div>
  );
}