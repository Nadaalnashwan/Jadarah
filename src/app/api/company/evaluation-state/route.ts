import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const params = z.object({ submission: z.string().uuid(), question: z.string().uuid() });

/**
 * The persisted state of the latest AI evaluation run of one question (proposal 0034), polled by the employer review
 * panel while an evaluation runs. A Route Handler (not a Server Action): Server Actions from one client are dispatched
 * one at a time, so a poll action would wait for the evaluation itself. Read-only; row-level security limits the rows
 * to the caller's company. Without proposal 0034 it answers { available: false }.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Same rules as the review page: active account, recruiter or company admin, organisation service active.
  if (session.profile.status !== "active" || !session.serviceActive || !["company_admin", "recruiter"].includes(session.activeMembership?.role ?? ""))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = params.safeParse({ submission: req.nextUrl.searchParams.get("submission"), question: req.nextUrl.searchParams.get("question") });
  if (!p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_ai_runs")
    .select("status, error_message, started_at, updated_at")
    .eq("submission_id", p.data.submission)
    .eq("question_id", p.data.question)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const headers = { "Cache-Control": "no-store" };
  if (error) return NextResponse.json({ available: false }, { headers });
  return NextResponse.json({ available: true, run: data ?? null }, { headers });
}
