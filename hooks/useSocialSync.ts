'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {subscribeSocialChanges} from '@/lib/social/realtimeClient';
import {createRefreshQueue} from '@/lib/social/invalidationHub';
import {socialRead,SocialRequestError,type SocialCursor} from '@/lib/social/syncClient';
import {isAccountId} from '@/lib/social/syncContract';

type PageRow={id:string;created_at:string;updated_at?:string};
type Page={items:PageRow[];hasMore:boolean};
function isPage(value:unknown):value is Page {
  return Boolean(value&&typeof value==='object'&&'items' in value&&Array.isArray(value.items));
}

/** All cached rows belong to one account/resource. Realtime carries no private payload. */
export function useSocialSync<T>(userId:string,resource:string,target?:string,enabled=true) {
  const key=`${userId}:${resource}:${target??''}`;
  const [state,setState]=useState<{key:string;data:T|null;error:string|null}>({key:'',data:null,error:null});
  const [loadingKey,setLoadingKey]=useState<string|null>(null);
  const pending=useRef<{key:string;controller:AbortController}|null>(null);
  const current=useRef(key);
  const pageDepth=useRef(1);
  const refreshQueue=useRef<ReturnType<typeof createRefreshQueue>|null>(null);
  const refresh=useCallback(async()=>{
    if(!enabled||!isAccountId(userId)||pending.current?.key===key)return;
    const controller=new AbortController();
    pending.current?.controller.abort();pending.current={key,controller};setLoadingKey(key);
    try {
      let data=await socialRead<T>(resource,target,controller.signal);
      if(isPage(data)) {
        const merged:Page={items:[...data.items],hasMore:data.hasMore};
        // Re-read loaded pages on invalidation, so deleted/revoked records disappear.
        for(let page=1;page<pageDepth.current&&merged.hasMore;page++) {
          const last=merged.items.at(-1);if(!last)break;
          const cursor:SocialCursor={before:resource==='conversations'?last.updated_at??last.created_at:last.created_at,beforeId:last.id};
          const next=await socialRead<Page>(resource,target,controller.signal,cursor);
          merged.items.push(...next.items);merged.hasMore=next.hasMore;
        }
        data={...data,...merged};
      }
      if(current.current===key&&!controller.signal.aborted)setState({key,data,error:null});
    } catch(error) {
      if(current.current===key&&!controller.signal.aborted) {
        const revoked=error instanceof SocialRequestError&&[401,403].includes(error.status);
        setState(previous=>({key,data:!revoked&&previous.key===key?previous.data:null,error:error instanceof Error?error.message:'Could not sync.'}));
      }
    } finally {
      if(pending.current?.controller===controller){pending.current=null;setLoadingKey(null);}
    }
  },[enabled,key,resource,target,userId]);
  useEffect(()=>{
    current.current=key;pageDepth.current=1;
    if(!enabled||!isAccountId(userId))return;
    const queue=createRefreshQueue(refresh);
    refreshQueue.current=queue;
    const schedule=()=>{void queue.request();};
    const disconnect=subscribeSocialChanges(userId,schedule);
    schedule();
    return()=>{
      queue.dispose();
      if(refreshQueue.current===queue)refreshQueue.current=null;
      pending.current?.controller.abort();pending.current=null;disconnect();
    };
  },[enabled,key,refresh,resource,target,userId]);
  const requestRefresh=useCallback(()=>refreshQueue.current?.request()??Promise.resolve(),[]);
  const data=enabled&&state.key===key?state.data:null;
  async function loadMore() {
    if(!isPage(data)||!data.hasMore||pending.current)return;
    pageDepth.current+=1;await refreshQueue.current?.request();
  }
  return {data,error:enabled&&state.key===key?state.error:null,loading:loadingKey===key,refresh:requestRefresh,loadMore};
}
