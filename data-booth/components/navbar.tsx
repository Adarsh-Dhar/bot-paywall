"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Menu, X } from "lucide-react"

export function Navbar() {
  const [isConnected, setIsConnected] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="font-mono text-sm font-bold text-primary-foreground">DB</span>
            </div>
            <span className="font-mono text-lg font-semibold text-foreground">DataBooth</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>

          {/* Wallet Connection */}
          <div className="hidden md:flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md bg-card px-3 py-1.5 border border-border">
                  <span className="text-sm font-mono text-primary">150 MOVE</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsConnected(false)} className="font-mono text-xs">
                  <Wallet className="mr-2 h-3 w-3" />
                  0x12...34
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsConnected(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6 text-foreground" /> : <Menu className="h-6 w-6 text-foreground" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link
                href="/marketplace"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Marketplace
              </Link>
              <Link
                href="/docs"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Button
                onClick={() => setIsConnected(!isConnected)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {isConnected ? "0x12...34" : "Connect Wallet"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
