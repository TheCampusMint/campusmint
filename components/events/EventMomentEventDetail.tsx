"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { getCampusName, type UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import {
  getEventMomentExpirationLabel,
  getVisibleEventMoments,
} from "@/lib/events/eventMoments";
import { formatEventDateTimeRange } from "@/lib/content/eventTiming";
import type { Event } from "@/types/event";
import {
  eventMomentPrivacyOptions,
  type EventMomentPrivacy,
} from "@/types/eventMoment";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { CampusMintUser } from "@/types/profile";

type EventMomentEventDetailProps = {
  event: Event;
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  eventMoments: EventMomentsState;
  onClose: () => void;
  closeLabel?: string;
  onOpenMoment?: (momentId: string) => void;
};

const showDevelopmentSimulation = process.env.NODE_ENV === "development";

function privacyLabel(privacy: EventMomentPrivacy) {
  return (
    eventMomentPrivacyOptions.find((option) => option.id === privacy)?.label ??
    privacy
  );
}

export function EventMomentEventDetail({
  event,
  viewer,
  theme,
  profiles,
  eventMoments,
  onClose,
  closeLabel,
  onOpenMoment,
}: EventMomentEventDetailProps) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<EventMomentPrivacy>("followers");
  const [simulationMessage, setSimulationMessage] = useState<string | null>(
    null,
  );

  if (typeof document === "undefined") return null;

  const viewerId = viewer.account.id;
  const isGoing = eventMoments.isAttending(event.id, viewerId);
  const eligibility = eventMoments.getEligibility(event, viewerId);
  const prompt = eventMoments.getPrompt(event.id, viewerId);
  const showPrompt =
    eligibility.eligible &&
    prompt !== null &&
    (prompt.status === "pending" || prompt.status === "shown");

  const visibleMoments = getVisibleEventMoments(
    eventMoments.moments.filter((moment) => moment.eventId === event.id),
    {
      viewerUserId: viewerId,
      follows: profiles.follows,
      blocks: profiles.blocks,
      currentTime: eventMoments.currentTime,
    },
  );

  const displayedRsvpCount = event.rsvpCount + (isGoing ? 1 : 0);
  const formattedWhen =
    formatEventDateTimeRange(
      event.eventStartAt,
      event.eventEndAt,
      event.timeZone,
    ) ?? `${event.date} · ${event.time}`;

  function submitMoment(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    const created = eventMoments.captureMoment({
      event,
      author: viewer,
      mediaType,
      caption,
      privacy,
    });

    if (!created) return;
    setCaptureOpen(false);
    setCaption("");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      data-horizontal-gesture-ignore
      onMouseDown={(pointerEvent) => {
        if (pointerEvent.target === pointerEvent.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-moment-detail-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/80 bg-slate-50 shadow-2xl sm:max-w-3xl sm:rounded-[2rem]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/95 p-5 backdrop-blur-xl sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide"
                style={{ backgroundColor: theme.accent, color: theme.primary }}
              >
                {getCampusName(event.campus)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                {event.category}
              </span>
            </div>
            <h2
              id="event-moment-detail-title"
              className="mt-3 text-2xl font-black tracking-tight text-slate-950"
            >
              {event.title}
            </h2>
          </div>

          {closeLabel ? (
            <MintLeafBackButton
              onClick={onClose}
              label={closeLabel}
              aria-label={closeLabel}
            />
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close event details"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600"
            >
              ×
            </button>
          )}
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                When
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {formattedWhen}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Where
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {event.location}
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-600 sm:col-span-2">
              {event.description}
            </p>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:col-span-2">
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {displayedRsvpCount.toLocaleString("en-US")} going
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  RSVP records planned attendance; it does not verify attendance.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={isGoing}
                onClick={() => eventMoments.toggleRsvp(event, viewerId)}
                className="min-w-24 rounded-xl border px-4 py-2.5 text-sm font-black transition"
                style={{
                  backgroundColor: isGoing ? theme.accent : theme.primary,
                  borderColor: theme.primary,
                  color: isGoing ? theme.primary : theme.secondary,
                }}
              >
                {isGoing ? "Going" : "RSVP"}
              </button>
            </div>
          </div>

          {showPrompt && (
            <div
              className="rounded-3xl border p-5"
              style={{
                borderColor: `${theme.primary}38`,
                backgroundColor: `${theme.primary}0d`,
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-[0.18em]"
                style={{ color: theme.primary }}
              >
                Optional Event Moment
              </p>
              <h3 className="mt-2 text-lg font-black text-slate-950">
                Capture a memory from this event.
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {eligibility.basis === "simulated_location"
                  ? `Looks like you may have been at ${event.title}. Capture a memory?`
                  : `You’re planning to attend ${event.title}. If you’d like, capture a memory for the event.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  className="rounded-xl px-4 py-2.5 text-sm font-black"
                  style={{ backgroundColor: theme.primary, color: theme.secondary }}
                >
                  Capture memory
                </button>
                <button
                  type="button"
                  onClick={() => eventMoments.dismissPrompt(event.id, viewerId)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {captureOpen && (
            <form
              onSubmit={submitMoment}
              className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Development capture
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">
                    New Event Moment
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCaptureOpen(false)}
                  className="text-sm font-bold text-slate-500"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(["image", "video"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={mediaType === type}
                    onClick={() => setMediaType(type)}
                    className="rounded-2xl border p-4 text-left transition"
                    style={
                      mediaType === type
                        ? {
                            borderColor: theme.primary,
                            backgroundColor: theme.accent,
                            color: theme.primary,
                          }
                        : { borderColor: "#cbd5e1", color: "#475569" }
                    }
                  >
                    <span className="text-xl" aria-hidden="true">
                      {type === "image" ? "▣" : "▶"}
                    </span>
                    <strong className="mt-2 block text-sm">
                      {type === "image" ? "Photo" : "Video"}
                    </strong>
                    <span className="mt-1 block text-[11px] opacity-70">
                      Local placeholder
                    </span>
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Caption (optional)
                </span>
                <textarea
                  rows={3}
                  maxLength={240}
                  value={caption}
                  onChange={(changeEvent) => setCaption(changeEvent.target.value)}
                  placeholder="What do you want to remember?"
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Privacy</span>
                <select
                  value={privacy}
                  onChange={(changeEvent) =>
                    setPrivacy(changeEvent.target.value as EventMomentPrivacy)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  {eventMomentPrivacyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                This prototype saves a photo/video placeholder only on this device.
                It does not upload media.
              </p>

              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 text-sm font-black"
                style={{ backgroundColor: theme.primary, color: theme.secondary }}
              >
                Save 24-hour Moment
              </button>
            </form>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Event Moments
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">
                  Memories from this event
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {visibleMoments.length}
              </span>
            </div>

            {visibleMoments.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                No active Moments are visible to you yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {visibleMoments.map((moment) => {
                  const author = profiles.getUserById(moment.authorUserId);
                  const isAuthor = moment.authorUserId === viewerId;

                  return (
                    <article
                      key={moment.id}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenMoment?.(moment.id)}
                        disabled={!onOpenMoment}
                        aria-label={onOpenMoment ? `Open Event Moment by ${author?.profile.displayName ?? "Campus Mint user"}` : undefined}
                        className="flex aspect-[4/3] w-full items-center justify-center disabled:cursor-default"
                        style={{
                          background: `linear-gradient(145deg, ${theme.primary}, ${theme.accent})`,
                        }}
                      >
                        <div className="text-center text-white drop-shadow-md">
                          <span className="text-4xl" aria-hidden="true">
                            {moment.media.type === "image" ? "▣" : "▶"}
                          </span>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em]">
                            Local {moment.media.type} placeholder
                          </p>
                        </div>
                      </button>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {author?.profile.displayName ?? "Campus Mint user"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {event.title}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">
                            {privacyLabel(moment.privacy)}
                          </span>
                        </div>

                        {moment.caption && (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {moment.caption}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                          <span className="text-xs font-bold text-slate-500">
                            {getEventMomentExpirationLabel(
                              moment,
                              eventMoments.currentTime,
                            )}
                          </span>
                          {isAuthor && !moment.kept && (
                            <button
                              type="button"
                              onClick={() =>
                                eventMoments.keepMoment(moment.id, viewerId)
                              }
                              className="rounded-lg px-3 py-1.5 text-xs font-black"
                              style={{
                                backgroundColor: theme.accent,
                                color: theme.primary,
                              }}
                            >
                              Keep
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {showDevelopmentSimulation && (
            <details className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-amber-950">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em]">
                Development attendance simulator
              </summary>
              <p className="mt-3 text-xs leading-5 text-amber-900/80">
                Simulates explicit opt-in plus 30 minutes near this event during
                its scheduled window. It does not access or track your location.
              </p>
              <button
                type="button"
                onClick={() => {
                  const simulated =
                    eventMoments.simulateQualifyingLocationAttendance(
                      event,
                      viewerId,
                    );
                  setSimulationMessage(
                    simulated
                      ? "Development-only qualifying evidence added."
                      : "This event does not have a usable 30-minute window.",
                  );
                }}
                className="mt-3 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-black"
              >
                Simulate qualifying location attendance
              </button>
              {simulationMessage && (
                <p className="mt-2 text-xs font-bold">{simulationMessage}</p>
              )}
            </details>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
