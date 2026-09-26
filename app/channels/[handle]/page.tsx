/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";

import { BrandChannelMembershipButton } from "@/components/brands/BrandChannelMembershipButton";
import { MintBackLeafIcon } from "@/components/ui/MintLeafBackButton";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BrandChannelPage({ params }: { params: Promise<{ handle: string }> }) {
  if (!hasSupabasePublicConfig()) notFound();
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="campus-app-shell min-h-dvh bg-[var(--app-background)] px-5 py-16 text-center text-[var(--app-text-primary)]">
        <h1 className="text-2xl font-black">Sign in to view Brand Channels</h1>
        <a href="/" className="mt-4 inline-flex text-sm font-bold text-[var(--app-accent)] underline">Open Campus Mint</a>
      </main>
    );
  }
  const { data: channel } = await supabase.from("brand_channels")
    .select("id,name,handle,description,status,brand_profiles(display_name,bio,website_url,verification_status)")
    .eq("handle", handle).eq("status", "active").maybeSingle();
  if (!channel) notFound();
  const brandValue = Array.isArray(channel.brand_profiles) ? channel.brand_profiles[0] : channel.brand_profiles;
  if (!brandValue || brandValue.verification_status !== "verified") notFound();
  const [{ data: membership }, { data: posts }] = await Promise.all([
    supabase.from("brand_channel_memberships").select("channel_id").eq("channel_id", channel.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("brand_channel_posts").select("id,body,created_at").eq("channel_id", channel.id).eq("status", "active").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <main className="campus-app-shell min-h-dvh bg-[var(--app-background)] px-5 py-8 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-2xl space-y-5">
        <a href="/" aria-label="Back to Campus Mint" className="interactive-pop inline-flex items-center gap-2 text-xs font-black text-[var(--app-accent)]">
          <MintBackLeafIcon className="h-5 w-5" />
          <span>Campus Mint</span>
        </a>
        <header className="rounded-[1.75rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-6">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--app-accent)]">Brand Channel</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-black">{channel.name}</h1><p className="mt-1 text-sm text-[var(--app-text-secondary)]">/{channel.handle}</p></div>
            {user.app_metadata?.account_type === "student" && <BrandChannelMembershipButton channelId={channel.id} initiallyJoined={Boolean(membership)} />}
          </div>
          {channel.description && <p className="mt-4 text-sm leading-6 text-[var(--app-text-secondary)]">{channel.description}</p>}
          <div className="mt-5 border-t border-[var(--app-border)] pt-4">
            <div className="flex items-center gap-2"><strong>{brandValue.display_name}</strong><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Verified Brand</span></div>
            {brandValue.bio && <p className="mt-2 text-sm text-[var(--app-text-secondary)]">{brandValue.bio}</p>}
            {brandValue.website_url && <a href={brandValue.website_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-[var(--app-accent)] underline">Visit external website ↗</a>}
          </div>
        </header>
        {posts?.length ? posts.map((post) => (
          <article key={post.id} className="rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
            <p className="text-sm leading-6">{post.body}</p>
            <time dateTime={post.created_at} className="mt-3 block text-[10px] text-[var(--app-text-secondary)]">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.created_at))}</time>
          </article>
        )) : <p className="rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-6 text-center text-sm text-[var(--app-text-secondary)]">{membership ? "No Channel posts yet." : "Join this Channel to view its posts."}</p>}
      </div>
    </main>
  );
}
