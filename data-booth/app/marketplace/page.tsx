"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Cloud, TrendingUp, Database, Zap, Globe, Shield, BarChart3, Cpu, Search, Filter, Star } from "lucide-react"

const allProducts = [
  {
    icon: Cloud,
    title: "Real-time Weather",
    description: "Global weather data with 15-minute refresh intervals",
    price: "0.005",
    category: "Weather",
    rating: 4.9,
    calls: "1.2M",
  },
  {
    icon: TrendingUp,
    title: "Stock Tickers",
    description: "NASDAQ/NYSE millisecond latency feeds",
    price: "0.01",
    category: "Finance",
    rating: 4.8,
    calls: "890K",
  },
  {
    icon: Database,
    title: "Blockchain Data",
    description: "Real-time on-chain analytics and events",
    price: "0.008",
    category: "Crypto",
    rating: 4.7,
    calls: "650K",
  },
  {
    icon: Zap,
    title: "Energy Prices",
    description: "Live electricity and gas spot prices",
    price: "0.003",
    category: "Energy",
    rating: 4.6,
    calls: "320K",
  },
  {
    icon: Globe,
    title: "Geolocation API",
    description: "IP-to-location with 99.9% accuracy",
    price: "0.002",
    category: "Utility",
    rating: 4.9,
    calls: "2.1M",
  },
  {
    icon: Shield,
    title: "Threat Intel",
    description: "Real-time malware and phishing detection",
    price: "0.015",
    category: "Security",
    rating: 4.8,
    calls: "180K",
  },
  {
    icon: BarChart3,
    title: "Social Sentiment",
    description: "Twitter/X sentiment analysis feeds",
    price: "0.007",
    category: "Analytics",
    rating: 4.5,
    calls: "420K",
  },
  {
    icon: Cpu,
    title: "AI Model APIs",
    description: "Access to curated ML model endpoints",
    price: "0.02",
    category: "AI",
    rating: 4.9,
    calls: "780K",
  },
  {
    icon: Cloud,
    title: "Air Quality Index",
    description: "Global AQI data with hourly updates",
    price: "0.004",
    category: "Weather",
    rating: 4.7,
    calls: "210K",
  },
  {
    icon: TrendingUp,
    title: "Forex Rates",
    description: "Real-time foreign exchange rates",
    price: "0.006",
    category: "Finance",
    rating: 4.8,
    calls: "560K",
  },
  {
    icon: Database,
    title: "NFT Metadata",
    description: "Comprehensive NFT collection data",
    price: "0.012",
    category: "Crypto",
    rating: 4.6,
    calls: "340K",
  },
  {
    icon: Globe,
    title: "DNS Lookup",
    description: "Fast DNS resolution and records",
    price: "0.001",
    category: "Utility",
    rating: 4.9,
    calls: "1.8M",
  },
]

const categories = ["All", "Weather", "Finance", "Crypto", "Energy", "Utility", "Security", "Analytics", "AI"]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")

  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Data Marketplace</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Browse and access premium data feeds. Pay only for what you consume.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search data feeds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category ? "bg-primary text-primary-foreground" : ""}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.title} className="bg-card border-border hover:border-primary/50 transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <product.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="text-xs text-muted-foreground">{product.rating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{product.title}</h3>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {product.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{product.calls}</span> calls this month
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="font-mono text-sm">
                    <span className="text-primary font-semibold">{product.price}</span>
                    <span className="text-muted-foreground"> MOVE/req</span>
                  </div>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Test Endpoint
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No data feeds found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}
