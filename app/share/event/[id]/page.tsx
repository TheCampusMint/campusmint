/* eslint-disable @next/next/no-img-element */
import {notFound} from "next/navigation";
import {createSupabaseAdminClient} from "@/lib/supabase/server";
import {bryanEvent} from "@/lib/discovery/bryan";
import {eventItem,publicEventSources} from "@/lib/discovery/events";
import {SharedItem} from "@/components/sharing/SharedItem";
export const dynamic = "force-dynamic";
export const metadata = {title:"Shared Event",robots:{index:false,follow:false}};
export default async function EventPage({params}:{params:Promise<{id:string}>}) {
  let {id} = await params;
  try { id = decodeURIComponent(id); } catch { notFound(); }
  let event = null;
  if(id.startsWith("bryan:")) event = await bryanEvent(id.slice(6));
  else if(/^[0-9a-f-]{36}$/i.test(id)) {
    const result = await createSupabaseAdminClient().from("campus_events").select("*").eq("id",id).in("status",["scheduled","updated"]).in("source_kind",publicEventSources).maybeSingle();
    if(!result.error && result.data) event = eventItem(result.data);
  }
  if(!event) notFound();
  return <SharedItem>{event.image && <img src={event.image} alt="" className="max-h-80 w-full rounded-2xl object-contain"/>}<h1 className="text-2xl font-bold">{event.title}</h1>{event.startsAt && <time dateTime={event.startsAt} className="block text-[var(--app-accent)]">{new Date(event.startsAt).toLocaleString("en-US",{timeZone:event.timeZone ?? "UTC",year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})}</time>}<p>{event.description}</p><p className="text-sm text-[var(--app-text-secondary)]">{event.address}</p>{event.website && <a href={event.website} target="_blank" rel="noreferrer" className="text-[var(--app-accent)]">{event.source} ↗</a>}</SharedItem>;
}
