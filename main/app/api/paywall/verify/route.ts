import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

type VerifyRequest = {
  txHash: string;
  receiver: string;
  price: string | number;
};

const MOVEMENT_RPC = process.env.MOVEMENT_RPC_URL || "https://full.testnet.movementinfra.xyz/v1";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerifyRequest;
    const { txHash, receiver, price } = body || {};

    if (!txHash || !receiver || price === undefined) {
      return NextResponse.json({ valid: false, reason: "Missing fields" }, { status: 400 });
    }

    const priceWei = BigInt(price);

    const replayKey = `tx:${txHash}`;
    const isUsed = await kv.get(replayKey);
    if (isUsed) {
      return NextResponse.json({ valid: false, reason: "Hash already used" }, { status: 403 });
    }

    const rpcResp = await fetch(MOVEMENT_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionByHash",
        params: [txHash],
        id: 1,
      }),
    });

    if (!rpcResp.ok) {
      return NextResponse.json({ valid: false, reason: "RPC error" }, { status: 502 });
    }

    const txData = await rpcResp.json();
    const tx = txData?.result;

    if (
      !tx ||
      !tx.to ||
      tx.to.toLowerCase() !== receiver.toLowerCase() ||
      BigInt(tx.value) < priceWei
    ) {
      return NextResponse.json({ valid: false, reason: "Invalid on-chain data" }, { status: 403 });
    }

    await kv.set(replayKey, "used", { ex: 60 * 60 * 24 });

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("verify error", err);
    return NextResponse.json({ valid: false, reason: "Unexpected error" }, { status: 500 });
  }
}
