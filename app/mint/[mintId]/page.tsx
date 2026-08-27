import Link from "next/link";
import { notFound } from "next/navigation";

import { EventMintBadge } from "@/components/content/EventMintBadge";
import { EventDetailsPanel } from "@/components/content/EventDetailsPanel";
import { ClubMintBadge } from "@/components/content/ClubMintBadge";
import { createDevelopmentMintz,
  DEVELOPMENT_MINT_REFERENCE_TIME,
  getDevelopmentMintById } from "@/data/development/mintz";
import { CURRENT_DEVELOPMENT_USER_ID,
  getDevelopmentUserById } from "@/data/development/users";
import { sampleEvents } from "@/data/events";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityShortName,
  getAccountUniversityDisplayTheme,
} from "@/data/universities";
import { developmentOrganizationMemberships, getOrganizationById } from "@/data/organizations";
import { canViewMint } from "@/lib/social/mintPermissions";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import { canViewOrganizationContent } from "@/lib/organizationPermissions";
import { membershipStatusFor } from "@/lib/organizationMembership";

export function generateStaticParams() {
  return createDevelopmentMintz(DEVELOPMENT_MINT_REFERENCE_TIME).map((mint) => ({ mintId: mint.id }));
}

export default async function MintRoute({ params }: { params: Promise<{ mintId: string }> }) {
  const { mintId } = await params;
  const currentTime = DEVELOPMENT_MINT_REFERENCE_TIME;
  const mint = getDevelopmentMintById(mintId, currentTime);
  if (!mint) notFound();
  const viewer = getDevelopmentUserById(CURRENT_DEVELOPMENT_USER_ID);
  const author = getDevelopmentUserById(mint.authorId);
  if (!viewer || !author) notFound();
  const organization = getOrganizationById(mint.organizationId);
  const viewerConfiguredUniversityId =
    getAccountConfiguredUniversityId(
      viewer.account,
    );

  const visible =
    canViewMint({
      mint,
      viewer,
      author,
      friendshipStatus: "none",
      viewerFollowsAuthor: false,
      authorFollowsViewer: false,
      blocked: false,
      currentTime,
    }) &&
    (
      !organization ||
      Boolean(
        viewerConfiguredUniversityId &&
        canViewOrganizationContent(
          {
            id: viewer.account.id,
            universityId:
              viewerConfiguredUniversityId,
          },
          organization.id,
          mint.organizationAudience,
          developmentOrganizationMemberships,
        ),
      )
    );
  const membershipStatus = organization ? membershipStatusFor(developmentOrganizationMemberships, viewer.account.id, organization.id) : undefined;
  const theme =
    getAccountUniversityDisplayTheme(
      viewer.account,
    );
  const canonicalEvent = mint.eventData?.eventId ? sampleEvents.find((event) => event.id === mint.eventData?.eventId) ?? null : null;
  const eventStartAt = canonicalEvent?.eventStartAt ?? mint.eventData?.eventStartAt ?? null;
  const eventEndAt = canonicalEvent?.eventEndAt ?? mint.eventData?.eventEndAt ?? null;
  const eventTimeZone = canonicalEvent?.timeZone ?? mint.eventData?.timeZone ?? null;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <article className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Development Mint route</p>
        {!visible ? <div className="mt-6 rounded-2xl bg-slate-100 p-6 text-center"><h1 className="font-black">This Mint is unavailable.</h1><p className="mt-2 text-sm text-slate-600">It may be private, members-only, expired, archived, removed, or outside this viewer&apos;s discovery scope. No preview data is exposed.</p></div> : <><div className="mt-4"><h1 className="text-xl font-black">{author.profile.displayName}</h1><p className="text-sm text-slate-500">@{author.profile.username} · {getAccountUniversityShortName(author.account)}</p></div>{organization && <div className="mt-4 flex flex-wrap items-center gap-2"><ClubMintBadge membershipStatus={membershipStatus} /><p className="text-sm font-black">{organization.name}</p></div>}{mint.postType === "event" && <div className="mt-4"><EventMintBadge eventStartAt={eventStartAt} eventEndAt={eventEndAt} currentTime={currentTime} timeZone={eventTimeZone} /><EventDetailsPanel title={canonicalEvent?.title ?? mint.eventData?.title} when={formatEventDateTimeRange(eventStartAt, eventEndAt, eventTimeZone)} where={canonicalEvent?.location ?? mint.eventData?.location?.label} description={mint.eventData?.description} linkedToCanonicalEvent={Boolean(canonicalEvent)} /></div>}<p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{mint.caption}</p>{mint.hashtags.length > 0 && <p className="mt-2 text-sm font-bold" style={{ color: theme.primary }}>{mint.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}</>}
        <Link href="/" className="mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Open Campus Mint</Link>
      </article>
    </main>
  );
}
