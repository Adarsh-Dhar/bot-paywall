"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"

const transactions = [
  { agentId: "0x7a23...f891", resource: "weather/tokyo", price: "0.01", txHash: "0xabc...def", time: "2s ago" },
  { agentId: "0x4b12...c234", resource: "stocks/AAPL", price: "0.01", txHash: "0x123...456", time: "5s ago" },
  { agentId: "0x9f56...a789", resource: "blockchain/eth", price: "0.008", txHash: "0x789...abc", time: "8s ago" },
  { agentId: "0x2c89...d012", resource: "sentiment/btc", price: "0.007", txHash: "0xdef...123", time: "12s ago" },
  { agentId: "0x8e34...b567", resource: "geo/lookup", price: "0.002", txHash: "0x456...789", time: "15s ago" },
  { agentId: "0x1a67...e890", resource: "weather/nyc", price: "0.005", txHash: "0x890...def", time: "18s ago" },
]

export function RecentTransactions() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Live Transaction Feed</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Watch real-time micropayments flowing through the network
          </p>
        </div>

        <Card className="bg-card border-border max-w-4xl mx-auto">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono text-muted-foreground">Recent Purchases</CardTitle>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-primary font-mono">Live</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <code className="text-xs font-mono text-muted-foreground hidden sm:block">{tx.agentId}</code>
                    <Badge variant="outline" className="font-mono text-xs">
                      {tx.resource}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-primary">{tx.price} MOVE</span>
                    <a
                      href="#"
                      className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <code>{tx.txHash}</code>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-xs text-muted-foreground">{tx.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
