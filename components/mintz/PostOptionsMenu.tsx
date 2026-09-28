"use client";
import {useRef,useState} from "react";
import {createPortal} from "react-dom";
import {useModalLayer} from "@/hooks/useModalLayer";
import type {InterestReason} from "@/lib/social/feedPreferences";
type Actions={onNotInterested?:(reason:InterestReason)=>void;onBlock?:()=>void;onReport:()=>void};
function Options({anchor,onClose,...actions}:Actions & {anchor:DOMRect;onClose:()=>void}) {
  const dialog=useRef<HTMLDivElement>(null);
  const [question,setQuestion]=useState(false);
  useModalLayer(dialog,onClose);
  const button="block w-full rounded-full px-3 py-2.5 text-left text-sm capitalize";
  return createPortal(<div className="fixed inset-0 z-[85]" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={question?"Why not interested?":"Post options"} className="fixed w-56 rounded-2xl bg-[var(--app-surface-elevated)] p-3 text-[var(--app-text-primary)]" style={{left:Math.max(12,Math.min(anchor.right-224,window.innerWidth-236)),top:Math.max(12,Math.min(anchor.bottom+4,window.innerHeight-280))}}>
    {question?<><p className="px-3 pb-2 text-sm font-semibold">Why not interested?</p>{(["creator","content","relevance"] as const).map(reason=><button key={reason} className={button} onClick={()=>{actions.onNotInterested?.(reason);onClose();}}>{reason}</button>)}</>:<>{actions.onNotInterested && <button data-initial-focus className={button} onClick={()=>setQuestion(true)}>Not interested</button>}<button className={button} onClick={()=>{actions.onReport();onClose();}}>Report</button>{actions.onBlock && <button className={button} onClick={()=>{actions.onBlock?.();onClose();}}>Block</button>}</>}
  </div></div>,document.body);
}
export function PostOptionsMenu(actions:Actions) {
  const [anchor,setAnchor]=useState<DOMRect|null>(null);
  return <><button type="button" aria-label="Post options" aria-haspopup="dialog" aria-expanded={!!anchor} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl" onClick={event=>setAnchor(event.currentTarget.getBoundingClientRect())}>⋯</button>{anchor && <Options {...actions} anchor={anchor} onClose={()=>setAnchor(null)}/>}</>;
}
