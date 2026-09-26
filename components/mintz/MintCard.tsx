"use client";

import { useCallback, useState } from "react";

import { ClubMintBadge } from "@/components/content/ClubMintBadge";
import { EventMintBadge } from "@/components/content/EventMintBadge";
import { EventAttendingContext } from "@/components/events/EventAttendingContext";
import { FloatingMintCard } from "@/components/mintz/FloatingMintCard";
import {
  CommentAction,
  CompactMetric,
  FriendEndorsementStack,
  PublicEndorsementAction,
  ShareAction,
} from "@/components/mintz/MintSocialActions";
import { MintCommentsSheet } from "@/components/mintz/MintCommentsSheet";
import { MintMediaCarousel } from "@/components/mintz/MintMediaCarousel";
import {
  PrivateAppreciationBurst,
  type ScreenPoint,
} from "@/components/mintz/PrivateAppreciationBurst";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { sampleEvents } from "@/data/events";
import { getOrganizationById } from "@/data/organizations";
import {
  type UniversityTheme,
  getAccountUniversityShortName,
} from "@/data/universities";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import { getMusicExternalUrl } from "@/lib/content/music";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { FloatingSurfaceOrigin } from "@/lib/motion/interaction";
import { resolvePublicMintMetrics } from "@/lib/social/mintInteractions";
import type { MintPermissionContext } from "@/lib/social/mintPermissions";
import type { ContentReport } from "@/types/content";
import type {
  CreateMintCommentInput,
  Mint,
  MintComment,
  MintShare,
} from "@/types/mint";
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
  privateAppreciated: boolean;
  publiclyEndorsed: boolean;
  friendEndorsementUsers: CampusMintUser[];
  additionalFriendEndorsementCount?: number;
  creatorAppreciationCount?: number | null;
  attendeeUsers?: CampusMintUser[];
  attendeeCount?: number | null;
  attending?: boolean;
  attendingDisabled?: boolean;
  onToggleAttending?: () => void;
  pinned: boolean;
  comments: MintComment[];
  likedCommentIds?: string[];
  repostedCommentIds?: string[];
  hiddenCommentIds?: string[];
  blockedCommentAuthorIds?: string[];
  onOpenProfile: (userId: string) => void;
  onPrivateAppreciation: () => void;
  onTogglePublicEndorsement: () => void;
  onTogglePin: () => void;
  onShare: (channel: MintShare["channel"]) => void;
  onComment: (input: CreateMintCommentInput) => void;
  onToggleCommentLike?: (commentId: string) => void;
  onToggleCommentRepost?: (commentId: string) => void;
  onHideComment?: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string) => void;
  onMessageUser?: (userId: string) => void;
  onUpdate: (patch: Partial<Pick<Mint, "caption" | "commentsEnabled">>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onReport: (reason: ContentReport["reason"]) => void;
  organizationMembershipStatus?: OrganizationMembershipStatus;
  onOrganizationMembershipAction?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
  onOpenVideo?: (mintId: string, mediaId: string) => void;
  surfaceActive?: boolean;
};

function expirationLabel(expiresAt: string | null, currentTime: number) {
  if (!expiresAt) return null;
  const minutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - currentTime) / 60_000),
  );
  if (minutes < 60) return `Temporary · ${minutes}m left`;
  return `Temporary · ${Math.ceil(minutes / 60)}h left`;
}

