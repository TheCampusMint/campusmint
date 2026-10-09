'use client';
import {useEffect,useMemo,useState} from 'react';
import {CreateContentFlow} from '@/components/content/CreateContentFlow';
import {developmentUsers} from '@/data/development/users';
import {universities} from '@/data/universities';
import {getAppearanceCssVariables,getAppearanceTokens} from '@/data/appearance';
import type {AppearanceScheme} from '@/types/preferences';
export default function Preview() {
 const [scheme,setScheme]=useState<AppearanceScheme>('dark');
 const [open,setOpen]=useState(false);
 const [published,setPublished]=useState(false);
 const tokens=useMemo(()=>getAppearanceTokens({scheme,accentSource:'curated',tint:'forest'},universities.tamu),[scheme]);
 useEffect(()=>{
   const root=document.documentElement;const variables=getAppearanceCssVariables(tokens);
   const previous=Object.fromEntries(Object.keys(variables).map(name=>[name,root.style.getPropertyValue(name)]));
   const previousScheme=root.style.colorScheme;
   for(const [name,value] of Object.entries(variables))root.style.setProperty(name,value);
   root.style.colorScheme=tokens.colorScheme;
   return()=>{for(const [name,value]of Object.entries(previous))root.style.setProperty(name,value);root.style.colorScheme=previousScheme;};
 },[tokens]);
 const viewer={...developmentUsers[0],account:{...developmentUsers[0].account,verifiedStudent:true,isDevelopment:true}};
 return <main className="campus-app-shell min-h-dvh bg-[var(--app-bg)] p-8 text-[var(--app-text-primary)]" data-appearance={scheme}>
   <h1>Local sample preview</h1>
   <p>No database writes</p>
   <div className="my-5 flex gap-4">{(['light','dark','colorful']as const).map(value=><button key={value} onClick={()=>setScheme(value)}>{value}</button>)}</div>
   <button onClick={()=>{setPublished(false);setOpen(true);}}>Open composer</button>
   {published&&<p role="status">Sample publication confirmed</p>}
   {open&&<CreateContentFlow viewer={viewer} users={developmentUsers} theme={universities.tamu} organizationMemberships={[]} organizationRoles={[]} onClose={()=>setOpen(false)} onCreateMint={async()=>{setPublished(true);return {ok:true,message:null};}}/>}
 </main>;
}
