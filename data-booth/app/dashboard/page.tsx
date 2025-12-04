"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wallet, TrendingUp, Zap, Clock, ArrowUpRight, ArrowDownRight, ExternalLink, Plus } from "lucide-react"

const recentActivity = [
  { type: "out", resource: "weather/tokyo", amount: "0.01", time: "2 min ago", status: "success" },
  { type: "out", resource: "stocks/AAPL", amount: "0.01", time: "15 min ago", status: "success" },
  { type: "in", resource: "Deposit", amount: "50.00", time: "1 hour ago", status: "success" },
  { type: "out", resource: "blockchain/eth", amount: "0.008", time: "2 hours ago", status: "success" },
  { type: "out", resource: "sentiment/btc", amount: "0.007", time: "3 hours ago", status: "success" },
]

const topEndpoints = [
  { name: "weather/tokyo", calls: 234, spent: "2.34" },
  { name: "stocks/AAPL", calls: 189, spent: "1.89" },
  { name: "blockchain/eth", calls: 156, spent: "1.25" },
  { name: "geo/lookup", calls: 98, spent: "0.20" },
]

export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-muted-foreground">Monitor your API usage and spending</p>
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Funds
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  150.00 <span className="text-primary">MOVE</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">≈ $45.00 USD</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">API Calls (24h)</CardTitle>
                <Zap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">1,247</div>
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +12.5% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Spent (24h)</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  8.42 <span className="text-primary">MOVE</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Avg: 0.0068 per request</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  42<span className="text-muted-foreground text-lg">ms</span>
                </div>
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  -8ms improvement
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <Card className="lg:col-span-2 bg-card border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm font-mono text-muted-foreground">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentActivity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            item.type === "in" ? "bg-primary/20" : "bg-secondary"
                          }`}
                        >
                          {item.type === "in" ? (
                            <ArrowDownRight className="h-4 w-4 text-primary" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-foreground">{item.resource}</div>
                          <div className="text-xs text-muted-foreground">{item.time}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-sm ${item.type === "in" ? "text-primary" : "text-foreground"}`}>
                          {item.type === "in" ? "+" : "-"}
                          {item.amount} MOVE
                        </div>
                        <Badge variant="outline" className="text-xs text-primary border-primary/30">
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Endpoints */}
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm font-mono text-muted-foreground">Top Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {topEndpoints.map((endpoint, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div>
                        <div className="font-mono text-sm text-foreground">{endpoint.name}</div>
                        <div className="text-xs text-muted-foreground">{endpoint.calls} calls</div>
                      </div>
                      <div className="font-mono text-sm text-primary">{endpoint.spent} MOVE</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Wallet Info */}
          <Card className="mt-8 bg-card border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono text-muted-foreground">Connected Wallet</CardTitle>
                <Badge variant="outline" className="text-primary border-primary/30">
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-mono text-foreground">0x12a4...7f34</div>
                    <div className="text-sm text-muted-foreground">Movement Network</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Explorer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-transparent"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </main>
  )
}
