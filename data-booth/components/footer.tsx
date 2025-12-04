import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <span className="font-mono text-sm font-bold text-primary-foreground">DB</span>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground">DataBooth</span>
            </Link>
            <p className="text-sm text-muted-foreground">The vending machine for the agentic web.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/marketplace"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Protocol</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  x402 Spec
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Integration Guide
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  API Reference
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Connect</h3>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2025 DataBooth. Built on Movement.</p>
          <p className="text-xs font-mono text-muted-foreground">Powered by x402 Protocol</p>
        </div>
      </div>
    </footer>
  )
}
