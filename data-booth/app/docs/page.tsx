import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Code, Zap, Shield, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Documentation</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">Build with DataBooth</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to integrate HTTP 402 micropayments into your AI agents and applications.
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: BookOpen, title: "Getting Started", description: "Quick start guide for new developers" },
              { icon: Code, title: "API Reference", description: "Complete endpoint documentation" },
              { icon: Zap, title: "x402 Protocol", description: "Learn the payment protocol" },
              { icon: Shield, title: "Authentication", description: "Wallet and signing guides" },
            ].map((item) => (
              <Card
                key={item.title}
                className="bg-card border-border hover:border-primary/50 transition-all group cursor-pointer"
              >
                <CardContent className="pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    {item.title}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-border sticky top-24">
                <CardHeader>
                  <CardTitle className="text-sm font-mono text-muted-foreground">On this page</CardTitle>
                </CardHeader>
                <CardContent>
                  <nav className="space-y-2">
                    {[
                      "Introduction",
                      "How x402 Works",
                      "Quick Start",
                      "Making Requests",
                      "Handling Payments",
                      "Error Handling",
                    ].map((item) => (
                      <Link
                        key={item}
                        href="#"
                        className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        {item}
                      </Link>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>

            {/* Content */}
            <div className="lg:col-span-2 space-y-12">
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">Introduction</h2>
                <p className="text-muted-foreground mb-4">
                  DataBooth is a decentralized data marketplace that enables AI agents and developers to purchase API
                  access using crypto micropayments via the x402 protocol. No subscriptions, no API keys—just instant,
                  permissionless access to premium data feeds.
                </p>
                <p className="text-muted-foreground">
                  The x402 protocol leverages the HTTP 402 "Payment Required" status code to create a seamless
                  pay-per-request experience. When your agent makes a request to a protected endpoint, it receives
                  payment instructions and can automatically complete the transaction.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">How x402 Works</h2>
                <div className="rounded-lg bg-secondary/50 p-6 font-mono text-sm">
                  <div className="space-y-4">
                    <div>
                      <span className="text-muted-foreground">1. Agent sends request</span>
                      <pre className="mt-2 text-primary">GET /api/v1/weather/tokyo</pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">2. Server returns 402 with payment details</span>
                      <pre className="mt-2 text-orange-400">{`{
  "price": "0.01 MOVE",
  "address": "0x7a23...f891"
}`}</pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">3. Agent signs and sends payment</span>
                      <pre className="mt-2 text-yellow-400">Wallet.signTransaction()</pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">4. Server validates and returns data</span>
                      <pre className="mt-2 text-primary">{`{
  "temp": 24,
  "condition": "Cloudy"
}`}</pre>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">Quick Start</h2>
                <p className="text-muted-foreground mb-4">
                  Install the DataBooth SDK to get started with x402 payments:
                </p>
                <div className="rounded-lg bg-secondary/50 p-4 font-mono text-sm mb-4">
                  <code className="text-primary">npm install @databooth/sdk</code>
                </div>
                <p className="text-muted-foreground mb-4">Initialize the client with your wallet:</p>
                <div className="rounded-lg bg-secondary/50 p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-foreground">{`import { DataBooth } from '@databooth/sdk'

const client = new DataBooth({
  wallet: yourWallet,
  network: 'movement'
})

// Make a paid request
const weather = await client.get('/weather/tokyo')
console.log(weather.data) // { temp: 24, condition: "Cloudy" }`}</pre>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
