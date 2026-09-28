import type { Mint, MintDwellRecord, MintPrivateAppreciation, MintPublicEndorsement } from "../../types/mint.ts";
export type InterestReason = "creator" | "content" | "relevance";
export type FeedSignal = {mintId:string;authorId:string;topics:string[];weight:number;reason:InterestReason|null;updatedAt:string};
const stop = new Set("a an and are as at be been but by can do for from had has have he her here him his how i if in is it its just like me my of on or our so that the their them there these they this to up us was we were what when where who why will with you your".split(" "));
export function interestTopics(mint:Pick<Mint,"caption"|"hashtags">) {
  const words = mint.hashtags.length ? mint.hashtags : mint.caption.toLowerCase().match(/[\p{L}\p{N}]{3,30}/gu) ?? [];
  return [...new Set(words.map(t=>t.toLowerCase().replace(/^#/,"")).filter(t=>!stop.has(t)))].slice(0,20);
}
export function mergeFeedSignals(...collections: readonly FeedSignal[][]) {
  const byId = new Map<string,FeedSignal>();
  for(const signals of collections) for(const next of signals) {
    const previous = byId.get(next.mintId);
    if(previous?.reason && !next.reason) continue;
    if(!previous || Date.parse(next.updatedAt) > Date.parse(previous.updatedAt)) byId.set(next.mintId,next);
    else if(next.reason && !previous.reason) byId.set(next.mintId,next);
  }
  return [...byId.values()].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,500);
}
export function learnFeedSignals(mints:readonly Mint[], viewerId:string, dwell:readonly MintDwellRecord[], appreciated:readonly MintPrivateAppreciation[], endorsed:readonly MintPublicEndorsement[]):FeedSignal[] {
  return mints.flatMap(mint=>{
    if(mint.authorId===viewerId) return [];
    const record = dwell.find(r=>r.userId===viewerId && r.mintId===mint.id);
    const like = appreciated.find(r=>r.userId===viewerId && r.mintId===mint.id);
    const endorsement = endorsed.find(r=>r.userId===viewerId && r.mintId===mint.id);
    const seconds = (record?.totalMeaningfulDwellMs ?? 0)/1000;
    // Ignore incidental exposure. Repeated dwell is capped, not negative feedback.
    const weight = Math.min(4, (seconds>=8 ? Math.log2(1+Math.min(seconds,120)/8) : 0) + (like?2:0) + (endorsement?3:0));
    if(!weight) return [];
    const updatedAt = [record?.lastViewedAt,like?.createdAt,endorsement?.createdAt].filter((v):v is string=>!!v).sort().at(-1)!;
    return [{mintId:mint.id,authorId:mint.authorId,topics:interestTopics(mint),weight,reason:null,updatedAt}];
  });
}
export function stableFraction(value:string) {
  let hash=2166136261; for(const c of value) hash=Math.imul(hash ^ c.charCodeAt(0),16777619); return (hash>>>0)/4294967296;
}
export function preferenceScore(mint:Mint, signals:readonly FeedSignal[], now:number) {
  const topics = new Set(interestTopics(mint));
  let score=0;
  for(const signal of signals) {
    if(signal.reason) continue;
    const age=Math.max(0,(now-Date.parse(signal.updatedAt))/86400000);
    const overlap=signal.topics.filter(t=>topics.has(t)).length;
    score += signal.weight * 2**(-age/30) * ((signal.authorId===mint.authorId ? 16:0) + Math.min(3,overlap)*24);
  }
  return Math.min(420,score);
}
export function recommendationAllowed(mint:Mint,signals:readonly FeedSignal[],seed:string) {
  if(signals.some(s=>s.mintId===mint.id && s.reason)) return false;
  const topics=new Set(interestTopics(mint));
  const suppressed=signals.some(s=>s.reason==="creator" && s.authorId===mint.authorId || s.reason==="content" && s.topics.filter(t=>topics.has(t)).length >= Math.min(2,s.topics.length) && s.topics.length > 0 && s.topics.filter(t=>topics.has(t)).length / Math.max(1,Math.min(s.topics.length,topics.size)) >= .34);
  return !suppressed || stableFraction(`${seed}:${mint.id}:resurface`) < .0005;
}
export function exploreRankedFeed<T extends {mint:Mint}>(ranked:T[],signals:readonly FeedSignal[],seed:string) {
  const remaining=[...ranked];const result:T[]=[];
  while(remaining.length) {
    let index=0;
    if(result.length%10===8) index=remaining.reduce((best,item,i)=>item.mint.viewCount > remaining[best].mint.viewCount?i:best,0);
    else if(result.length%6===5) {
      const knownTopics=new Set(signals.filter(s=>!s.reason).flatMap(s=>s.topics));
      const candidates=remaining.map((r,i)=>({i,novel:!interestTopics(r.mint).some(t=>knownTopics.has(t)),random:stableFraction(`${seed}:${r.mint.id}:explore`)})).sort((a,b)=>Number(b.novel)-Number(a.novel)||a.random-b.random);
      index=candidates[0].i;
    }
    result.push(remaining.splice(index,1)[0]);
  }
  return result;
}
