"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useX402Payment } from "@/hooks/use-x402-payment";
import { toast } from "sonner";

const SERVER_URL = "http://localhost:4402";

export function PremiumContent() {
  const { payForAccess, isConnected } = useX402Payment();
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    if (!isConnected) return toast.error("Connect wallet first");

    setIsLoading(true);
    const loadingToast = toast.loading("Checking payment...");

    try {
      // 1. Get payment requirements
      const res = await fetch(`${SERVER_URL}/api/premium-content`);
      if (res.status !== 402) {
        toast.success("Content unlocked!", { id: loadingToast });
        return window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
      }

      const { accepts } = await res.json();
      if (!accepts?.[0]) throw new Error("No payment requirements");

      // 2. Sign payment (opens wallet)
      toast.loading("Sign in wallet...", { id: loadingToast });
      const xPayment = await payForAccess(accepts[0]);

      // 3. Submit payment
      toast.loading("Processing...", { id: loadingToast });
      const paidRes = await fetch(`${SERVER_URL}/api/premium-content`, {
        headers: { "X-PAYMENT": xPayment },
        redirect: "manual"
      });

      if (paidRes.status === 302 || paidRes.ok || paidRes.type === "opaqueredirect") {
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
        toast.success("Payment successful!", { id: loadingToast });
      } else {
        throw new Error("Payment failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed", { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>x402 Premium Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Pay 1 MOVE to unlock exclusive content via x402 protocol.
        </p>
        <Button onClick={handleUnlock} disabled={isLoading || !isConnected} className="w-full">
          {isLoading ? "Processing..." : "Unlock (1 MOVE)"}
        </Button>
      </CardContent>
    </Card>
  );
}
