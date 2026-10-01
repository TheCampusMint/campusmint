export type ClubRole = 'leader'|'officer'|'member'|'requested'|null;
export type ClubPerson = {id:string;name:string;username:string;role:ClubRole};
export type ClubView = {id:string;name:string;handle:string;summary:string;visibility:'private'|'public';memberCount:number;role:ClubRole;invited:boolean;ownerId:string|null;editable:boolean;description?:string;location?:string;schedule?:string;website?:string|null;photo?:string|null;tags?:string[];members?:ClubPerson[]};
export function canManageClub(role:ClubRole) { return role==='leader'||role==='officer'; }
export function canRemoveClubMember(actor:ClubRole,target:ClubRole) { return canManageClub(actor) && target!=='leader' && (target!=='officer'||actor==='leader'); }
export function clubDetails(input:Record<string,unknown>) {
  const text=(key:string,max:number)=>typeof input[key]==='string' ? (input[key] as string).trim().slice(0,max) : '';
  const name=text('name',160),description=text('description',5000),handle=text('handle',64).toLowerCase();
  if(name.length<2||description.length<2) throw new Error('Add a name and description.');
  const url=(key:string)=>{ const value=text(key,1000); if(!value)return ''; const u=new URL(value); if(u.protocol!=='https:'||u.username||u.password)throw new Error('Use an HTTPS link.'); return u.href; };
  return {name,description,handle,location:text('location',200),schedule:text('schedule',200),website:url('website'),photo:url('photo'),visibility:input.visibility==='public'?'public':'private',tags:Array.isArray(input.tags)?[...new Set(input.tags.filter((s):s is string=>typeof s==='string').map(s=>s.trim().slice(0,40)).filter(Boolean))].slice(0,8):[]};
}
