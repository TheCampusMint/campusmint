import { NextResponse } from "next/server";

import { createSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.CAMPUS_DATA_SYNC_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ ok: false, message: "Media cleanup is not configured." }, { status: 503 });
  const admin = createSupabaseAdminClient();
  const { data: expiredCount, error: expirationError } = await admin.rpc("mark_expired_social_content");
  if (expirationError) return NextResponse.json({ ok: false, message: "Expiration could not be recorded." }, { status: 503 });
  const now = new Date();
  const { data: jobs, error: jobsError } = await admin.from("media_cleanup_jobs")
    .select("id,bucket_id,storage_path,attempt_count")
    .in("status", ["pending", "retry"])
    .lte("due_at", now.toISOString())
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(50);
  if (jobsError) return NextResponse.json({ ok: false, message: "Cleanup jobs are unavailable." }, { status: 503 });

  let complete = 0;
  let retried = 0;
  for (const job of jobs ?? []) {
    await admin.from("media_cleanup_jobs").update({ status: "processing" }).eq("id", job.id);
    const { error } = await admin.storage.from(job.bucket_id).remove([job.storage_path]);
    if (!error) {
      complete += 1;
      await admin.from("media_cleanup_jobs").update({ status: "complete", completed_at: new Date().toISOString(), last_error_code: null }).eq("id", job.id);
      continue;
    }
    retried += 1;
    const attempts = Number(job.attempt_count) + 1;
    const terminal = attempts >= 10;
    const retryDelayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
    await admin.from("media_cleanup_jobs").update({
      status: terminal ? "failed" : "retry",
      attempt_count: attempts,
      last_error_code: typeof error === "object" && error && "name" in error ? String(error.name) : "storage_remove_failed",
      next_attempt_at: terminal ? null : new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
    }).eq("id", job.id);
  }
  return NextResponse.json({ ok: retried === 0, expiredCount: Number(expiredCount ?? 0), processed: (jobs ?? []).length, complete, retried }, { headers: { "Cache-Control": "no-store" } });
}
