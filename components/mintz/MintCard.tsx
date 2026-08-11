"use client";

import { useState } from "react";

import { ClubMintBadge } from "@/components/content/ClubMintBadge";
import { EventMintBadge } from "@/components/content/EventMintBadge";
import { FloatingMintCard } from "@/components/mintz/FloatingMintCard";
import { MintCommentsSheet } from "@/components/mintz/MintCommentsSheet";
import { MintMediaCarousel } from "@/components/mintz/MintMediaCarousel";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { sampleEvents } from "@/data/events";
import { getOrganizationById } from "@/data/organizations";
import { universities, type UniversityTheme } from "@/data/universities";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
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
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
};

function expirationLabel(expiresAt: string | null, currentTime: number) {
  if (!expiresAt) return null;
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - currentTime) / 60_000));
  if (minutes < 60) return `Temporary · ${minutes}m left`;
  return `Temporary · ${Math.ceil(minutes / 60)}h left`;
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[29px] w-[29px]"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 27.2S4.8 20.5 4.8 11.8c0-4.3 3.1-7 6.8-7 2.2 0 3.7 1 4.4 2.4.8-1.4 2.3-2.4 4.5-2.4 3.7 0 6.8 2.7 6.8 7C27.3 20.5 16 27.2 16 27.2Z" />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[28px] w-[28px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 6.5h22v15H15l-6.8 5v-5H5V6.5Z" />
      <path d="M10 12h12M10 16.5h8" strokeWidth="2" opacity=".82" />
    </svg>
  );
}

function AttendeesGlyph() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[29px] w-[29px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="10.5" r="4.2" />
      <circle cx="22" cy="12" r="3.4" opacity=".82" />
      <path d="M4.5 27c.3-5.7 3.1-9 7.6-9 4.6 0 7.4 3.3 7.7 9H4.5Z" />
      <path d="M18.2 27c-.1-3.2-.9-5.7-2.5-7.3 1.7-1.1 3.8-1.4 5.8-.9 3.8.8 5.9 3.5 6 8.2h-9.3Z" opacity=".82" />
    </svg>
  );
}

