'use client';

import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Header */}
        <header className="mb-16">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 tracking-tight">Gatekeeper</h1>
              <p className="mt-3 text-lg text-gray-600">
                Bot Firewall Dashboard
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={handleConnectCloudflare} 
                className="rounded-lg border-2 border-yellow-400 bg-yellow-400 px-8 py-3 text-sm font-semibold text-gray-900 shadow-md transition hover:bg-yellow-500 hover:shadow-lg"
              >
                + Connect Cloudflare
              </button>
            </div>
          </div>
        </header>

        {/* Protected Domains Section */}
        <section className="mb-12 rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-8">
            <div className="mb-4">
              <span className="inline-block rounded-full bg-yellow-200 px-4 py-1 text-xs font-bold text-yellow-900 uppercase tracking-wider">Protected Domains</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Connected Domains</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {protectedDomains.length > 0 
                    ? `${protectedDomains.length} domain${protectedDomains.length !== 1 ? 's' : ''} connected`
                    : 'No domains connected yet'}
                </p>
              </div>
            </div>
          </div>

          {protectedDomains.length > 0 ? (
            <div className="space-y-3">
              {protectedDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between rounded-xl border-2 border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50 px-6 py-5 transition hover:border-yellow-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-300 to-yellow-400">
                      <svg className="h-6 w-6 text-gray-900 font-bold" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm0 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{domain.name}</p>
                      <p className="text-sm text-gray-600">
                        {domain.websiteUrl ? domain.websiteUrl : 'No website URL'}
                        {domain.requestsCount > 0 && ` • ${domain.requestsCount} requests`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`rounded-full px-4 py-1 text-sm font-bold ${
                      domain.status === 'PROTECTED' || domain.status === 'Active' 
                        ? 'bg-yellow-200 text-yellow-900'
                        : domain.status === 'PENDING_NS'
                        ? 'bg-orange-200 text-orange-900'
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {domain.status}
                    </span>
                    <button
                      onClick={() => router.push(`/connect-cloudflare`)}
                      className="text-gray-400 transition hover:text-gray-600"
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 mb-4">
                <svg className="h-10 w-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6V0m0 12v6m6-6h6m0 0h6" />
                </svg>
              </div>
              <p className="font-bold text-gray-900 mb-2 text-lg">No domains connected</p>
              <p className="text-sm text-gray-600 mb-6">
                Connect your first domain to start protecting it with Gatekeeper
              </p>
              <button
                onClick={() => router.push('/connect-cloudflare')}
                className="rounded-lg border-2 border-yellow-400 bg-yellow-400 px-8 py-3 font-bold text-gray-900 transition hover:bg-yellow-500"
              >
                Add Your First Domain
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}