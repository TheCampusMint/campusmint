"use client";

import { useState } from "react";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { EventsSection } from "@/components/events/EventsSection";
import { sampleEvents } from "@/data/events";
import {
  universities,
  type UniversityId,
} from "@/data/universities";

const navItems = [
  "Dashboard",
  "Stories",
  "Events",
  "Academics",
  "Clubs",
  "Marketplace",
  "Housing",
  "Career",
] as const;

type NavItem = (typeof navItems)[number];

// Temporary test user. Later this will come from the user's verified account.
// Blinn is used here so the cross-campus event access is visible in this build.
const user: {
  firstName: string;
  universityId: UniversityId;
  major: string;
  graduationYear: number;
} = {
  firstName: "Student",
  universityId: "blinn",
  major: "Computer Science",
  graduationYear: 2029,
};

export default function Home() {
  const [active, setActive] = useState<NavItem>("Dashboard");
  const theme = universities[user.universityId];

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <header
        className="border-b"
        style={{
          backgroundColor: theme.primary,
          color: theme.secondary,
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">The Campus Mint</h1>

            <p className="text-sm opacity-85">{theme.shortName}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: theme.secondary,
                color: theme.primary,
              }}
            >
              Notifications
            </button>

            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-bold"
              style={{
                backgroundColor: theme.secondary,
                color: theme.primary,
              }}
            >
              CM
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <nav aria-label="Campus Mint sections" className="space-y-2">
            {navItems.map((item) => {
              const isActive = active === item;

              return (
                <button
                  key={item}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActive(item)}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: isActive
                      ? theme.primary
                      : "transparent",
                    color: isActive ? theme.secondary : "#334155",
                    outlineColor: theme.primary,
                  }}
                >
                  {item}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6">
          <div
            className="rounded-2xl p-8 shadow-sm"
            style={{ backgroundColor: theme.accent }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: theme.primary }}
            >
              Welcome back
            </p>

            <h2 className="mt-2 text-4xl font-bold">{user.firstName}</h2>

            <p className="mt-3 text-lg font-medium">{theme.name}</p>

            <p className="mt-1 text-slate-600">
              {user.major} • Class of {user.graduationYear}
            </p>
          </div>

          {active === "Dashboard" && <DashboardOverview theme={theme} />}

          {active === "Events" && (
            <EventsSection
              events={sampleEvents}
              accessibleCampuses={theme.accessibleCampuses}
              theme={theme}
            />
          )}

          {active !== "Dashboard" && active !== "Events" && (
            <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
              <h3
                className="text-2xl font-semibold"
                style={{ color: theme.primary }}
              >
                {active}
              </h3>

              <p className="mt-2 text-slate-500">
                We&apos;ll build this feature next.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
