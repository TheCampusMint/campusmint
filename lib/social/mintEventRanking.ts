import { sampleEvents } from "@/data/events";
import type { EventWindow } from "@/lib/content/eventRanking";
import type { Mint } from "@/types/mint";

export function getMintEventWindow(mint: Mint): EventWindow | null {
  if (mint.postType !== "event") return null;
  const canonicalEvent = mint.eventData?.eventId
    ? sampleEvents.find((event) => event.id === mint.eventData?.eventId)
    : null;
  return {
    eventStartAt: canonicalEvent?.eventStartAt ?? mint.eventData?.eventStartAt,
    eventEndAt: canonicalEvent?.eventEndAt ?? mint.eventData?.eventEndAt,
  };
}
