"use client";

import {useCallback, useRef, useState} from "react";
import {useSocialSync} from "@/hooks/useSocialSync";
import {socialWrite} from "@/lib/social/syncClient";
import type {DirectMintAttachment, DirectMintConversation, DirectMintMessage} from "@/hooks/useDirectMint";
import {mergeConversationOrder,moveConversationId,moveConversationIdToIndex,type ProfileNote} from "@/lib/social/privateMessages";

type MessageRow = {id:string; conversation_id:string; sender_id:string; body:string; created_at:string; delivered_at:string|null; seen_at:string|null; reply_to_message_id:string|null};
type ConversationRow = {display_name:string;username:string;id:string; user_a:string; user_b:string; created_at:string; updated_at:string; pinned:boolean; unread:number; last_message:MessageRow|null};
const mapMessage=(row:MessageRow):DirectMintMessage=>({id:row.id,conversationId:row.conversation_id,senderId:row.sender_id,body:row.body,createdAt:row.created_at,status:row.seen_at?"seen":row.delivered_at?"delivered":"sent",seenAt:row.seen_at,replyToMessageId:row.reply_to_message_id});

export function useServerDirectMint(userId:string, enabled:boolean) {
  const [localOrder,setLocalOrder]=useState<{userId:string;ids:string[]}>({userId:"",ids:[]});
  const [selection,setSelection]=useState({userId:"",peer:""});
  const peer=selection.userId===userId?selection.peer:"";
  const inbox=useSocialSync<{items:ConversationRow[];hasMore:boolean}>(userId,"conversations",undefined,enabled);
  const thread=useSocialSync<{items:MessageRow[];hasMore:boolean}>(userId,"messages",peer,enabled&&Boolean(peer));
  const state=useSocialSync<{note:{body:string|null;website_url:string|null;updated_at:string}|null}>(userId,"state",undefined,enabled);
  const [operationError,setOperationError]=useState<{userId:string;message:string}|null>(null);
  const pending=useRef(new Set<string>());
  const retry=useRef<{signature:string;id:string}|null>(null);
  const rows=inbox.data?.items??[];
  const order=mergeConversationOrder(localOrder.userId===userId?localOrder.ids:[],rows.map(row=>row.id));
  const conversations:DirectMintConversation[]=rows.map(row=>({id:row.id,participantIds:[row.user_a,row.user_b],createdAt:row.created_at,updatedAt:row.updated_at}));
  const messages=(thread.data?.items??[]).map(mapMessage).reverse();
  const note=state.data?.note;
  const profileNote:ProfileNote|null=note&&(note.body||note.website_url)?{text:note.body??"",websiteUrl:note.website_url,music:null,updatedAt:note.updated_at}:null;
  const startConversation=useCallback((other:string)=>{setSelection({userId,peer:other});return other;},[userId]);
  function report(error:unknown) {setOperationError({userId,message:error instanceof Error?error.message:"Could not save."});}
  function mutate(key:string, operation:()=>Promise<unknown>) {
    if(pending.current.has(key))return;
    pending.current.add(key);setOperationError(null);
    void operation().catch(report).finally(()=>pending.current.delete(key));
  }
  async function sendMessage(other:string, body:string, options:{attachment?:DirectMintAttachment|null;replyToMessageId?:string|null}={}) {
    if(options.attachment&&options.attachment.type!=="sticker")throw new Error("File messages are not available yet. Your attachment is still here.");
    const text=[body.trim(),options.attachment?.type==="sticker"?options.attachment.url:""].filter(Boolean).join(" ");
    if(!text)return null;
    const signature=JSON.stringify([userId,other,text,options.replyToMessageId]);
    if(retry.current?.signature!==signature)retry.current={signature,id:crypto.randomUUID()};
    const result=await socialWrite("message",other,{body:text,requestId:retry.current.id,replyTo:options.replyToMessageId});
    retry.current=null;
    await Promise.all([thread.refresh(),inbox.refresh()]);
    return {id:result.id!,conversationId:result.conversationId!,senderId:userId,body:text,createdAt:new Date().toISOString(),status:"sent" as const,seenAt:null,replyToMessageId:options.replyToMessageId??null};
  }
  function messagesFor(other:string) {
    if(other===peer)return messages;
    const row=rows.find(row=>row.user_a===other||row.user_b===other);
    return row?.last_message?[mapMessage(row.last_message)]:[];
  }
  function markConversationSeen(other:string) {
    if(other!==peer||!messages.some(message=>message.senderId!==userId&&!message.seenAt))return;
    mutate(`seen:${userId}:${other}`,async()=>{await socialWrite("message_seen",other);await thread.refresh();});
  }
  function toggleConversationPin(other:string) {
    const row=rows.find(row=>row.user_a===other||row.user_b===other);if(!row)return;
    mutate(`pin:${userId}:${other}`,async()=>{await socialWrite("conversation_pin",other,{enabled:!row.pinned});await inbox.refresh();});
  }
  async function updateProfileNote(value:ProfileNote|null) {
    await socialWrite("note",null,{body:value?.text??"",website:value?.websiteUrl??null});await state.refresh();
  }
  return {
    peers:rows.map(row=>({account:{id:row.user_a===userId?row.user_b:row.user_a},profile:{displayName:row.display_name,username:row.username}})),
    conversations,messages,conversationOrder:rows.map(row=>row.id),
    conversationUserIds:[...rows].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||order.indexOf(a.id)-order.indexOf(b.id)).map(row=>row.user_a===userId?row.user_b:row.user_a),
    profileNote,pinnedConversationIds:rows.filter(row=>row.pinned).map(row=>row.id),hydrated:Boolean(inbox.data),
    startConversation,sendMessage,messagesFor,markConversationSeen,
    hasConversation:(other:string)=>rows.some(row=>row.user_a===other||row.user_b===other),
    moveConversation:(other:string,direction:-1|1)=>{
      const row=rows.find(item=>item.user_a===other||item.user_b===other);if(row)setLocalOrder({userId,ids:moveConversationId(order,row.id,direction)});
    },
    moveConversationToIndex:(other:string,destination:number)=>{
      const row=rows.find(item=>item.user_a===other||item.user_b===other);if(row)setLocalOrder({userId,ids:moveConversationIdToIndex(order,row.id,destination)});
    },
    updateProfileNote,toggleConversationPin,isConversationPinned:(other:string)=>rows.some(row=>(row.user_a===other||row.user_b===other)&&row.pinned),
    hasMore:thread.data?.hasMore ?? false,loadMore:thread.loadMore,
    error:operationError?.userId===userId?operationError.message:thread.error??inbox.error??state.error,
    loading:enabled&&Boolean(peer)&&!thread.data&&!thread.error,
  };
}
