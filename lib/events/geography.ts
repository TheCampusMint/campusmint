import type { UniversityTheme } from "../../data/universities.ts";
import type { Event } from "../../types/event.ts";

const EARTH_RADIUS_MILES = 3958.7613;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function getEventDistanceFromCampus(event: Pick<Event, "latitude" | "longitude">, campus: UniversityTheme) {
  if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return null;
  return distanceMiles({ latitude: campus.campusLatitude, longitude: campus.campusLongitude }, { latitude: event.latitude, longitude: event.longitude });
}

export function isEventInsideCampusRadius(event: Pick<Event, "latitude" | "longitude" | "source">, campus: UniversityTheme) {
  const distance = getEventDistanceFromCampus(event, campus);
  if (distance !== null) return distance <= campus.eventDiscoveryRadiusMiles;
  return event.source?.sourceType === "university";
}
