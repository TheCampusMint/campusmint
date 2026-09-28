import "server-only";
import { rankNearbyFood, safeWebUrl, type Coordinates, type Cuisine, type NearbyItem } from "./nearby";
const types: Record<Cuisine,string[]> = { All:["restaurant","cafe"], Asian:["chinese_restaurant","japanese_restaurant","korean_restaurant","thai_restaurant","vietnamese_restaurant"], "Fast food":["fast_food_restaurant"], Indian:["indian_restaurant"], Mexican:["mexican_restaurant"], Italian:["italian_restaurant"], American:["american_restaurant"], Cafes:["cafe"] };
export async function googleFood(origin: Coordinates, cuisine: Cuisine, key: string): Promise<NearbyItem[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", { method:"POST",cache:"no-store",signal:AbortSignal.timeout(12_000),headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.id,places.displayName,places.location,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.photos,places.reviews,places.editorialSummary,places.attributions"},body:JSON.stringify({includedTypes:types[cuisine],maxResultCount:20,locationRestriction:{circle:{center:origin,radius:16093.44}},rankPreference:"POPULARITY"}) });
  if (!response.ok) throw new Error("Nearby food unavailable");
  const data = await response.json();
  const items: NearbyItem[] = (data.places ?? []).flatMap((p: { id?: string; displayName?: {text?:string}; location?: Coordinates; formattedAddress?:string; websiteUri?:string; googleMapsUri?:string; rating?:number; userRatingCount?:number; editorialSummary?:{text?:string}; attributions?:{provider:string;providerUri?:string}[]; photos?:{name:string;googleMapsUri?:string;authorAttributions?:{displayName:string;uri?:string}[]}[]; reviews?:{authorAttribution:{displayName:string;uri?:string;photoUri?:string};text?:{text:string};rating:number;googleMapsUri?:string}[] }) => {
    if (!p.id || !p.displayName?.text || !p.location) return [];
    const photo = p.photos?.[0];
    return [{id:`google:${p.id}`,title:p.displayName.text,description:p.editorialSummary?.text ?? "",address:p.formattedAddress ?? "",...p.location,website:safeWebUrl(p.websiteUri),source:"Google Maps",sourceUrl:safeWebUrl(p.googleMapsUri) ?? "https://maps.google.com",rating:p.rating,ratingCount:p.userRatingCount,
      image:photo ? `/api/discovery/photo?name=${encodeURIComponent(photo.name)}` : null,imageSourceUrl:safeWebUrl(photo?.googleMapsUri),attributions:(p.attributions ?? []).map(a=>({name:a.provider,url:safeWebUrl(a.providerUri)})),imageCredit:photo?.authorAttributions?.map(a=>a.displayName).join(", "),imageCreditUrl:safeWebUrl(photo?.authorAttributions?.[0]?.uri),
      reviews:(p.reviews ?? []).slice(0,3).map(r=>({author:r.authorAttribution.displayName,authorUrl:safeWebUrl(r.authorAttribution.uri) ?? undefined,avatar:safeWebUrl(r.authorAttribution.photoUri) ?? undefined,text:r.text?.text ?? "",rating:r.rating,url:safeWebUrl(r.googleMapsUri) ?? undefined}))}];
  });
  return rankNearbyFood(items,origin);
}
