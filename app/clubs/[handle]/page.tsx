import Link from "next/link";
import { notFound } from "next/navigation";

import { developmentOrganizations, getOrganizationByHandle } from "@/data/organizations";
import { sampleEvents } from "@/data/events";
import { universities } from "@/data/universities";

export function generateStaticParams() {
  return developmentOrganizations
    .filter((organization) => organization.recordStatus === "active")
    .map((organization) => ({ handle: organization.handle }));
}

export default async function ClubHandlePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const organization = getOrganizationByHandle(handle);
  if (!organization || organization.recordStatus !== "active") notFound();
  const theme = universities[organization.universityId];
  const events = sampleEvents.filter((event) => event.organizationId === organization.id);

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <header className="p-6 sm:p-8" style={{ backgroundColor: theme.primary, color: theme.secondary }}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-75">{theme.name}</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{organization.name}</h1>
          <p className="mt-3 text-sm font-bold opacity-85">Club handle · {organization.handle}</p>
        </header>
        <div className="space-y-7 p-6 sm:p-8">
          <section><h2 className="text-lg font-black">About</h2><p className="mt-2 text-sm leading-7 text-slate-600">{organization.fullDescription}</p></section>
          <dl className="grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2"><div><dt className="text-xs font-black uppercase tracking-wide text-slate-400">Category</dt><dd className="mt-1 font-semibold">{organization.category}</dd></div><div><dt className="text-xs font-black uppercase tracking-wide text-slate-400">Membership</dt><dd className="mt-1 font-semibold capitalize">{organization.membershipType}</dd></div><div><dt className="text-xs font-black uppercase tracking-wide text-slate-400">Meeting location</dt><dd className="mt-1 font-semibold">{organization.meetingLocation}</dd></div><div><dt className="text-xs font-black uppercase tracking-wide text-slate-400">Meeting schedule</dt><dd className="mt-1 font-semibold">{organization.meetingSchedule}</dd></div></dl>
          <section><h2 className="text-lg font-black">Upcoming Events</h2>{events.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{events.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold">{event.title}</h3><p className="mt-2 text-sm text-slate-500">{event.date} · {event.time}</p><p className="mt-1 text-sm text-slate-500">{event.location}</p></article>)}</div> : <p className="mt-2 text-sm text-slate-500">No associated Event records are available.</p>}</section>
          <Link href="/" className="inline-flex rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Open Campus Mint</Link>
        </div>
      </article>
    </main>
  );
}
