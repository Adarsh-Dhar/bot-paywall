"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Loader2, Check, AlertCircle } from "lucide-react"

type RequestState = "idle" | "402" | "signing" | "200"

export function RequestConsole() {
  const [requestState, setRequestState] = useState<RequestState>("idle")

  const handleSendRequest = () => {
    setRequestState("402")
    setTimeout(() => setRequestState("signing"), 1500)
    setTimeout(() => setRequestState("200"), 3000)
    setTimeout(() => setRequestState("idle"), 8000)
  }

  const getStatusBadge = () => {
    switch (requestState) {
      case "402":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">402 Payment Required</Badge>
      case "signing":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Signing...</Badge>
      case "200":
        return <Badge className="bg-primary/20 text-primary border-primary/30">200 OK</Badge>
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Ready
          </Badge>
        )
    }
  }

  const getResponseContent = () => {
    switch (requestState) {
      case "402":
        return `{
  "status": 402,
  "message": "Payment Required",
  "payment": {
    "price": "0.01 MOVE",
    "address": "0x7a23...f891",
    "network": "movement",
    "expires": "2024-01-15T12:00:00Z"
  }
}`
      case "signing":
        return null
      case "200":
        return `{
  "status": 200,
  "data": {
    "location": "Tokyo, Japan",
    "temp": 24,
    "condition": "Cloudy",
    "humidity": 65,
    "wind": "12 km/h NE",
    "timestamp": "2024-01-15T11:30:00Z"
  }
}`
      default:
        return `// Response will appear here after sending request`
    }
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">The x402 Flow in Action</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Watch how AI agents seamlessly pay for data access using crypto micropayments
          </p>
        </div>

        <Card className="bg-card border-border overflow-hidden max-w-5xl mx-auto">
          <CardHeader className="border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono text-muted-foreground">API Console</CardTitle>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Request Panel */}
              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Request</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-primary border-primary/30 font-mono text-xs">
                      GET
                    </Badge>
                    <code className="text-sm font-mono text-foreground">/api/v1/weather/tokyo</code>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    <div>Host: api.databooth.io</div>
                    <div>X-Agent-ID: 0x12...34</div>
                    <div>Accept: application/json</div>
                  </div>
                </div>
                <Button
                  onClick={handleSendRequest}
                  disabled={requestState !== "idle"}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {requestState === "idle" ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Request
                    </>
                  ) : requestState === "signing" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing Transaction...
                    </>
                  ) : requestState === "200" ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Request Complete
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Payment Required
                    </>
                  )}
                </Button>
              </div>

              {/* Response Panel */}
              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Response</span>
                </div>
                <div className="relative rounded-lg bg-secondary/50 p-4 min-h-[200px]">
                  {requestState === "signing" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 rounded-lg">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                        <div className="text-sm font-mono text-foreground">Wallet Signature Request</div>
                        <div className="text-xs text-muted-foreground mt-1">Confirm payment of 0.01 MOVE</div>
                      </div>
                    </div>
                  ) : (
                    <pre
                      className={`text-xs font-mono overflow-auto ${requestState === "200" ? "text-primary" : requestState === "402" ? "text-orange-400" : "text-muted-foreground"}`}
                    >
                      {getResponseContent()}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
