import Link from "next/link";
import { notFound } from "next/navigation";

import { developmentUsers } from "@/data/development/users";
import { getUserRoleLabel } from "@/data/userRoles";
import { universities, getAccountUniversityName, getAccountUniversityShortName } from "@/data/universities";
import { normalizeUsername } from "@/lib/social/usernames";

export function generateStaticParams() {
  return developmentUsers.map((user) => ({ username: user.profile.usernameNormalized }));
}

export default async function PublicProfileRoute({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profileUser = developmentUsers.find((user) =>
    user.profile.usernameNormalized === normalizeUsername(username));
  if (!profileUser) notFound();
  const university =
    universities[profileUser.account.universityId];

  const universityName =
    getAccountUniversityName(profileUser.account);

  const universityShortName =
    getAccountUniversityShortName(profileUser.account);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="h-28" style={{ backgroundColor: university.primary }} />
        <div className="p-6"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Development profile route</p><h1 className="mt-2 text-3xl font-black">{profileUser.profile.displayName}</h1><p className="mt-1 text-sm text-slate-600">@{profileUser.profile.username} · {universityName} · {getUserRoleLabel(profileUser.account.role)}</p>{profileUser.socialSettings.accountType === "private" ? <div className="mt-6 rounded-2xl bg-slate-100 p-5"><p className="font-black">This account is private.</p><p className="mt-2 text-sm text-slate-600">Authenticated relationship checks will determine which Mintz are returned here later.</p></div> : <p className="mt-6 text-sm leading-6 text-slate-600">This route resolves the globally normalized username. The main local prototype supplies viewer-aware fields and social content.</p>}<Link href="/" className="mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: university.primary }}>Open Campus Mint</Link></div>
      </section>
    </main>
  );
}
