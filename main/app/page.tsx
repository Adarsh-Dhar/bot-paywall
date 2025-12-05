const codePreview = String.raw`export default {
  async fetch(request, env) {
    const PRICE_MOVE = env.PRICE_MOVE || "0.05";
    const RECEIVER = env.RECEIVER_WALLET;
    const TARGET_URL = env.TARGET_URL;

    const paymentHash = request.headers.get("X-Payment-Hash");
    if (!paymentHash) return new Response("Payment required", { status: 402 });

    const isValid = await env.EDGE_GUARD.verify(paymentHash, RECEIVER, PRICE_MOVE);
    if (!isValid) return new Response("Invalid or replayed", { status: 403 });

    return fetch(TARGET_URL, request);
  },
};`;

const paywalls = [
  {
    name: "Blog",
    url: "blog.movement.dev",
    price: "0.05 MOVE",
    status: "Active",
    lastDeployed: "2h ago",
  },
  {
    name: "Docs",
    url: "docs.edgeguard.dev",
    price: "0.01 MOVE",
    status: "Active",
    lastDeployed: "Yesterday",
  },
  {
    name: "Dashboard",
    url: "dash.client.xyz",
    price: "0.10 MOVE",
    status: "Paused",
    lastDeployed: "3d ago",
  },
];

const transactions = [
  { hash: "0x9f12...ab7c", amount: "1.20 MOVE", time: "2m ago", payer: "0x33a...91c" },
  { hash: "0x7a45...d002", amount: "0.05 MOVE", time: "12m ago", payer: "0x58b...8aa" },
  { hash: "0x4b90...12ff", amount: "0.50 MOVE", time: "1h ago", payer: "0x1cc...d31" },
];

const blockedAttempts = [
  { source: "blog.movement.dev", reason: "Replay hash", time: "3m ago" },
  { source: "dash.client.xyz", reason: "Expired proof", time: "19m ago" },
  { source: "docs.edgeguard.dev", reason: "Mismatched wallet", time: "1h ago" },
];

const deploymentLogs = [
  "> Generating script...",
  "> Authenticating with Cloudflare...",
  "> Uploading Worker...",
  "> Binding secrets...",
  "> Success! Paywall is live.",
];

