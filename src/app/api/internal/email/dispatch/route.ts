import { NextResponse, type NextRequest } from "next/server";
import { bearerAuthorized } from "@/lib/secure-compare";
import { serverEnv } from "@/lib/server-env";
import { dispatchEmails } from "@/services/email/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled email delivery. Called by Vercel Cron (which sends `Authorization: Bearer $CRON_SECRET`)
 * or any external scheduler with the same header. Returns counts only.
 */
async function handle(req: NextRequest) {
  if (!bearerAuthorized(req.headers.get("authorization"), serverEnv.cronSecret()))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await dispatchEmails({ limit: 40 });
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
