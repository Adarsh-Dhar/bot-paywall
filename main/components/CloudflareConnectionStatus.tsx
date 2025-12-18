'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserCloudflareTokenInfo, type UserCloudflareToken } from '@/app/actions/cloudflare-tokens';

export default function CloudflareConnectionStatus() {
  const router = useRouter();
  const [tokenInfo, setTokenInfo] = useState<UserCloudflareToken | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenInfo();
  }, []);

  async function loadTokenInfo() {
    setLoading(true);
    const info = await getUserCloudflareTokenInfo();
    setTokenInfo(info);
    setLoading(false);
  }

  const handleConnect = () => {
    router.push('/connect-cloudflare');
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

  if (tokenInfo) {
    return (
      <button 
        onClick={handleConnect}
        className="flex items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-4 py-3 text-left text-sm font-semibold text-emerald-300 transition hover:-translate-y-0.5 hover:border-emerald-400"
      >
        <div>
          <p>✓ Cloudflare Connected</p>
          <p className="text-xs font-normal text-emerald-300/90">
            {tokenInfo.tokenName || 'API Token'}
          </p>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
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