"use client";

import { useState, type FormEvent } from "react";

import { ClubMintBadge } from "@/components/content/ClubMintBadge";
import { EventMintBadge } from "@/components/content/EventMintBadge";
import { FloatingMintCard } from "@/components/mintz/FloatingMintCard";
import { MintMediaCarousel } from "@/components/mintz/MintMediaCarousel";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { sampleEvents } from "@/data/events";
import { getOrganizationById } from "@/data/organizations";
import { universities, type UniversityTheme } from "@/data/universities";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import { canViewMintLikeCount, type MintPermissionContext } from "@/lib/social/mintPermissions";
import type { ContentReport } from "@/types/content";
import type { Mint, MintComment, MintShare } from "@/types/mint";
import type { OrganizationMembershipStatus } from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";

type MintCardProps = {
  mint: Mint;
  author: CampusMintUser;
  viewer: CampusMintUser;
  users: CampusMintUser[];
  theme: UniversityTheme;
  currentTime: number;
  permissionContext: MintPermissionContext;
  liked: boolean;
  saved: boolean;
  comments: MintComment[];
  onOpenProfile: (userId: string) => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: (channel: MintShare["channel"]) => void;
  onComment: (body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string) => void;
  onUpdate: (patch: Partial<Pick<Mint, "caption" | "likesVisible" | "commentsEnabled">>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onReport: (reason: ContentReport["reason"]) => void;
  organizationMembershipStatus?: OrganizationMembershipStatus;
  onOrganizationMembershipAction?: () => void;
};

function formatAge(createdAt: string, currentTime: number) {
  const minutes = Math.max(0, Math.floor((currentTime - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function expirationLabel(expiresAt: string | null, currentTime: number) {
  if (!expiresAt) return null;
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - currentTime) / 60_000));
  if (minutes < 60) return `Temporary · ${minutes}m left`;
  return `Temporary · ${Math.ceil(minutes / 60)}h left`;
}

export function MintCard(props: MintCardProps) {
  const { mint, author, viewer, users, theme, currentTime, permissionContext } = props;
  const [comment, setComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(mint.caption);
  const ownMint = viewer.account.id === mint.authorId;
  const organization = getOrganizationById(mint.organizationId);
  const taggedOrganizations = (mint.taggedOrganizationIds ?? []).flatMap((organizationId) => {
    const tagged = getOrganizationById(organizationId);
    return tagged ? [tagged] : [];
  });
  const canonicalEvent = mint.eventData?.eventId
    ? sampleEvents.find((event) => event.id === mint.eventData?.eventId) ?? null
    : null;
  const eventTitle = canonicalEvent?.title ?? mint.eventData?.title;
  const eventStartAt = canonicalEvent?.eventStartAt ?? mint.eventData?.eventStartAt ?? null;
  const eventEndAt = canonicalEvent?.eventEndAt ?? mint.eventData?.eventEndAt ?? null;
  const eventTimeZone = canonicalEvent?.timeZone ?? mint.eventData?.timeZone ?? null;
  const eventWhen = formatEventDateTimeRange(eventStartAt, eventEndAt, eventTimeZone);
  const eventWhere = canonicalEvent?.location ?? mint.eventData?.location?.label;
  const activeComments = props.comments.filter((item) => item.status === "active");
  const temporaryLabel = expirationLabel(mint.expiresAt, currentTime);
  const fallbackLabel = eventTitle ?? organization?.name ?? "A new Mint";
  const fallbackDetail = eventWhere ?? organization?.shortDescription ?? (mint.media.length === 0 ? mint.caption : null);
  const glowColor = mint.postType === "event" ? "#10b981" : mint.postType === "club" ? "#f97316" : theme.primary;

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    props.onComment(comment.trim());
    setComment("");
  }

  return (
    <FloatingMintCard glowColor={glowColor}>
      <article className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]" data-mint-card={mint.id}>
        <header className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button type="button" aria-label={`Open ${author.profile.displayName}'s profile`} onClick={() => props.onOpenProfile(author.account.id)}><ProfileAvatar user={author} size="sm" primaryColor={theme.primary} accentColor={theme.accent} /></button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => props.onOpenProfile(author.account.id)} className="block max-w-full truncate text-sm font-black text-slate-950 hover:underline">@{author.profile.username}</button>
              <p className="mt-0.5 truncate text-xs text-slate-500">{universities[author.account.universityId].shortName} · {formatAge(mint.createdAt, currentTime)}{temporaryLabel ? ` · ${temporaryLabel}` : ""}</p>
            </div>
            {mint.isDevelopment && <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">Demo</span>}
          </div>

          {(mint.postType === "event" || organization) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {mint.postType === "event" && <EventMintBadge eventStartAt={eventStartAt} eventEndAt={eventEndAt} currentTime={currentTime} timeZone={eventTimeZone} />}
              {organization && <ClubMintBadge membershipStatus={props.organizationMembershipStatus} onMembershipAction={props.onOrganizationMembershipAction} />}
            </div>
          )}
        </header>

        <MintMediaCarousel media={mint.media} theme={theme} fallbackLabel={fallbackLabel} fallbackDetail={fallbackDetail}>
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button type="button" onClick={props.onToggleLike} aria-pressed={props.liked} aria-label={props.liked ? "Unlike Mint" : "Like Mint"} className="flex h-11 items-center gap-2 rounded-full bg-slate-950/68 px-4 text-sm font-black text-white shadow-lg backdrop-blur-md">
              <span aria-hidden="true" className="text-lg">{props.liked ? "♥" : "♡"}</span>
              {canViewMintLikeCount(permissionContext) && <span>{mint.likeCount}</span>}
            </button>
            <button type="button" disabled={!mint.commentsEnabled} onClick={() => setCommentsOpen((current) => !current)} aria-expanded={commentsOpen} aria-label="Open Mint comments" className="flex h-11 items-center gap-2 rounded-full bg-slate-950/68 px-4 text-sm font-black text-white shadow-lg backdrop-blur-md disabled:opacity-50">
              <span aria-hidden="true" className="text-base">◯</span><span>{mint.commentCount}</span>
            </button>
          </div>
        </MintMediaCarousel>

        <div className="p-4 sm:p-5">
          {eventTitle && <div className="mb-4 rounded-2xl bg-emerald-50 p-4"><h3 className="font-black text-emerald-950">{eventTitle}</h3>{eventWhen && <p className="mt-1 text-xs font-bold text-emerald-800">{eventWhen}</p>}{eventWhere && <p className="mt-1 text-xs text-emerald-800">{eventWhere}</p>}</div>}
          {organization && <p className="mb-3 text-sm font-black text-slate-900">{organization.name}</p>}
          {mint.caption && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{mint.caption}</p>}
          {mint.mentions.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.mentions.map((mention) => `@${mention.username}`).join(" ")}</p>}
          {mint.hashtags.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
          {taggedOrganizations.length > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">With {taggedOrganizations.map((tagged) => tagged.name).join(", ")}</p>}
          {(mint.location || mint.music) && <div className="mt-3 space-y-1 text-xs text-slate-500">{mint.location && <p>⌖ {mint.location.label}</p>}{mint.music && <p>♫ {mint.music.trackTitle} — {mint.music.artist}</p>}</div>}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <p className="font-semibold text-slate-500">{mint.likesVisible ? `${mint.likeCount} ${mint.likeCount === 1 ? "like" : "likes"}` : "Likes private"} · {mint.commentCount} {mint.commentCount === 1 ? "comment" : "comments"}</p>
            <div className="flex gap-1">
              <button type="button" onClick={props.onToggleSave} className="rounded-full px-3 py-2 font-bold text-slate-600 hover:bg-slate-100">{props.saved ? "Saved" : "Save"}</button>
              <button type="button" onClick={() => props.onShare("copy_link")} className="rounded-full px-3 py-2 font-bold text-slate-600 hover:bg-slate-100">Share</button>
            </div>
          </div>

          {commentsOpen && mint.commentsEnabled && (
            <section aria-label="Mint comments" className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-3">
              {activeComments.length === 0 && <p className="text-center text-xs text-slate-500">No comments yet.</p>}
              {activeComments.map((item) => {
                const commentAuthor = users.find((user) => user.account.id === item.authorId);
                return <div key={item.id} className="rounded-xl bg-white p-3 text-sm shadow-sm"><p className="font-black text-slate-800">{commentAuthor?.profile.displayName ?? "Development user"}</p><p className="mt-1 text-slate-600">{item.body}</p>{item.authorId === viewer.account.id ? <button type="button" onClick={() => props.onDeleteComment(item.id)} className="mt-2 text-xs font-bold text-rose-700">Delete</button> : <button type="button" onClick={() => props.onReportComment(item.id)} className="mt-2 text-xs font-bold text-slate-400">Report comment</button>}</div>;
              })}
              <form onSubmit={submitComment} className="flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" aria-label="Add a comment" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /><button className="rounded-xl px-3 py-2 text-sm font-black" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Post</button></form>
            </section>
          )}

          {ownMint ? <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-400">Mint controls</summary><div className="mt-3 space-y-3 rounded-2xl border border-slate-100 p-3"><textarea value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" onClick={() => props.onUpdate({ caption: captionDraft })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Save caption</button><div className="flex flex-wrap gap-2"><button type="button" onClick={() => props.onUpdate({ likesVisible: !mint.likesVisible })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.likesVisible ? "Hide like count" : "Show like count"}</button><button type="button" onClick={() => props.onUpdate({ commentsEnabled: !mint.commentsEnabled })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.commentsEnabled ? "Disable comments" : "Enable comments"}</button><button type="button" onClick={props.onArchive} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Archive</button><button type="button" onClick={props.onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div></div></details> : <button type="button" onClick={() => props.onReport("other")} className="mt-3 text-xs font-bold text-slate-400">Report Mint</button>}
        </div>
      </article>
    </FloatingMintCard>
  );
}
