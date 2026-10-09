"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createInvalidationHub } from "./invalidationHub";

const hub = createInvalidationHub((accountId, invalidate) => {
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (disposed || document.visibilityState === "hidden") return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(invalidate, 150);
  };
  let disconnect = () => {};
  try {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`social:${accountId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "social_sync_revisions",
        filter: `user_id=eq.${accountId}`,
      }, schedule)
      .subscribe((status: string) => { if (status === "SUBSCRIBED") schedule(); });
    disconnect = () => { void supabase.removeChannel(channel); };
  } catch { /* Authorized HTTP refresh remains available when realtime is offline. */ }
  const fallback = setInterval(schedule, 30_000);
  window.addEventListener("campusmint:social-changed", schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", schedule);
  return () => {
    disposed = true;
    clearTimeout(refreshTimer);
    clearInterval(fallback);
    disconnect();
    window.removeEventListener("campusmint:social-changed", schedule);
    window.removeEventListener("focus", schedule);
    document.removeEventListener("visibilitychange", schedule);
  };
});

export const subscribeSocialChanges = hub.subscribe;
