"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { cuisines, type Coordinates, type Cuisine, type NearbyItem } from "@/lib/discovery/nearby";
import { sharePublicItem } from "@/lib/sharing/share";
export function NearbyDiscovery({kind,origin,revision,query}:{kind:"food"|"events";origin:Coordinates;revision:number;query:string}) {
  const [cuisine,setCuisine] = useState<Cuisine>("All");
  const [state,setState] = useState<{key:string;items:NearbyItem[];message:string;partial?:boolean}>({key:"",items:[],message:""});
  const key = `${kind}:${origin.latitude}:${origin.longitude}:${cuisine}:${revision}`;
  const [now,setNow] = useState(0);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer);},[]);
  const [retry,setRetry] = useState(0);
  const [notice,setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({kind,lat:String(origin.latitude),lng:String(origin.longitude),cuisine});
    fetch(`/api/discovery/nearby?${parameters}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Nearby results unavailable");
      setNow(Date.now());
      setState({key,items:data.items ?? [],message:data.configured === false ? "Nearby food is coming soon" : "",partial:data.partial});
    }).catch(error=>{if(!controller.signal.aborted)setState({key,items:[],message:error.message});});
    return () => controller.abort();
  },[key,kind,origin.latitude,origin.longitude,cuisine,retry]);
  const items = state.key === key ? state.items.filter(i=>`${i.title} ${i.address} ${i.description}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  return <section className="space-y-4">
    {kind === "food" && <div aria-label="Cuisine" className="flex gap-2 overflow-x-auto pb-1">{cuisines.map(c=><button key={c} onClick={()=>setCuisine(c)} aria-pressed={cuisine===c} className="cm-choice-control shrink-0 rounded-full px-3 py-2 text-sm"><span className="cm-choice-highlight">{c}</span></button>)}</div>}
    {state.key !== key ? <p role="status" className="py-12 text-center text-sm">Finding nearby…</p> : state.message ? <div role="status" className="py-12 text-center text-sm">{state.message}{!state.message.includes("coming soon") && <button className="ml-2 text-[var(--app-accent)]" onClick={()=>setRetry(r=>r+1)}>Retry</button>}</div> : !items.length ? <p className="rounded-3xl bg-[var(--app-surface)] py-12 text-center text-sm">{query.trim()?"No matches":kind==="events"?"No events":"No places"}</p> : null}
    {state.partial && <p role="status" className="text-xs text-[var(--app-text-secondary)]">Some events couldn’t load. <button onClick={()=>setRetry(r=>r+1)} className="text-[var(--app-accent)]">Retry</button></p>}
    <div className="grid gap-4 sm:grid-cols-2">{items.map(item=><article key={item.id} className="overflow-hidden rounded-3xl bg-[var(--app-surface)]">
      {item.image && <figure><img src={item.image} alt="" loading="lazy" className="max-h-60 w-full object-cover" referrerPolicy="no-referrer"/>{item.imageCredit && <figcaption className="px-4 text-xs text-[var(--app-text-secondary)]">{item.imageCreditUrl?<a href={item.imageCreditUrl} target="_blank" rel="noreferrer">{item.imageCredit}</a>:item.imageCredit}{item.imageSourceUrl && <a className="ml-2" href={item.imageSourceUrl} target="_blank" rel="noreferrer">View photo ↗</a>}</figcaption>}</figure>}
      <div className="space-y-2 p-4"><h2 className="font-bold">{item.title}</h2>{item.startsAt && <p className="text-sm text-[var(--app-accent)]">{Date.parse(item.startsAt) < now && item.endsAt && Date.parse(item.endsAt) > now ? `Now · until ${new Date(item.endsAt).toLocaleDateString([], {month:"short",day:"numeric"})}` : new Date(item.startsAt).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:item.timeZone})}</p>}
      {item.rating != null && <p className="text-sm">★ {item.rating.toFixed(1)} <span className="text-[var(--app-text-secondary)]">({item.ratingCount ?? 0})</span></p>}
      {item.description && <p className="text-sm text-[var(--app-text-secondary)]">{item.description}</p>}<p className="text-xs text-[var(--app-text-secondary)]">{item.address}</p>
      <div className="flex flex-wrap gap-4 text-sm text-[var(--app-accent)]">{item.website && <a href={item.website} target="_blank" rel="noreferrer">Website ↗</a>}{kind === "events" && <button onClick={async()=>setNotice(await sharePublicItem(item.title,`/share/event/${encodeURIComponent(item.id)}`))}>Share</button>}</div>
      {!!item.reviews?.length && <details><summary className="py-2 text-sm">Reviews</summary><p className="mb-2 text-xs text-[var(--app-text-secondary)]">Most relevant · Google Maps</p>{item.reviews.map((r,index)=><blockquote key={index} className="mb-3 text-sm">{r.avatar && <img src={r.avatar} alt="" width={24} height={24} className="mr-2 inline-block rounded-full"/>}<a href={r.authorUrl ?? item.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold">{r.author}</a> · {r.rating}/5<p>{r.text}</p>{r.url && <a href={r.url} className="text-xs text-[var(--app-accent)]" target="_blank" rel="noreferrer">View review ↗</a>}</blockquote>)}</details>}
      <a translate="no" className="inline-block whitespace-nowrap text-xs text-[var(--app-text-secondary)]" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source} ↗</a>{item.attributions?.map(a=><a key={a.name} href={a.url ?? item.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs">{a.name}</a>)}</div>
    </article>)}</div>{notice && <p role="status" className="text-sm text-[var(--app-accent)]">{notice}</p>}
  </section>;
}
