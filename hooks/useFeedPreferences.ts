"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {areDevelopmentFixturesEnabled} from "@/lib/runtime/fixturePolicy";
import {interestTopics,mergeFeedSignals,type FeedSignal,type InterestReason} from "@/lib/social/feedPreferences";
import type {Mint} from "@/types/mint";
const keyFor=(userId:string)=>`campusmint:feed-preferences:${userId}:v2`;
export function useFeedPreferences(userId:string,learned:FeedSignal[]) {
  const [state,setState]=useState<{owner:string;signals:FeedSignal[]}>({owner:"",signals:[]});
  const [syncError,setSyncError]=useState(false);
  const [retry,setRetry]=useState(0);
  const remote=!areDevelopmentFixturesEnabled();
  useEffect(()=>{
    const controller=new AbortController();
    const local=()=>{try{return JSON.parse(localStorage.getItem(keyFor(userId)) ?? "[]") as FeedSignal[];}catch{return [];}};
    const timer=setTimeout(()=>setState({owner:userId,signals:local()}),0);
    const load=()=>{if(document.hidden||!remote)return;fetch("/api/feed/preferences",{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();if(!controller.signal.aborted)setState(current=>({owner:userId,signals:mergeFeedSignals(data.signals,local(),current.owner===userId?current.signals:[])}));}).catch(()=>{});};
    load();window.addEventListener("focus",load);
    const refresh=setInterval(load,60_000);
    return()=>{clearTimeout(timer);clearInterval(refresh);controller.abort();window.removeEventListener("focus",load);};
  },[userId,remote]);
  const signals=useMemo(()=>mergeFeedSignals(learned,state.owner===userId?state.signals:[]),[learned,state,userId]);
  useEffect(()=>{if(state.owner===userId)try{localStorage.setItem(keyFor(userId),JSON.stringify(signals));}catch{}},[signals,state.owner,userId]);
  const signature=JSON.stringify(signals.map(s=>({mintId:s.mintId,weight:s.weight,reason:s.reason,updatedAt:s.updatedAt})).slice(0,50));
  useEffect(()=>{
    if(!remote || state.owner!==userId || signature==="[]") return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{fetch("/api/feed/preferences",{method:"POST",headers:{"Content-Type":"application/json"},body:`{"signals":${signature}}`,signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setSyncError(!r.ok);}).catch(()=>{if(!controller.signal.aborted)setSyncError(true);});},1500);
    return()=>{clearTimeout(timer);controller.abort();};
  },[signature,remote,state.owner,userId,retry]);
  const dismiss=useCallback((mint:Mint,reason:InterestReason)=>{
    setState(current=>({owner:userId,signals:mergeFeedSignals(current.owner===userId?current.signals:[],[{mintId:mint.id,authorId:mint.authorId,topics:interestTopics(mint),weight:0,reason,updatedAt:new Date().toISOString()}])}));
  },[userId]);
  useEffect(()=>{if(!syncError)return;const timer=setTimeout(()=>setRetry(r=>r+1),30_000);return()=>clearTimeout(timer);},[syncError,retry]);
  return {signals,dismiss,syncError};
}
