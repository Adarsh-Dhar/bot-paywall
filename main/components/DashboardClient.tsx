'use client';

import { useRouter } from 'next/navigation';
import CloudflareConnectionStatus from '@/components/CloudflareConnectionStatus';
import ZoneStatusDisplay from '@/components/ZoneStatusDisplay';
import TokenVerificationStatus from '@/components/TokenVerificationStatus';

const codePreview = String.raw`// Gatekeeper WAF Rule
const rule = {
  description: "Gatekeeper: Block Bad Bots, Allow VIPs",
  expression: "(cf.client.bot or http.user_agent contains \"curl\" or http.user_agent contains \"python\") and (http.request.headers[\"x-bot-password\"][0] ne \"YOUR_SECRET_KEY\")",
  action: "managed_challenge",
  enabled: true
};`;

const botAttempts: Array<{ domain: string; botType: string; time: string; action: string }> = [];
const blockedAttempts: Array<{ source: string; reason: string; time: string }> = [];
const deploymentLogs: string[] = [];

interface ProtectedDomain {
  id: string;
  name: string;
  status: string;
  nameservers: string;
  lastUpdated: string;
  websiteUrl?: string | null;
  requestsCount: number;
}

interface DashboardClientProps {
  protectedDomains: ProtectedDomain[];
  totalDomains: number;
  threatsBlocked: number;
}

export default function DashboardClient({ 
  protectedDomains, 
  totalDomains, 
  threatsBlocked 
}: DashboardClientProps) {
  const router = useRouter();

  const handleSignIn = () => {
    router.push('/sign-in');
  };

  const handleConnectCloudflare = () => {
    router.push('/connect-cloudflare');
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-10">
        <aside className="sticky top-10 hidden h-[calc(100vh-80px)] w-64 shrink-0 lg:block">
          {/*<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur card-surface">*/}
          {/*  <div className="glow" />*/}
          {/*  <div className="relative space-y-6">*/}
          {/*    <div className="flex items-center gap-3">*/}
          {/*      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/15 text-lg font-semibold text-[#f5c518]">*/}
          {/*        GK*/}
          {/*      </div>*/}
          {/*      <div>*/}
          {/*        <p className="text-sm text-zinc-400">Gatekeeper</p>*/}
          {/*        <p className="text-lg font-semibold">Bot Firewall</p>*/}
          {/*      </div>*/}
          {/*    </div>*/}
          {/*    <div className="divider" />*/}

          {/*  </div>*/}
          {/*</div>*/}
        </aside>

        <main className="flex-1 space-y-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-400">Gatekeeper · Bot Firewall</p>
              <h1 className="text-3xl font-semibold text-white">Protection Dashboard</h1>
              <p className="text-sm text-zinc-500">
                {totalDomains} domains protected • {threatsBlocked} threats blocked today
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => router.push('/domains')}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-400/25"
              >
                Manage Domains
              </button>
              <button onClick={handleConnectCloudflare} className="rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
                Connect Cloudflare
              </button>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Getting Started</p>
                  <h2 className="mt-2 text-xl font-semibold">Sign In & Setup</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Connect your Cloudflare account to get started.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                  Secure by design
                </span>
              </div>
              <div className="mt-6">
                <CloudflareConnectionStatus />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <div className="glow" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Protection Stats</p>
                  <h2 className="mt-2 text-xl font-semibold">Threats & Domains</h2>
                  <p className="mt-1 text-sm text-zinc-400">Real-time protection metrics</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Live
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#121420] p-4 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Threats Blocked</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{threatsBlocked}</p>
                  <p className="mt-1 text-xs text-emerald-400">All systems normal</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121420] p-4 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Protected Domains</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{totalDomains}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {totalDomains === 0 ? 'Add your first domain' : 'Domains active'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <TokenVerificationStatus />

          {/* Connected Domains Section */}
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 card-surface">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Protected Domains</p>
                <h3 className="text-lg font-semibold text-white">Connected Domains</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {protectedDomains.length > 0 
                    ? `${protectedDomains.length} domain${protectedDomains.length !== 1 ? 's' : ''} connected`
                    : 'No domains connected yet'}
                </p>
              </div>
              <button 
                onClick={() => router.push('/domains')}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-400/25"
              >
                {protectedDomains.length > 0 ? 'Manage' : 'Add Domain'}
              </button>
            </div>
            <div className="p-6">
              {protectedDomains.length > 0 ? (
                <div className="space-y-3">
                  {protectedDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/15">
                          <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{domain.name}</p>
                          <p className="text-xs text-zinc-400">
                            {domain.websiteUrl ? domain.websiteUrl : 'No website URL'}
                            {domain.requestsCount > 0 && ` • ${domain.requestsCount} requests`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          domain.status === 'PROTECTED' || domain.status === 'Active' 
                            ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                            : domain.status === 'PENDING_NS'
                            ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                            : 'bg-zinc-400/20 text-zinc-400 border border-zinc-400/30'
                        }`}>
                          {domain.status}
                        </span>
                        <button
                          onClick={() => router.push(`/domains`)}
                          className="text-zinc-400 hover:text-white transition-colors"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 mb-4">
                    <svg className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">No domains connected</p>
                  <p className="text-xs text-zinc-400 mb-4">
                    Connect your first domain to start protecting it with Gatekeeper
                  </p>
                  <button
                    onClick={() => router.push('/domains')}
                    className="rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25"
                  >
                    Add Your First Domain
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <ZoneStatusDisplay />
          </section>
        </main>
      </div>
    </div>
  );
}