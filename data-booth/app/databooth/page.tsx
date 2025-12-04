"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

type PremiumData = Record<string, unknown> | null

export default function DataboothPage() {
  const [status, setStatus] = useState<string>("Ready")
  const [data, setData] = useState<PremiumData>(null)
  const [isLoading, setIsLoading] = useState(false)

  const buyData = async () => {
    try {
      setIsLoading(true)
      setStatus("Requesting data from booth…")
      setData(null)

      let res = await fetch("/api/secret-data")

      if (res.status === 402) {
        setStatus("402 Payment Required – preparing wallet…")

        const header = res.headers.get("X-Payment-Accepts")
        if (!header) {
          setStatus("Payment instructions missing from server response.")
          return
        }

        let requirements: {
          chainId: number
          token: string
          amount: string
          recipient: string
        }

        try {
          requirements = JSON.parse(header)
        } catch {
          setStatus("Could not parse payment instructions from server.")
          return
        }

        if (typeof window === "undefined") {
          setStatus("This flow must be run in a browser environment.")
          return
        }

        // Lazy import to avoid viem on the server
        const { createWalletClient, custom, parseEther } = await import("viem")

        // 1. Ensure wallet is available
        const anyWindow = window as typeof window & {
          ethereum?: unknown
        }

        if (!anyWindow.ethereum) {
          setStatus("No wallet detected. Please install a browser wallet (e.g. MetaMask).")
          return
        }

        const wallet = createWalletClient({
          transport: custom(anyWindow.ethereum as any),
        })

        setStatus("Connecting wallet…")

        let account: `0x${string}`
        try {
          const accounts = (await wallet.requestAddresses()) as `0x${string}`[]
          if (!accounts.length) {
            setStatus("No accounts found in wallet.")
            return
          }
          ;[account] = accounts
        } catch (err) {
          console.error(err)
          setStatus("Unable to access wallet addresses (request rejected?).")
          return
        }

        // 2. Switch chain
        try {
          await wallet.switchChain({ id: requirements.chainId })
        } catch (err) {
          console.error(err)
          setStatus(
            "Please switch your wallet to Movement Bardock testnet (chainId 30732) and try again.",
          )
          return
        }

        // 3. Send payment
        setStatus("Sending payment transaction…")

        let hash: `0x${string}`
        try {
          hash = await wallet.sendTransaction({
            account,
            to: requirements.recipient as `0x${string}`,
            value: parseEther(requirements.amount),
          })
        } catch (err) {
          console.error(err)
          setStatus("Transaction rejected or failed to send.")
          return
        }

        setStatus(`Tx sent: ${hash}. Waiting for confirmation…`)

        // 4. Wait briefly for inclusion
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // 5. Build payment proof
        const proof = btoa(JSON.stringify({ txHash: hash }))

        // 6. Retry with proof
        setStatus("Verifying payment with booth…")
        res = await fetch("/api/secret-data", {
          headers: {
            "X-Payment": proof,
          },
        })
      }

      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>
        setData(json)
        setStatus("Success – premium data unlocked.")
      } else if (res.status === 402) {
        setStatus("Payment still required. Please try again.")
      } else {
        setStatus(`Request failed with status ${res.status}.`)
      }
    } catch (err) {
      console.error(err)
      setStatus("Unexpected error while talking to the booth.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Subtle grid background to match hero */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.27_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.27_0_0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-primary">x402 Databooth Demo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 text-balance">
              Buy premium data
              <br />
                <span className="text-primary">with HTTP 402 + MOVE</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground text-pretty">
              This page talks to your Movement Bardock wallet, sends a small on-chain payment, and then
              retries the request with a cryptographic proof of payment.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
            {/* Action panel */}
            <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    Booth
                  </div>
                  <div className="mt-1 text-lg font-semibold">/api/secret-data</div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div className="font-mono text-xs">Price</div>
                  <div className="font-mono text-primary font-semibold">0.1 MOVE</div>
                </div>
              </div>

              <Button
                size="lg"
                className={cn(
                  "w-full font-semibold",
                  isLoading && "cursor-wait opacity-90",
                )}
                onClick={buyData}
                disabled={isLoading}
              >
                {isLoading ? "Processing payment…" : "Buy Secret Data (0.1 MOVE)"}
              </Button>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Uses Movement Bardock testnet (chainId 30732). You&apos;ll need a wallet with Bardock
                testnet MOVE to complete the purchase.
              </p>

              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs font-mono text-muted-foreground text-left">
                <div className="mb-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground/80">
                  Status
                </div>
                <div className="text-foreground whitespace-pre-wrap break-words">{status}</div>
              </div>
            </div>

            {/* Data panel */}
            <div className="rounded-2xl border bg-card/40 backdrop-blur-sm shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Payload
                </div>
                <div className="rounded-full border px-3 py-1 text-[0.7rem] font-mono text-muted-foreground">
                  {data ? "unlocked" : "locked"}
                </div>
              </div>

              <div className="relative mt-2 rounded-xl bg-muted/60 border px-4 py-3 text-xs font-mono text-muted-foreground min-h-[140px]">
                {data ? (
                  <pre className="whitespace-pre-wrap break-words text-[0.7rem] leading-relaxed text-emerald-400/90">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-[0.75rem]">
                    <span className="text-muted-foreground">No data yet.</span>
                    <span className="text-muted-foreground/80">
                      Complete a payment to unlock the booth payload.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}


