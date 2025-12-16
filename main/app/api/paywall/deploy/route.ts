import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WORKER_TEMPLATE = `
export default {
  async fetch(request, env, ctx) {
    const CONFIG = {
      dummyWallet: "{{DUMMY_WALLET}}",
      dummyPrice: BigInt("{{DUMMY_PRICE_WEI}}"),
      dummyMode: true,
      dummySeed: "{{DUMMY_SEED}}",
      dummySuccessRate: {{DUMMY_SUCCESS_RATE}},
      saasVerifyUrl: "{{SAAS_VERIFY_URL}}"
    };

    // Dummy transaction verification logic (no blockchain calls)
    const paymentHash = request.headers.get("X-Payment-Hash");

    if (!paymentHash) {
      return new Response(
        JSON.stringify({
          error: "Payment Required",
          paymentDetails: { 
            receiver: CONFIG.dummyWallet, 
            amount: "{{DUMMY_PRICE_MOVE}}", 
            currency: "DUMMY_MOVE",
            mode: "dummy"
          },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify dummy payment through SaaS API (no blockchain interaction)
    const verifyResp = await fetch(CONFIG.saasVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        txHash: paymentHash, 
        receiver: CONFIG.dummyWallet, 
        price: "{{DUMMY_PRICE_WEI}}",
        mode: "dummy",
        seed: CONFIG.dummySeed
      }),
    });

    if (verifyResp.status !== 200) {
      const errorData = await verifyResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error: "Invalid Payment",
          reason: errorData.reason || "Payment verification failed",
          mode: "dummy"
        }),
        { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Payment verified - allow access to protected content
    return fetch(request);
  },
};
`;

type DeployRequest = {
  userId: string;
  paywallConfig: {
    name: string;
    dummyWallet: string;
    dummyPrice: number;
    dummySeed?: string;
    dummySuccessRate?: number;
    saasVerifyUrl?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeployRequest;
    const { userId, paywallConfig } = body || {};

    if (!userId || !paywallConfig?.name || !paywallConfig?.dummyWallet || !paywallConfig?.dummyPrice) {
      return NextResponse.json({ error: "Missing dummy transaction deployment inputs" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: user, error } = await supabase.from("users").select("*").eq("id", userId).single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.cf_access_token || !user.cf_account_id) {
      return NextResponse.json({ error: "User not connected to Cloudflare" }, { status: 401 });
    }

    // Configure dummy transaction parameters
    const dummyPriceInWei = BigInt(Math.floor(paywallConfig.dummyPrice * 1e18)).toString();
    const dummySeed = paywallConfig.dummySeed || `worker-${paywallConfig.name}-${Date.now()}`;
    const dummySuccessRate = Math.max(0, Math.min(1, paywallConfig.dummySuccessRate || 0.9));
    const saasVerifyUrl = paywallConfig.saasVerifyUrl || `${process.env.NEXTAUTH_URL}/api/paywall/verify`;

    // Validate dummy wallet address format
    if (!paywallConfig.dummyWallet.match(/^0x[0-9a-fA-F]{40}$/)) {
      return NextResponse.json({ error: "Invalid dummy wallet address format" }, { status: 400 });
    }

    // Validate dummy price
    if (paywallConfig.dummyPrice <= 0) {
      return NextResponse.json({ error: "Dummy price must be greater than 0" }, { status: 400 });
    }

    console.log(`Deploying dummy transaction worker: ${paywallConfig.name}`, {
      dummyWallet: paywallConfig.dummyWallet,
      dummyPrice: paywallConfig.dummyPrice,
      dummySeed: dummySeed,
      dummySuccessRate: dummySuccessRate
    });

    const finalCode = WORKER_TEMPLATE
      .replace("{{DUMMY_WALLET}}", paywallConfig.dummyWallet)
      .replaceAll("{{DUMMY_PRICE_MOVE}}", paywallConfig.dummyPrice.toString())
      .replaceAll("{{DUMMY_PRICE_WEI}}", dummyPriceInWei)
      .replaceAll("{{DUMMY_SEED}}", dummySeed)
      .replaceAll("{{DUMMY_SUCCESS_RATE}}", dummySuccessRate.toString())
      .replaceAll("{{SAAS_VERIFY_URL}}", saasVerifyUrl);

    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${user.cf_account_id}/workers/scripts/${paywallConfig.name}`;

    const cfResponse = await fetch(cfUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${user.cf_access_token}`,
        "Content-Type": "application/javascript",
      },
      body: finalCode,
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok || !cfData?.success) {
      console.error(`Dummy transaction worker deployment failed for ${paywallConfig.name}:`, cfData?.errors);
      return NextResponse.json(
        { error: cfData?.errors || "Dummy transaction worker deployment failed" },
        { status: cfResponse.status || 500 }
      );
    }

    console.log(`Successfully deployed dummy transaction worker: ${paywallConfig.name}`);
    return NextResponse.json({ 
      success: true, 
      result: cfData?.result,
      config: {
        mode: "dummy",
        dummyWallet: paywallConfig.dummyWallet,
        dummyPrice: paywallConfig.dummyPrice,
        dummySeed: dummySeed,
        dummySuccessRate: dummySuccessRate
      }
    });
  } catch (err) {
    console.error("deploy error", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
