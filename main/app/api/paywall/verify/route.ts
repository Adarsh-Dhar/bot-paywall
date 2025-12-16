import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { transactionSimulator } from "../../../lib/transaction-simulator";

type VerifyRequest = {
  txHash: string;
  receiver: string;
  price: string | number;
};

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

    // Use dummy transaction verification instead of blockchain RPC
    const validation = transactionSimulator.validateDummyPayment(
      txHash,
      priceWei,
      receiver
    );

    if (!validation.valid) {
      return NextResponse.json({ valid: false, reason: validation.reason }, { status: 403 });
    }

    await kv.set(replayKey, "used", { ex: 60 * 60 * 24 });

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("verify error", err);
    return NextResponse.json({ valid: false, reason: "Unexpected error" }, { status: 500 });
  }
}
