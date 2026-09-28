/* eslint-disable @next/next/no-img-element */
import {notFound} from "next/navigation";
import {publicClub} from "@/lib/sharing/publicContent";
import {SharedItem} from "@/components/sharing/SharedItem";
export const dynamic = "force-dynamic";
export const metadata = {title:"Shared Club",robots:{index:false,follow:false}};
export default async function ClubPage({params}:{params:Promise<{handle:string}>}) {
  const club = await publicClub((await params).handle);
  if(!club) notFound();
  return <SharedItem>{club.photo_url && <img src={club.photo_url} alt="" className="w-full rounded-2xl"/>}<h1 className="text-2xl font-bold">{club.name}</h1><p className="whitespace-pre-wrap">{club.full_description || club.short_description}</p><p className="text-sm text-[var(--app-text-secondary)]">{club.meeting_location}<br/>{club.meeting_schedule}</p>{club.website && <a href={club.website} rel="noreferrer" target="_blank" className="text-[var(--app-accent)]">Website ↗</a>}</SharedItem>;
}
