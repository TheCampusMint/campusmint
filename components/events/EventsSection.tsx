"use client";

import { useState } from "react";

import { EventCard } from "@/components/events/EventCard";
import {
  getCampusName,
  type UniversityTheme,
} from "@/data/universities";
import {
  eventCategories,
  type Event,
  type EventCategory,
} from "@/types/event";
import { rankEventContent } from "@/lib/content/eventRanking";

type CategoryFilter = "All" | EventCategory;

type EventsSectionProps = {
  events: Event[];
  accessibleCampuses: string[];
  theme: UniversityTheme;
};

const categoryFilters: CategoryFilter[] = ["All", ...eventCategories];

export function EventsSection({
  events,
  accessibleCampuses,
  theme,
}: EventsSectionProps) {
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilter>("All");
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<Event["id"]>>(
    () => new Set(),
  );

  const campusEvents = rankEventContent(events.filter((event) =>
    accessibleCampuses.includes(event.campus),
  ));
  const visibleEvents = campusEvents.filter(
    (event) =>
      activeCategory === "All" || event.category === activeCategory,
  );

  function toggleRsvp(eventId: Event["id"]) {
    setRsvpedEventIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(eventId)) {
        nextIds.delete(eventId);
      } else {
        nextIds.add(eventId);
      }

      return nextIds;
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: theme.primary }}
            >
              Campus calendar
            </p>
            <h2 className="mt-1 text-3xl font-bold text-slate-950">Events</h2>
            <p className="mt-2 text-sm text-slate-600">
              Discover events available through your campus access.
            </p>
          </div>

          <p className="text-sm font-medium text-slate-500">
            {campusEvents.length} {campusEvents.length === 1 ? "event" : "events"}
          </p>
        </div>

        <div
          className="mt-6 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter events by category"
        >
          {categoryFilters.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className="rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: isActive ? theme.primary : "#ffffff",
                  borderColor: isActive ? theme.primary : "#cbd5e1",
                  color: isActive ? theme.secondary : "#475569",
                  outlineColor: theme.primary,
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {visibleEvents.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              campusName={getCampusName(event.campus)}
              isGoing={rsvpedEventIds.has(event.id)}
              theme={theme}
              onToggleRsvp={toggleRsvp}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900">
            No {activeCategory === "All" ? "" : `${activeCategory.toLowerCase()} `}
            events yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Try another category to see what is happening nearby.
          </p>
        </div>
      )}
    </div>
  );
}
