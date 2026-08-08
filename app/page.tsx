"use client";

import { useState } from "react";

const navItems = [
  "Dashboard",
  "Stories",
  "Events",
  "Academics",
  "Clubs",
  "Marketplace",
  "Housing",
  "Career",
];

export default function Home() {
  const [active, setActive] = useState("Dashboard");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">The Campus Mint</h1>
            <p className="text-sm text-slate-500">
              The digital home for college life.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-xl border px-4 py-2 text-sm font-medium">
              Notifications
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
              CM
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActive(item)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  active === item
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Welcome back
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              {active}
            </h2>

            <p className="mt-3 max-w-2xl text-slate-600">
              This is the beginning of the Campus Mint experience. Each section
              will eventually become a full feature of the platform.
            </p>
          </div>

          {active === "Dashboard" && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Campus Stories</p>
                <h3 className="mt-2 text-xl font-semibold">
                  See what is happening now
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Parties, study groups, free food, clubs, tailgates, and more.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Upcoming Events</p>
                <h3 className="mt-2 text-xl font-semibold">
                  3 events this week
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Your personalized campus calendar will appear here.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Academic Hub</p>
                <h3 className="mt-2 text-xl font-semibold">
                  Your classes
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Class pages, group chats, tutors, and study groups will live
                  here.
                </p>
              </div>
            </div>
          )}

          {active !== "Dashboard" && (
            <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
              <h3 className="text-2xl font-semibold">{active}</h3>
              <p className="mt-2 text-slate-500">
                We will build this feature next.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}