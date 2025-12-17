import { ArrowRight, Server, Shield, Code, Github, Twitter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-mono font-semibold text-lg">BotGate</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Docs
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
              <Button size="sm" className="bg-accent-glow text-accent-glow-foreground hover:bg-accent-glow/90">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-block mb-6">
              <span className="text-xs font-mono text-accent-glow px-3 py-1 rounded-full border border-accent-glow/30 bg-accent-glow/10">
                Developer-First API Protection
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-balance leading-tight">
              Turn Your Data into <span className="text-accent-glow">Revenue</span>.<br />
              Gate Your APIs against Bots.
            </h1>

            <p className="text-xl text-muted-foreground mb-10 text-pretty max-w-3xl mx-auto leading-relaxed">
              The developer-first way to monetize access and protect premium data in Next.js. No external proxies, just
              simple Middleware and Server-side helpers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-accent-glow text-accent-glow-foreground hover:bg-accent-glow/90 group">
                Start Integrating Now
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline">
                Read the Docs
              </Button>
            </div>
          </div>

          {/* Abstract Data Flow Visualization */}
          <div className="relative max-w-4xl mx-auto h-64 mb-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Flowing lines */}
                <svg className="w-full h-full" viewBox="0 0 800 200">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--accent-glow))" stopOpacity="0" />
                      <stop offset="50%" stopColor="hsl(var(--accent-glow))" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="hsl(var(--accent-glow))" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 0 100 Q 200 50 400 100 T 800 100"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    className="animate-pulse"
                  />
                  <path
                    d="M 0 120 Q 200 170 400 120 T 800 120"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    className="animate-pulse"
                    style={{ animationDelay: "0.5s" }}
                  />
                </svg>

                {/* Gate in center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent-glow/20 blur-2xl rounded-full w-32 h-32" />
                    <div className="relative w-20 h-20 bg-card border-2 border-accent-glow rounded-lg flex items-center justify-center">
                      <Shield className="w-10 h-10 text-accent-glow" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Granular Control in Two Steps</h2>
            <p className="text-lg text-muted-foreground">
              Simple, powerful, and fully integrated with your Next.js stack
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Explanation */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-accent-glow">
                  <div className="w-8 h-8 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center">
                    <span className="text-sm font-bold">1</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Protect Routes Globally</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Use Next.js Middleware to block unauthenticated bots from entire API endpoints or page groups. Set it
                  once, protect everything.
                </p>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-accent-glow">
                  <div className="w-8 h-8 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center">
                    <span className="text-sm font-bold">2</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Protect Data Granularly</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Use our server-side helper within React Server Components to conditionally render premium data.
                  Maximum flexibility, zero client exposure.
                </p>
              </div>
            </div>

            {/* Right Column - Code Blocks */}
            <div className="space-y-6">
              {/* Code Block 1 */}
              <Card className="overflow-hidden bg-code-bg border-border/50">
                <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">middleware.ts</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-foreground/90">
                    <code>{`export const config = { 
  matcher: ['/api/premium/:path*'] 
}

export function middleware(req) {
  if (req.headers.get("x-bot-key") !== process.env.KEY) {
    return new NextResponse("Pay to access", { 
      status: 402 
    })
  }
}`}</code>
                  </pre>
                </div>
              </Card>

              {/* Code Block 2 */}
              <Card className="overflow-hidden bg-code-bg border-border/50">
                <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">app/dashboard/page.tsx</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                    <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-foreground/90">
                    <code>{`import { isVerifiedBot } from '@botgate/next';

export default function Page() {
  const hasAccess = isVerifiedBot();
  
  return (
    <main>
      <PublicSummary />
      {hasAccess ? (
        <PremiumFinancialData />
      ) : (
        <LockedState />
      )}
    </main>
  )
}`}</code>
                  </pre>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for the Modern Stack</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <Card className="p-8 bg-card/50 backdrop-blur border-border/50 hover:border-accent-glow/50 transition-all duration-300 group">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-accent-glow/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-12 h-12 rounded-lg bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center">
                  <Server className="w-6 h-6 text-accent-glow" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Zero Latency</h3>
              <p className="text-muted-foreground leading-relaxed">
                Runs entirely within your existing Vercel/Next.js infrastructure. No extra network hops.
              </p>
            </Card>

            {/* Feature Card 2 */}
            <Card className="p-8 bg-card/50 backdrop-blur border-border/50 hover:border-accent-glow/50 transition-all duration-300 group">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-accent-glow/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-12 h-12 rounded-lg bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-accent-glow" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Server-Side Secure</h3>
              <p className="text-muted-foreground leading-relaxed">
                Premium data never leaves the server unless authentication passes.
              </p>
            </Card>

            {/* Feature Card 3 */}
            <Card className="p-8 bg-card/50 backdrop-blur border-border/50 hover:border-accent-glow/50 transition-all duration-300 group">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-accent-glow/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-12 h-12 rounded-lg bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center">
                  <Code className="w-6 h-6 text-accent-glow" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Typed SDK</h3>
              <p className="text-muted-foreground leading-relaxed">
                First-class TypeScript support for confident implementation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Developer Tier */}
            <Card className="p-8 bg-card/50 backdrop-blur border-border/50">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Developer</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold">Free</span>
                </div>
                <p className="text-muted-foreground">Perfect for testing and development</p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-accent-glow rounded-full" />
                  </div>
                  <span className="text-foreground">1,000 API requests/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-accent-glow rounded-full" />
                  </div>
                  <span className="text-foreground">Basic analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-accent-glow rounded-full" />
                  </div>
                  <span className="text-foreground">Community support</span>
                </li>
              </ul>

              <Button variant="outline" className="w-full bg-transparent">
                Get Started
              </Button>
            </Card>

            {/* Production Tier */}
            <Card className="p-8 bg-card/50 backdrop-blur border-2 border-accent-glow/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-glow/5 to-transparent pointer-events-none" />

              <div className="relative">
                <div className="absolute -top-4 -right-4 px-3 py-1 bg-accent-glow text-accent-glow-foreground text-xs font-bold rounded-full">
                  POPULAR
                </div>

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Production</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-muted-foreground">Scale with confidence</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-accent-glow rounded-full" />
                    </div>
                    <span className="text-foreground">Unlimited API requests</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-accent-glow rounded-full" />
                    </div>
                    <span className="text-foreground">Advanced analytics & insights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-accent-glow rounded-full" />
                    </div>
                    <span className="text-foreground">Priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent-glow/10 border border-accent-glow/30 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-accent-glow rounded-full" />
                    </div>
                    <span className="text-foreground">Custom rate limits</span>
                  </li>
                </ul>

                <Button className="w-full bg-accent-glow text-accent-glow-foreground hover:bg-accent-glow/90">
                  Start Free Trial
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-mono font-semibold text-lg">BotGate</span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>

            <p className="text-sm text-muted-foreground">© 2025 BotGate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
