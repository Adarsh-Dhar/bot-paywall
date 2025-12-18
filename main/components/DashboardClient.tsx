'use client';

import { useRouter } from 'next/navigation';
import CloudflareConnectionStatus from '@/components/CloudflareConnectionStatus';

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
const navItems = ["Dashboard", "Domains", "Protection", "Analytics", "Settings"];

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

  const handleAddDomain = () => {
    router.push('/domains/add');
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-10">
        <aside className="sticky top-10 hidden h-[calc(100vh-80px)] w-64 shrink-0 lg:block">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur card-surface">
            <div className="glow" />
            <div className="relative space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/15 text-lg font-semibold text-[#f5c518]">
                  GK
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Gatekeeper</p>
                  <p className="text-lg font-semibold">Bot Firewall</p>
                </div>
              </div>
              <div className="divider" />
              <nav className="space-y-2">
                {navItems.map((item, idx) => (
                  <div
                    key={item}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      idx === 0
                        ? "bg-white/10 text-white border border-white/10"
                        : "hover:bg-white/5 text-zinc-300"
                    }`}
                  >
                    <span>{item}</span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5c518]">
                        Live
                      </span>
                    )}
                  </div>
                ))}
              </nav>
              <div className="divider" />
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                <p className="font-semibold text-white">Add Domain</p>
                <p className="mt-1 text-zinc-400">
                  Protect your domain with intelligent bot detection in minutes.
                </p>
                <button onClick={handleAddDomain} className="mt-4 w-full rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-3 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
                  Get Started
                </button>
              </div>
            </div>
          </div>
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
              <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Documentation
              </button>
              <button onClick={handleAddDomain} className="rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
                Add Domain
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
                    Authenticate and connect your Cloudflare account.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                  Secure by design
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white">
                  <div>
                    <p>Authentication</p>
                    <p className="text-xs font-normal text-zinc-400">Mock Auth Active</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
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

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 card-surface">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Protected Domains</p>
                <h3 className="text-lg font-semibold text-white">Your protected domains</h3>
              </div>
              <button onClick={handleAddDomain} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                + Add Domain
              </button>
            </div>
            {protectedDomains.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-sm text-zinc-400">No domains added yet</p>
                <p className="mt-1 text-xs text-zinc-500">Add your first domain to get started with bot protection</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-zinc-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Domain</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Nameservers</th>
                      <th className="px-6 py-3 font-medium">Requests</th>
                      <th className="px-6 py-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {protectedDomains.map((domain) => (
                      <tr key={domain.id} className="hover:bg-white/5">
                        <td className="px-6 py-4 font-semibold text-white">{domain.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              domain.status === "Active"
                                ? "bg-emerald-400/15 text-emerald-300"
                                : "bg-amber-400/15 text-amber-200"
                            }`}
                          >
                            {domain.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">{domain.nameservers}</td>
                        <td className="px-6 py-4 text-zinc-200">{domain.requestsCount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-zinc-400">{domain.lastUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}