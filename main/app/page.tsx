const codePreview = String.raw`// Gatekeeper WAF Rule
const rule = {
  description: "Gatekeeper: Block Bad Bots, Allow VIPs",
  expression: "(cf.client.bot or http.user_agent contains \"curl\" or http.user_agent contains \"python\") and (http.request.headers[\"x-bot-password\"][0] ne \"YOUR_SECRET_KEY\")",
  action: "managed_challenge",
  enabled: true
};`;

const protectedDomains: Array<{ name: string; status: string; nameservers: string; lastUpdated: string }> = [];

const botAttempts: Array<{ domain: string; botType: string; time: string; action: string }> = [];

const blockedAttempts: Array<{ source: string; reason: string; time: string }> = [];

const deploymentLogs: string[] = [];

const navItems = ["Dashboard", "Domains", "Protection", "Analytics", "Settings"];

export default function Home() {
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
                <button className="mt-4 w-full rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-3 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
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
              <p className="text-sm text-zinc-500">All domains protected • 0 threats blocked today</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Documentation
              </button>
              <button className="rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
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
                    Authenticate with Clerk and connect your Cloudflare account.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                  Secure by design
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-[#f5c518]/60 hover:bg-white/10">
                  <div>
                    <p>Sign In with Clerk</p>
                    <p className="text-xs font-normal text-zinc-400">Email or OAuth</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </button>
                <button className="flex items-center justify-between rounded-xl border border-[#f5c518]/40 bg-[#f5c518]/15 px-4 py-3 text-left text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  <div>
                    <p>Connect Cloudflare</p>
                    <p className="text-xs font-normal text-[#f5c518]/90">API Token</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </button>
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
                  <p className="mt-2 text-3xl font-semibold text-white">0</p>
                  <p className="mt-1 text-xs text-emerald-400">All systems normal</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121420] p-4 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Protected Domains</p>
                  <p className="mt-2 text-3xl font-semibold text-white">0</p>
                  <p className="mt-1 text-xs text-zinc-400">Add your first domain</p>
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
              <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
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
                      <th className="px-6 py-3 font-medium">Protection</th>
                      <th className="px-6 py-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {protectedDomains.map((item) => (
                      <tr key={item.name} className="hover:bg-white/5">
                        <td className="px-6 py-4 font-semibold text-white">{item.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.status === "Protected"
                                ? "bg-emerald-400/15 text-emerald-300"
                                : "bg-amber-400/15 text-amber-200"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">{item.nameservers}</td>
                        <td className="px-6 py-4 text-zinc-200">
                          {item.status === "Protected" ? "Active" : "Pending"}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{item.lastUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-2" id="wizard">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Step 1 · Domain Setup</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Register your domain</h3>
                <p className="text-sm text-zinc-400">Enter your domain and we'll create a Cloudflare zone.</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Domain name</label>
                    <input
                      type="text"
                      placeholder="your-domain.com"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-[#f5c518]/60 focus:outline-none focus:ring-1 focus:ring-[#f5c518]/40"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <div>
                      <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Nameserver 1</label>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
                        <span>ns1.cloudflare.com</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Nameserver 2</label>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
                        <span>ns2.cloudflare.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Step 2 · WAF Rule</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Bot protection rule</h3>
                <p className="text-sm text-zinc-400">Automatically deployed when nameservers are verified.</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f17]">
                  <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-zinc-400">
                    <span className="mono text-[#f5c518]">waf-rule.json</span>
                    <span>syntax • highlighted</span>
                  </div>
                  <pre className="overflow-x-auto bg-gradient-to-br from-[#0c0f17] via-[#0b0d14] to-[#0c0f17] p-4 text-xs leading-6 text-zinc-200">
                    <code>
{codePreview}
                    </code>
                  </pre>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Step 3 · Deploy</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Deploy to Edge</h3>
                <p className="text-sm text-zinc-400">Streaming logs from Cloudflare Workers API.</p>
                <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-zinc-200 shadow-inner">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-400">Console</span>
                    <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  </div>
                  {deploymentLogs.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-center">
                      <p className="text-xs text-zinc-500">Logs will appear here after deployment</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deploymentLogs.map((log) => (
                        <div key={log} className="flex items-start gap-2">
                          <span className="text-[#f5c518]">$</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <p className="mt-3 text-xs text-zinc-400">Status: Ready to deploy</p>
                </div>
                <button className="mt-4 w-full rounded-xl border border-[#f5c518]/60 bg-[#f5c518]/20 px-4 py-3 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  Deploy to Edge
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Replay monitor</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Blocked attempts</h3>
                {blockedAttempts.length === 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-zinc-400">No blocked attempts</p>
                    <p className="mt-1 text-xs text-zinc-500">Blocked requests will appear here</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {blockedAttempts.map((item) => (
                      <div key={item.time} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-white">{item.source}</p>
                          <p className="text-xs text-zinc-400">{item.reason}</p>
                        </div>
                        <span className="text-xs text-zinc-500">{item.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]" id="analytics">
            <div className="rounded-2xl border border-white/10 bg-white/5 card-surface">
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Bot Activity</p>
                  <h3 className="text-lg font-semibold text-white">Recent bot attempts</h3>
                </div>
                <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                  Export CSV
                </button>
              </div>
              {botAttempts.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="text-sm text-zinc-400">No bot activity detected</p>
                  <p className="mt-1 text-xs text-zinc-500">Bot attempts will appear here once domains are protected</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-zinc-400">
                      <tr>
                        <th className="px-6 py-3 font-medium">Domain</th>
                        <th className="px-6 py-3 font-medium">Bot Type</th>
                        <th className="px-6 py-3 font-medium">Time</th>
                        <th className="px-6 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {botAttempts.map((attempt) => (
                        <tr key={attempt.time} className="hover:bg-white/5">
                          <td className="px-6 py-4 font-semibold text-white">{attempt.domain}</td>
                          <td className="px-6 py-4 text-zinc-300">{attempt.botType}</td>
                          <td className="px-6 py-4 text-zinc-400">{attempt.time}</td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
                              {attempt.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Runtime health</p>
                <div className="mt-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Worker uptime</h3>
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    99.98%
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Rolling 30d across all zones.</p>
                <div className="mt-4 h-28 rounded-xl border border-white/10 bg-black/30" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Alerts</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  <li className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span>Replay defenses active</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </li>
                  <li className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span>API rate limit</span>
                    <span className="rounded-full border border-amber-400/60 bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                      65% used
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" id="settings">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">API Keys</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Programmatic verification</h3>
              <p className="text-sm text-zinc-400">Use keys to verify hashes server-side.</p>
              <div className="mt-4 flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-zinc-400">No API keys generated</p>
                <p className="mt-1 text-xs text-zinc-500">Generate your first API key to get started</p>
                <button className="mt-4 rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/15 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  Generate Key
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Billing</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Subscription</h3>
              <p className="text-sm text-zinc-400">Manage your billing and plan details.</p>
              <div className="mt-4 flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-zinc-400">No active subscription</p>
                <p className="mt-1 text-xs text-zinc-500">Choose a plan to start protecting your domains</p>
                <button className="mt-4 rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/15 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  View Plans
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
