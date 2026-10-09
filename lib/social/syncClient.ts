import type {SocialAction} from './syncContract';
export type SocialCursor={before:string;beforeId:string};
export class SocialRequestError extends Error {
  constructor(message:string,readonly status:number){super(message);this.name='SocialRequestError';}
}
export async function socialRead<T>(resource:string,target?:string,signal?:AbortSignal,cursor?:SocialCursor):Promise<T> {
  const query=new URLSearchParams({resource,...(target?{target}:{}),...cursor});
  const response=await fetch(`/api/social?${query}`,{cache:'no-store',signal});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new SocialRequestError(result.message??'Could not sync.',response.status);
  return result as T;
}
export async function socialWrite(action:SocialAction,target?:string|null,data:Record<string,unknown>={}) {
  const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,action,target})});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new SocialRequestError(result.message??'Could not save.',response.status);
  window.dispatchEvent(new Event('campusmint:social-changed'));
  return result as {ok:true;id:string|null;conversationId:string|null};
}
