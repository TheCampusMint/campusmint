"use client";

import { useState, type FormEvent } from "react";

import { EventMintBadge } from "@/components/content/EventMintBadge";
import { EventDetailsPanel } from "@/components/content/EventDetailsPanel";
import { ClubMintBadge } from "@/components/content/ClubMintBadge";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { sampleEvents } from "@/data/events";
import { getOrganizationById } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import { universities } from "@/data/universities";
import { canViewMintLikeCount, type MintPermissionContext } from "@/lib/social/mintPermissions";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import type { ContentReport } from "@/types/content";
import type { Mint, MintComment, MintShare } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";
import type { OrganizationMembershipStatus } from "@/types/organization";

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

export function MintCard(props: MintCardProps) {
  const { mint, author, viewer, users, theme, currentTime, permissionContext } = props;
  const [comment, setComment] = useState("");
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

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    props.onComment(comment.trim());
    setComment("");
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => props.onOpenProfile(author.account.id)}><ProfileAvatar user={author} size="sm" primaryColor={theme.primary} accentColor={theme.accent} /></button>
        <div className="min-w-0 flex-1"><button type="button" onClick={() => props.onOpenProfile(author.account.id)} className="truncate font-bold text-slate-950 hover:underline">{author.profile.displayName}</button><p className="text-xs text-slate-500">@{author.profile.username} · {universities[author.account.universityId].shortName} · {formatAge(mint.createdAt, currentTime)}</p></div>
        {mint.isDevelopment && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">Demo</span>}
      </header>

      {organization && <div className="mt-4 flex flex-wrap items-center gap-2"><ClubMintBadge membershipStatus={props.organizationMembershipStatus} onMembershipAction={props.onOrganizationMembershipAction} /><p className="text-sm font-black text-slate-900">{organization.name}</p></div>}
      {taggedOrganizations.length > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">Tagged club · {taggedOrganizations.map((tagged) => tagged.name).join(", ")}</p>}

      {mint.postType === "event" && <div className="mt-4"><EventMintBadge eventStartAt={eventStartAt} eventEndAt={eventEndAt} currentTime={currentTime} timeZone={eventTimeZone} /></div>}
      {mint.postType === "event" && <EventDetailsPanel title={eventTitle} when={eventWhen} where={eventWhere} description={mint.eventData?.description} linkedToCanonicalEvent={Boolean(canonicalEvent)} />}

      {mint.media.length > 0 && <div className={`mt-4 grid overflow-hidden rounded-xl bg-slate-100 ${mint.media.length > 1 ? "grid-cols-2 gap-1" : ""}`}>{mint.media.map((media) => <div key={media.id} className={media.type === "video" ? "flex aspect-video items-center justify-center bg-slate-900 text-sm font-bold text-white" : "flex aspect-[4/3] items-center justify-center text-sm font-bold text-slate-500"}>{media.type === "video" ? "Development video placeholder" : "Development image placeholder"}</div>)}</div>}
      {mint.caption && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{mint.caption}</p>}
      {mint.hashtags.length > 0 && <p className="mt-2 text-sm font-semibold" style={{ color: theme.primary }}>{mint.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
      {(mint.location || mint.music) && <div className="mt-3 space-y-1 text-xs text-slate-500">{mint.location && <p>Location · {mint.location.label}</p>}{mint.music && <p>Music · {mint.music.trackTitle} — {mint.music.artist}</p>}</div>}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={props.onToggleLike} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{props.liked ? "Liked" : "Like"}{canViewMintLikeCount(permissionContext) ? ` · ${mint.likeCount}` : ""}</button>
        <button type="button" onClick={props.onToggleSave} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{props.saved ? "Saved" : "Save"}</button>
        <button type="button" onClick={() => props.onShare("copy_link")} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Share</button>
        <span className="self-center text-xs text-slate-500">{mint.commentsEnabled ? `${mint.commentCount} comments` : "Comments off"}</span>
      </div>

      {mint.commentsEnabled && <div className="mt-4 space-y-3">{props.comments.filter((item) => item.status === "active").map((item) => { const commentAuthor = users.find((user) => user.account.id === item.authorId); return <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold text-slate-800">{commentAuthor?.profile.displayName ?? "Development user"}</p><p className="mt-1 text-slate-600">{item.body}</p>{item.authorId === viewer.account.id ? <button type="button" onClick={() => props.onDeleteComment(item.id)} className="mt-2 text-xs font-bold text-rose-700">Delete</button> : <button type="button" onClick={() => props.onReportComment(item.id)} className="mt-2 text-xs font-bold text-slate-400">Report comment</button>}</div>; })}<form onSubmit={submitComment} className="flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button className="rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Post</button></form></div>}

      {ownMint ? <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Mint controls</summary><div className="mt-3 space-y-3"><textarea value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" onClick={() => props.onUpdate({ caption: captionDraft })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Save caption</button><div className="flex flex-wrap gap-2"><button type="button" onClick={() => props.onUpdate({ likesVisible: !mint.likesVisible })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.likesVisible ? "Hide like count" : "Show like count"}</button><button type="button" onClick={() => props.onUpdate({ commentsEnabled: !mint.commentsEnabled })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.commentsEnabled ? "Disable comments" : "Enable comments"}</button><button type="button" onClick={props.onArchive} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Archive</button><button type="button" onClick={props.onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div></div></details> : <button type="button" onClick={() => props.onReport("other")} className="mt-4 text-xs font-bold text-slate-400">Report Mint</button>}
    </article>
  );
}
