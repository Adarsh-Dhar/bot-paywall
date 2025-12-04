import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.27_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.27_0_0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-8">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-primary">x402 Protocol</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 text-balance">
            The Vending Machine for
            <br />
            <span className="text-primary glow-text">the Agentic Web</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-10 text-pretty">
            Instant, permissionless access to premium data feeds via HTTP 402. No subscriptions. Just pay-per-request.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
              <Link href="/marketplace">
                Browse Feeds
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs">
                <BookOpen className="mr-2 h-4 w-4" />
                Read Specs
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { value: "2.4M+", label: "API Calls" },
              { value: "340+", label: "Data Feeds" },
              { value: "<50ms", label: "Latency" },
              { value: "$0.001", label: "Min Price" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
