import { NextResponse } from "next/server";

/**
 * Paywall verification endpoint
 * This endpoint is deprecated and no longer supported.
 * Use Gatekeeper domain protection instead.
 */
export async function POST(req: Request) {
  return NextResponse.json(
    {
      error: "Endpoint deprecated",
      message: "Paywall verification via this endpoint is no longer supported. Use Gatekeeper domain protection instead.",
      documentation: "/docs/gatekeeper"
    },
    { status: 410 }
  );
}