export function MintCard(props: MintCardProps) {
  const { mint, author, viewer, users, theme, currentTime, permissionContext } = props;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
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
  const attendeeCount = canonicalEvent?.rsvpCount ?? 0;
  const activeComments = props.comments.filter((item) => item.status === "active");
  const temporaryLabel = expirationLabel(mint.expiresAt, currentTime);
  const fallbackLabel = eventTitle ?? organization?.name ?? "A new Mint";
  const fallbackDetail = eventWhere ?? organization?.shortDescription ?? (mint.media.length === 0 ? mint.caption : null);
  const glowColor = mint.postType === "event" ? "#10b981" : mint.postType === "club" ? "#f97316" : theme.primary;
  const canShowLikeCount = canViewMintLikeCount(permissionContext);
 
  function toggleLike() {
    setLikePulse((current) => current + 1);
    props.onToggleLike();
  }

  return (
    <>
    <FloatingMintCard glowColor={glowColor} reducedMotion={props.reducedMotion}>
      <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]" data-mint-card={mint.id} data-mint-type={mint.postType}>
        <header className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button type="button" aria-label={`Open ${author.profile.displayName}'s profile`} onClick={() => props.onOpenProfile(author.account.id)}><ProfileAvatar user={author} size="sm" primaryColor={theme.primary} accentColor={theme.accent} /></button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => props.onOpenProfile(author.account.id)} className="block max-w-full truncate text-sm font-black text-slate-950 hover:underline">@{author.profile.username}</button>
              <p className="mt-0.5 truncate text-xs text-slate-500">{universities[author.account.universityId].shortName} · {formatRelativeTime(mint.createdAt, currentTime)}{temporaryLabel ? ` · ${temporaryLabel}` : ""}</p>
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

        <MintMediaCarousel media={mint.media} theme={theme} fallbackLabel={fallbackLabel} fallbackDetail={fallbackDetail} autoplayVideo={props.autoplayVideo} onDoubleTap={toggleLike}>
          <div className="absolute bottom-4 right-3 flex flex-col items-center gap-2 sm:bottom-5 sm:right-4" aria-label="Mint actions">
            <button type="button" onClick={toggleLike} aria-pressed={props.liked} aria-label={props.liked ? "Unlike Mint" : "Like Mint"} className={`interactive-pop flex min-h-12 min-w-12 flex-col items-center justify-center p-2 text-xs font-black focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${props.liked ? "text-rose-500" : "text-white"}`}>
              <span key={likePulse} className={likePulse > 0 ? "like-pop" : ""} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.88))" }}><HeartGlyph filled={props.liked} /></span>
              {canShowLikeCount && <span className="mt-0.5 text-[10px] leading-none text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>{mint.likeCount}</span>}
            </button>
            <button type="button" disabled={!mint.commentsEnabled} onClick={() => setCommentsOpen(true)} aria-expanded={commentsOpen} aria-label="Open Mint comments" className="interactive-pop flex min-h-12 min-w-12 flex-col items-center justify-center p-2 text-xs font-black text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50">
              <span style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.88))" }}><CommentGlyph /></span>
              <span className="mt-1 text-[10px] leading-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>{mint.commentCount}</span>
            </button>
            {mint.postType === "event" && (
              <button
                type="button"
                onClick={() => setAttendeesOpen((current) => !current)}
                aria-expanded={attendeesOpen}
                aria-label={`${attendeeCount} people attending`}
                title="People attending"
                className="interactive-pop flex min-h-12 min-w-12 flex-col items-center justify-center p-2 text-xs font-black text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              >
                <span style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.88))" }}>
                  <AttendeesGlyph />
                </span>
                <span className="mt-0.5 text-[10px] leading-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>
                  {attendeeCount}
                </span>
              </button>
            )}
          </div>
          {attendeesOpen && mint.postType === "event" && (
            <div className="absolute bottom-4 left-3 rounded-full bg-slate-950/65 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md sm:bottom-5 sm:left-4">
              {attendeeCount} attending
            </div>
          )}
        </MintMediaCarousel>

        <div className="p-4 sm:p-5">
          {eventTitle && <div className="mb-4 rounded-2xl bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]"><h3 className="font-black text-slate-950">{eventTitle}</h3>{eventWhen && <p className="mt-1 text-xs font-bold text-emerald-700">{eventWhen}</p>}{eventWhere && <p className="mt-1 text-xs text-slate-600">{eventWhere}</p>}</div>}
          {organization && <p className="mb-3 text-sm font-black text-slate-900">{organization.name}</p>}
          {mint.caption && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{mint.caption}</p>}
          {mint.mentions.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.mentions.map((mention) => `@${mention.username}`).join(" ")}</p>}
          {mint.hashtags.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
          {taggedOrganizations.length > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">With {taggedOrganizations.map((tagged) => tagged.name).join(", ")}</p>}
          {(mint.location || mint.music) && <div className="mt-3 space-y-1 text-xs text-slate-500">{mint.location && <p>⌖ {mint.location.label}</p>}{mint.music && <p>♫ {mint.music.trackTitle} — {mint.music.artist}</p>}</div>}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <p className="font-semibold text-slate-500">{canShowLikeCount ? `${mint.likeCount} ${mint.likeCount === 1 ? "like" : "likes"}` : "Likes private"} · {mint.commentCount} {mint.commentCount === 1 ? "comment" : "comments"}</p>
            <div className="flex gap-1">
              <button type="button" onClick={props.onToggleSave} className="rounded-full px-3 py-2 font-bold text-slate-600 hover:bg-slate-100">{props.saved ? "Saved" : "Save"}</button>
              <button type="button" onClick={() => props.onShare("copy_link")} className="rounded-full px-3 py-2 font-bold text-slate-600 hover:bg-slate-100">Share</button>
            </div>
          </div>

          {ownMint ? <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-400">Mint controls</summary><div className="mt-3 space-y-3 rounded-2xl border border-slate-100 p-3"><textarea value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" onClick={() => props.onUpdate({ caption: captionDraft })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Save caption</button><div className="flex flex-wrap gap-2"><button type="button" onClick={() => props.onUpdate({ likesVisible: !mint.likesVisible })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.likesVisible ? "Hide like count" : "Show like count"}</button><button type="button" onClick={() => props.onUpdate({ commentsEnabled: !mint.commentsEnabled })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.commentsEnabled ? "Disable comments" : "Enable comments"}</button><button type="button" onClick={props.onArchive} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Archive</button><button type="button" onClick={props.onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div></div></details> : <button type="button" onClick={() => props.onReport("other")} className="mt-3 text-xs font-bold text-slate-400">Report Mint</button>}
        </div>
      </article>
    </FloatingMintCard>
    {commentsOpen && mint.commentsEnabled && <MintCommentsSheet comments={activeComments} users={users} viewer={viewer} theme={theme} currentTime={currentTime} reducedMotion={Boolean(props.reducedMotion)} onComment={props.onComment} onDeleteComment={props.onDeleteComment} onReportComment={props.onReportComment} onClose={() => setCommentsOpen(false)} />}
    </>
  );
}
