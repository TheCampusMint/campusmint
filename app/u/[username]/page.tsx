import Link from "next/link";
import { notFound } from "next/navigation";

import { developmentUsers } from "@/data/development/users";
import { getUserRoleLabel } from "@/data/userRoles";
import { universities, getAccountUniversityName } from "@/data/universities";
import { normalizeUsername } from "@/lib/social/usernames";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";

export function generateStaticParams() {
  return (areDevelopmentFixturesEnabled() ? developmentUsers : []).map((user) => ({ username: user.profile.usernameNormalized }));
}

export default async function PublicProfileRoute({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!areDevelopmentFixturesEnabled()) notFound();
  const profileUser = developmentUsers.find((user) =>
    user.profile.usernameNormalized === normalizeUsername(username));
  if (!profileUser) notFound();
  const university =
    universities[profileUser.account.universityId];

  const universityName =
    getAccountUniversityName(profileUser.account);

  return (
    <main className="min-h-dvh bg-slate-50 p-6 text-slate-950">
      <section className="cm-onboarding-scene mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="h-28" style={{ backgroundColor: university.primary }} />
        <div className="p-6"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Development profile route</p><h1 className="mt-2 text-3xl font-black">{profileUser.profile.displayName}</h1><p className="mt-1 text-sm text-slate-600">@{profileUser.profile.username} · {universityName} · {getUserRoleLabel(profileUser.account.role)}</p>{profileUser.socialSettings.accountType === "private" ? <div className="mt-6 rounded-2xl bg-slate-100 p-5"><p className="font-black">This account is private.</p></div> : null}<Link href="/" className="cm-pressable mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: university.primary }}>Open Campus Mint</Link></div>
      </section>
    </main>
  );
}