export function MintCard(props: MintCardProps) {
  const { mint, author, viewer, users, theme, currentTime } = props;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsOrigin, setCommentsOrigin] = useState<FloatingSurfaceOrigin | null>(null);
  const [appreciationBurst, setAppreciationBurst] = useState<{
    point: ScreenPoint;
    sequence: number;
  } | null>(null);
  const [pinPulse, setPinPulse] = useState(0);
  const [captionDraft, setCaptionDraft] = useState(mint.caption);
  const ownMint = viewer.account.id === mint.authorId;
  const organization = getOrganizationById(mint.organizationId);
  const taggedOrganizations = (mint.taggedOrganizationIds ?? []).flatMap(
    (organizationId) => {
      const tagged = getOrganizationById(organizationId);
      return tagged ? [tagged] : [];
    },
  );
  const canonicalEvent = mint.eventData?.eventId
    ? sampleEvents.find((event) => event.id === mint.eventData?.eventId) ?? null
    : null;
  const eventTitle = canonicalEvent?.title ?? mint.eventData?.title;
  const eventStartAt =
    canonicalEvent?.eventStartAt ?? mint.eventData?.eventStartAt ?? null;
  const eventEndAt =
    canonicalEvent?.eventEndAt ?? mint.eventData?.eventEndAt ?? null;
  const eventTimeZone =
    canonicalEvent?.timeZone ?? mint.eventData?.timeZone ?? null;
  const eventWhen = formatEventDateTimeRange(
    eventStartAt,
    eventEndAt,
    eventTimeZone,
  );
  const eventWhere =
    canonicalEvent?.location ?? mint.eventData?.location?.label;
  const attendeeCount = props.attendeeCount ?? canonicalEvent?.rsvpCount ?? null;
  const activeComments = props.comments.filter((item) => item.status === "active");
  const temporaryLabel = expirationLabel(mint.expiresAt, currentTime);
  const fallbackLabel = eventTitle ?? organization?.name ?? "A new Mint";
  const fallbackDetail =
    eventWhere ??
    organization?.shortDescription ??
    (mint.media.length === 0 ? mint.caption : null);
  const glowColor =
    mint.postType === "event"
      ? "#10b981"
      : mint.postType === "club"
        ? "#f97316"
        : theme.primary;
  const publicMetrics = resolvePublicMintMetrics({
    viewCount: mint.viewCount,
    commentCount: mint.commentCount,
    attendingCount: mint.postType === "event" ? attendeeCount : null,
    memberCount: organization?.memberCount ?? null,
  });

  function confirmPrivateAppreciation(point: ScreenPoint) {
    props.onPrivateAppreciation();
    setAppreciationBurst((current) => ({
      point,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  }

  const clearAppreciationBurst = useCallback(
    () => setAppreciationBurst(null),
    [],
  );

  async function shareMint() {
    const url = `${window.location.origin}/mint/${mint.id}`;
    const shareData = {
      title: "The Campus Mint",
      text:
        mint.caption?.trim() ||
        `Check out @${author.profile.username}'s Mint`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        props.onShare("external");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      props.onShare("copy_link");
    } catch {
      window.prompt("Copy Mint link", url);
      props.onShare("copy_link");
    }
  }

  return (
    <>
      <FloatingMintCard glowColor={glowColor} reducedMotion={props.reducedMotion}>
        <article className="mint-card-responsive overflow-hidden rounded-[1.5rem] bg-white sm:rounded-[1.75rem]" data-mint-card={mint.id} data-mint-type={mint.postType}>
          <header className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <button type="button" aria-label={`Open ${author.profile.displayName}'s profile`} onClick={() => props.onOpenProfile(author.account.id)}>
                <ProfileAvatar user={author} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => props.onOpenProfile(author.account.id)} className="block max-w-full truncate text-sm font-black text-slate-950 hover:underline">@{author.profile.username}</button>
                <p className="mt-0.5 truncate text-xs text-slate-500">{getAccountUniversityShortName(author.account)} · {formatRelativeTime(mint.createdAt, currentTime)}{temporaryLabel ? ` · ${temporaryLabel}` : ""}</p>
              </div>
              {mint.isDevelopment && <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">Demo</span>}
            </div>

            {(mint.postType === "event" || organization) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                {mint.postType === "event" && <EventMintBadge eventStartAt={eventStartAt} eventEndAt={eventEndAt} currentTime={currentTime} timeZone={eventTimeZone} />}
                {organization && <ClubMintBadge membershipStatus={props.organizationMembershipStatus} onMembershipAction={props.onOrganizationMembershipAction} />}
              </div>
            )}
          </header>

          <MintMediaCarousel media={mint.media} theme={theme} fallbackLabel={fallbackLabel} fallbackDetail={fallbackDetail} autoplayVideo={props.autoplayVideo} onDoubleTap={confirmPrivateAppreciation} onOpenVideo={(mediaId) => props.onOpenVideo?.(mint.id, mediaId)}>
            <div className="absolute bottom-2 right-1 z-20">
              <PublicEndorsementAction endorsed={props.publiclyEndorsed} onToggle={props.onTogglePublicEndorsement} />
            </div>
            {mint.postType !== "event" && <div className="absolute bottom-3 left-3 z-20"><FriendEndorsementStack users={props.friendEndorsementUsers} additionalCount={props.additionalFriendEndorsementCount ?? 0} theme={theme} /></div>}
          </MintMediaCarousel>

          <div className="p-3 sm:p-4 lg:p-5">
            {eventTitle && <div className="mb-3 rounded-2xl bg-slate-50 p-3 sm:mb-4 sm:p-4"><h3 className="font-black text-slate-950">{eventTitle}</h3>{eventWhen && <p className="mt-1 text-xs font-bold text-emerald-700">{eventWhen}</p>}{eventWhere && <p className="mt-1 text-xs text-slate-600">{eventWhere}</p>}{canonicalEvent?.status === "cancelled" && <p className="mt-2 text-xs font-black text-red-600">Canceled</p>}{canonicalEvent?.source && <a href={canonicalEvent.source.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-bold text-slate-500 underline">Event source</a>}</div>}
            {mint.postType === "event" && <EventAttendingContext users={props.attendeeUsers ?? []} attending={Boolean(props.attending)} disabled={props.attendingDisabled} theme={theme} onToggle={props.onToggleAttending} />}
            {organization && <p className="mb-3 text-sm font-black text-slate-900">{organization.name}</p>}
            {mint.caption && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{mint.caption}</p>}
            {mint.mentions.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.mentions.map((mention) => `@${mention.username}`).join(" ")}</p>}
            {mint.hashtags.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
            {taggedOrganizations.length > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">With {taggedOrganizations.map((tagged) => tagged.name).join(", ")}</p>}
            {(mint.location || mint.music) && <div className="mt-3 space-y-1 text-xs text-slate-500">{mint.location && <p>⌖ {mint.location.label}</p>}{mint.music && (getMusicExternalUrl(mint.music) ? <a href={getMusicExternalUrl(mint.music) ?? undefined} target="_blank" rel="noreferrer" className="inline-flex font-semibold hover:underline">♫ {mint.music.trackTitle} · {mint.music.artist}</a> : <p>♫ {mint.music.trackTitle} · {mint.music.artist}</p>)}</div>}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2" data-public-mint-metrics>
              {publicMetrics.map((metric) => <CompactMetric key={metric.kind} label={metric.label} />)}
              {ownMint && typeof props.creatorAppreciationCount === "number" && <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-500">{props.creatorAppreciationCount} appreciations · only you</span>}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center">
                <CommentAction count={mint.commentCount} disabled={!mint.commentsEnabled} onClick={(origin) => { setCommentsOrigin(origin); setCommentsOpen(true); }} />
                <ShareAction onClick={shareMint} />
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { setPinPulse((current) => current + 1); props.onTogglePin(); }} aria-pressed={props.pinned} aria-label={props.pinned ? "Unpin Mint" : "Pin Mint"} title={props.pinned ? "Pinned" : "Pin"} className="interactive-pop flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" style={{ color: props.pinned ? theme.primary : undefined }}>
                  <span key={pinPulse} className={pinPulse > 0 ? "cm-save-pop" : ""}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={props.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 4 6 6-3 1-4 4-1 5-2-2-4-4 5-1 4-4-1-5Z" /><path d="m9 15-5 5" /></svg>
                  </span>
                </button>
              </div>
            </div>

            <details className="mt-2">
              <summary className="w-fit cursor-pointer text-[11px] font-bold text-slate-400">More</summary>
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3">
                <button type="button" onClick={() => confirmPrivateAppreciation({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 })} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">{props.privateAppreciated ? "Privately appreciated" : "Appreciate privately"}</button>
                {ownMint ? (
                  <>
                    <textarea value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} rows={2} aria-label="Edit Mint caption" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
                    <button type="button" onClick={() => props.onUpdate({ caption: captionDraft })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Save caption</button>
                    <button type="button" onClick={() => props.onUpdate({ commentsEnabled: !mint.commentsEnabled })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{mint.commentsEnabled ? "Disable comments" : "Enable comments"}</button>
                    <button type="button" onClick={props.onArchive} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Archive</button>
                    <button type="button" onClick={props.onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete</button>
                  </>
                ) : <button type="button" onClick={() => props.onReport("other")} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500">Report Mint</button>}
              </div>
            </details>
          </div>
        </article>
      </FloatingMintCard>

      {appreciationBurst && <PrivateAppreciationBurst point={appreciationBurst.point} reducedMotion={Boolean(props.reducedMotion)} sequence={appreciationBurst.sequence} onComplete={clearAppreciationBurst} />}
      {commentsOpen && props.surfaceActive !== false && mint.commentsEnabled && (
        <MintCommentsSheet
          comments={activeComments}
          users={users}
          viewer={viewer}
          theme={theme}
          currentTime={currentTime}
          reducedMotion={Boolean(props.reducedMotion)}
          likedCommentIds={props.likedCommentIds ?? []}
          repostedCommentIds={props.repostedCommentIds ?? []}
          hiddenCommentIds={props.hiddenCommentIds ?? []}
          blockedCommentAuthorIds={props.blockedCommentAuthorIds ?? []}
          origin={commentsOrigin}
          onComment={props.onComment}
          onToggleCommentLike={props.onToggleCommentLike ?? (() => undefined)}
          onToggleCommentRepost={props.onToggleCommentRepost ?? (() => undefined)}
          onHideComment={props.onHideComment ?? (() => undefined)}
          onDeleteComment={props.onDeleteComment}
          onReportComment={props.onReportComment}
          onOpenProfile={props.onOpenProfile}
          onMessageUser={props.onMessageUser ?? props.onOpenProfile}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </>
  );
}
