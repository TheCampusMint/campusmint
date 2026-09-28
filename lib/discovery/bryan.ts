import "server-only";
import { bryanDates } from "./sourceDates";
import { insideNearby, safeWebUrl, type Coordinates, type NearbyItem } from "./nearby";
const ROOT = "https://www.destinationbryan.com";
async function html(url: string) {
  const result = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(10_000) });
  if (!result.ok) throw new Error("Event calendar unavailable");
  return result.text();
}
export async function bryanEvent(slug: string): Promise<NearbyItem | null> {
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) return null;
  const url = `${ROOT}/events/${slug}/`;
  const page = await html(url);
  const scripts = [...page.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const script of scripts) {
    let graph;
    try { const data = JSON.parse(script[1]); graph = data["@graph"] ?? [data]; } catch { continue; }
    for (const event of graph) {
      if (event["@type"] !== "Event") continue;
      const latitude = Number(page.match(/data-marker-lat="(-?\d+(?:\.\d+)?)"/)?.[1]);
      const longitude = Number(page.match(/data-marker-lng="(-?\d+(?:\.\d+)?)"/)?.[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || typeof event.name !== "string" || !Number.isFinite(Date.parse(event.startDate))) continue;
      const address = event.location?.address;
      return { id: `bryan:${slug}`, title: event.name, description: String(event.description ?? "").replace(/<[^>]*>/g, "").slice(0,240),
        address: [address?.streetAddress,address?.addressLocality,address?.addressRegion].filter(Boolean).join(", "),
        latitude,longitude,timeZone:"America/Chicago",...bryanDates(event.startDate,event.endDate,page.match(/<p class="detail__subheading">([\s\S]*?)<\/p>/)?.[1] ?? ""),
        image:safeWebUrl(typeof event.image === "string" ? event.image : event.image?.url,ROOT),source:"Destination Bryan",sourceUrl:url,website:url };
    }
  }
  return null;
}
export async function bryanEvents(origin: Coordinates) {
  // Only contact the regional source when its coverage overlaps this search.
  if (!insideNearby(origin, { latitude:30.6744,longitude:-96.3698 })) return [];
  const page = await html(`${ROOT}/events/`);
  const slugs = [...new Set([...page.matchAll(/href="https:\/\/www\.destinationbryan\.com\/events\/([a-z0-9-]+)\/"/g)].map(m => m[1]))].filter(s => !["annual","submit-your-event","live-music"].includes(s)).slice(0,24);
  const results: NearbyItem[] = [];
  // Bounded concurrency; never crawl arbitrary URLs supplied by a browser.
  for (let i = 0; i < slugs.length; i += 6) {
    const chunk = await Promise.allSettled(slugs.slice(i,i+6).map(bryanEvent));
    for (const item of chunk) if (item.status === "fulfilled" && item.value && insideNearby(origin,item.value) && Date.parse(item.value.endsAt ?? item.value.startsAt ?? "") > Date.now()) results.push(item.value);
  }
  return results;
}
