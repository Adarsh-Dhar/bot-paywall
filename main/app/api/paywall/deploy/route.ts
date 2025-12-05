import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WORKER_TEMPLATE = `
export default {
  async fetch(request, env, ctx) {
    const CONFIG = {
      wallet: "{{WALLET}}",
      price: BigInt("{{PRICE_WEI}}"),
      rpc: "https://full.testnet.movementinfra.xyz/v1",
      saasVerifyUrl: "https://your-saas.com/api/paywall/verify"
    };

    const paymentHash = request.headers.get("X-Payment-Hash");

    if (!paymentHash) {
      return new Response(
        JSON.stringify({
          error: "Payment Required",
          paymentDetails: { receiver: CONFIG.wallet, amount: "{{PRICE_MOVE}}", currency: "MOVE" },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const verifyResp = await fetch(CONFIG.saasVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: paymentHash, receiver: CONFIG.wallet, price: "{{PRICE_WEI}}" }),
    });

    if (verifyResp.status !== 200) {
      return new Response("Invalid Payment", { status: 403 });
    }

    return fetch(request);
  },
};
`;

type DeployRequest = {
  userId: string;
  paywallConfig: {
    name: string;
    wallet: string;
    price: number;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeployRequest;
    const { userId, paywallConfig } = body || {};

    if (!userId || !paywallConfig?.name || !paywallConfig?.wallet || !paywallConfig?.price) {
      return NextResponse.json({ error: "Missing deployment inputs" }, { status: 400 });
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

    const priceInWei = BigInt(Math.floor(paywallConfig.price * 1e18)).toString();

    const finalCode = WORKER_TEMPLATE.replace("{{WALLET}}", paywallConfig.wallet)
      .replaceAll("{{PRICE_MOVE}}", paywallConfig.price.toString())
      .replaceAll("{{PRICE_WEI}}", priceInWei);

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
      return NextResponse.json(
        { error: cfData?.errors || "Cloudflare deploy failed" },
        { status: cfResponse.status || 500 }
      );
    }

    return NextResponse.json({ success: true, result: cfData?.result });
  } catch (err) {
    console.error("deploy error", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
