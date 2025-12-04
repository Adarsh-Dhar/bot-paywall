import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Cloud, TrendingUp, Database, Zap, Globe, Shield, BarChart3, Cpu } from "lucide-react"
import Link from "next/link"

const dataProducts = [
  {
    icon: Cloud,
    title: "Real-time Weather",
    description: "Global weather data with 15-minute refresh intervals",
    price: "0.005",
    category: "Weather",
  },
  {
    icon: TrendingUp,
    title: "Stock Tickers",
    description: "NASDAQ/NYSE millisecond latency feeds",
    price: "0.01",
    category: "Finance",
  },
  {
    icon: Database,
    title: "Blockchain Data",
    description: "Real-time on-chain analytics and events",
    price: "0.008",
    category: "Crypto",
  },
  {
    icon: Zap,
    title: "Energy Prices",
    description: "Live electricity and gas spot prices",
    price: "0.003",
    category: "Energy",
  },
  {
    icon: Globe,
    title: "Geolocation API",
    description: "IP-to-location with 99.9% accuracy",
    price: "0.002",
    category: "Utility",
  },
  {
    icon: Shield,
    title: "Threat Intel",
    description: "Real-time malware and phishing detection",
    price: "0.015",
    category: "Security",
  },
  {
    icon: BarChart3,
    title: "Social Sentiment",
    description: "Twitter/X sentiment analysis feeds",
    price: "0.007",
    category: "Analytics",
  },
  {
    icon: Cpu,
    title: "AI Model APIs",
    description: "Access to curated ML model endpoints",
    price: "0.02",
    category: "AI",
  },
]

export function DataProductsGrid() {
  return (
    <section className="py-20 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Data Products</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Premium data feeds ready for instant access. Pay only for what you use.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dataProducts.map((product) => (
            <Card key={product.title} className="bg-card border-border hover:border-primary/50 transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <product.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {product.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <h3 className="font-semibold text-foreground mb-1">{product.title}</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </CardContent>
              <CardFooter className="flex items-center justify-between pt-3 border-t border-border">
                <div className="font-mono text-sm">
                  <span className="text-primary font-semibold">{product.price}</span>
                  <span className="text-muted-foreground"> MOVE/req</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Link href="/marketplace">Test</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace">View All Feeds</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