const navItems = ["Dashboard", "Paywalls", "Wizard", "Analytics", "Settings"];

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
                  EG
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Edge Guard</p>
                  <p className="text-lg font-semibold">Control Center</p>
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
                <p className="font-semibold text-white">Deploy to Edge</p>
                <p className="mt-1 text-zinc-400">
                  Ship a new paywall in under 30 seconds with Cloudflare Workers.
                </p>
                <button className="mt-4 w-full rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-3 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
                  New Deployment
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 space-y-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-400">Edge Guard · Movement</p>
              <h1 className="text-3xl font-semibold text-white">Developer Dashboard</h1>
              <p className="text-sm text-zinc-500">Last synced 2 min ago • All systems normal</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Docs
              </button>
              <button className="rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/20 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518] hover:bg-[#f5c518]/25">
                Deploy to Edge
              </button>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Step 0</p>
                  <h2 className="mt-2 text-xl font-semibold">Authenticate & Onboard</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    OAuth with Cloudflare and verify payout wallet to start deploying.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                  Secure by design
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-[#f5c518]/60 hover:bg-white/10">
                  <div>
                    <p>Login with Cloudflare</p>
                    <p className="text-xs font-normal text-zinc-400">OAuth · Worker permissions</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </button>
                <button className="flex items-center justify-between rounded-xl border border-[#f5c518]/40 bg-[#f5c518]/15 px-4 py-3 text-left text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  <div>
                    <p>Connect Wallet</p>
                    <p className="text-xs font-normal text-[#f5c518]/90">Metamask / Razor</p>
                  </div>
                  <span className="mono text-xs text-white/70">0x33a...91c</span>
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <div className="glow" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Stats</p>
                  <h2 className="mt-2 text-xl font-semibold">Revenue & Unlocks</h2>
                  <p className="mt-1 text-sm text-zinc-400">LIVE across all deployed paywalls</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  MOVE network
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#121420] p-4 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Total Revenue</p>
                  <p className="mt-2 text-3xl font-semibold text-white">143.20 MOVE</p>
                  <p className="mt-1 text-xs text-emerald-400">+12.4% vs yesterday</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121420] p-4 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Total Unlocks</p>
                  <p className="mt-2 text-3xl font-semibold text-white">4,218</p>
                  <p className="mt-1 text-xs text-emerald-400">+182 today</p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 card-surface">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#f5c518]">Active Paywalls</p>
                <h3 className="text-lg font-semibold text-white">Your deployed workers</h3>
              </div>
              <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                + Create Paywall
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-zinc-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Website</th>
                    <th className="px-6 py-3 font-medium">Target URL</th>
                    <th className="px-6 py-3 font-medium">Price</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Last Deployed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paywalls.map((item) => (
                    <tr key={item.url} className="hover:bg-white/5">
                      <td className="px-6 py-4 font-semibold text-white">{item.name}</td>
                      <td className="px-6 py-4 text-zinc-300">{item.url}</td>
                      <td className="px-6 py-4 text-zinc-200">{item.price}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "Active"
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-amber-400/15 text-amber-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">{item.lastDeployed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2" id="wizard">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Step 1 · Configuration</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Wallet, price, target zone</h3>
                <p className="text-sm text-zinc-400">Auto-fill from wallet connect; zones pulled from Cloudflare.</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Receiving wallet</label>
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <p className="mono text-sm text-white">0x33a...91c</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                        Connected
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
                    <div>
                      <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Target zone</label>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                        <span>blog.mysite.com</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[#f5c518]">Cloudflare</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Price</label>
                      <input
                        defaultValue="0.05"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none ring-[#f5c518]/40 focus:ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.14em] text-zinc-400">Currency</label>
                      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                        MOVE
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Step 2 · Code preview</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Generated Worker script</h3>
                <p className="text-sm text-zinc-400">Read-only; variables injected from config and secrets.</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f17]">
                  <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-zinc-400">
                    <span className="mono text-[#f5c518]">paywall-worker.js</span>
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
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    {deploymentLogs.map((log) => (
                      <div key={log} className="flex items-start gap-2">
                        <span className="text-[#f5c518]">$</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <p className="mt-3 text-xs text-emerald-400">Status: Success • Worker live</p>
                </div>
                <button className="mt-4 w-full rounded-xl border border-[#f5c518]/60 bg-[#f5c518]/20 px-4 py-3 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                  Deploy to Edge
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
                <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Replay monitor</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Blocked attempts</h3>
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
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]" id="analytics">
            <div className="rounded-2xl border border-white/10 bg-white/5 card-surface">
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Transaction Log</p>
                  <h3 className="text-lg font-semibold text-white">Incoming payments</h3>
                </div>
                <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-zinc-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Tx Hash</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Time</th>
                      <th className="px-6 py-3 font-medium">Payer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx.hash} className="hover:bg-white/5">
                        <td className="px-6 py-4 font-semibold text-[#f5c518] underline decoration-dotted underline-offset-4">
                          {tx.hash}
                        </td>
                        <td className="px-6 py-4 text-white">{tx.amount}</td>
                        <td className="px-6 py-4 text-zinc-300">{tx.time}</td>
                        <td className="px-6 py-4 mono text-sm text-zinc-200">{tx.payer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="mono text-sm text-zinc-300">sk_live_9f12_xxx</span>
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                    Active
                  </span>
                  <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                    Copy
                  </button>
                </div>
                <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#f5c518]/50 hover:bg-[#f5c518]/15 hover:text-[#f5c518]">
                  Rotate key
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 card-surface">
              <p className="text-xs uppercase tracking-[0.18em] text-[#f5c518]">Billing</p>
              <h3 className="mt-2 text-xl font-semibold text-white">SaaS plan</h3>
              <p className="text-sm text-zinc-400">Protect 5 sites · $10/mo • Upgrade anytime.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Current</p>
                  <p className="mt-1 text-lg font-semibold text-white">Starter</p>
                  <p className="text-sm text-zinc-400">5 paywalls</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Usage</p>
                  <p className="mt-1 text-lg font-semibold text-white">3 / 5</p>
                  <p className="text-sm text-emerald-400">On track</p>
                </div>
              </div>
              <button className="mt-4 w-full rounded-lg border border-[#f5c518]/60 bg-[#f5c518]/15 px-4 py-2 text-sm font-semibold text-[#f5c518] transition hover:-translate-y-0.5 hover:border-[#f5c518]">
                Manage billing
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
