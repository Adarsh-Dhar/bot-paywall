"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { PremiumContent } from "@/components/premium-content";

export function WalletDemoContent() {
  const { account, disconnect, network } = useWallet();

  const address = account?.address?.toString() || "";

  const getNetworkName = () => {
    if (!network?.chainId) return "Unknown Network";

    switch (network.chainId) {
      case 126:
        return "Movement Mainnet";
      case 250:
        return "Movement Testnet";
      default:
        return "Unknown Network";
    }
  };

  const networkConfig = {
    name: getNetworkName(),
    chainId: network?.chainId || 0
  };

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">x402 Demo</h1>
        <Button variant="outline" onClick={disconnect}>
          Disconnect Wallet
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Network Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Connected Address</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Network</p>
              <p className="text-sm">
                {networkConfig.name} (Chain ID: {networkConfig.chainId})
              </p>
            </div>
          </CardContent>
        </Card>

        <PremiumContent />
      </div>
    </div>
  );
}