import { NextResponse } from "next/server";

/**
 * Paywall deployment endpoint
 * This endpoint is deprecated and no longer supported.
 * Use Gatekeeper domain protection instead.
 */
export async function POST(req: Request) {
  return NextResponse.json(
    {
      error: "Endpoint deprecated",
      message: "Paywall deployment via this endpoint is no longer supported. Use Gatekeeper domain protection instead.",
      documentation: "/docs/gatekeeper"
    },
    { status: 410 }
  );
}
