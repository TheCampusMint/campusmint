export function canRecordPreference(input: {
  status:unknown; expiresAt:unknown; archivedAt:unknown; authorId:string; viewerId:string;
  authorAccountType:unknown; privacy:unknown; organizationAudience:unknown; organizationId:string|null;
  authorCampus:string|null; viewerCampus:string|null; connected:boolean; blocked:boolean; member:boolean;
},now=Date.now()) {
  if(input.blocked || input.status!=="active" || input.archivedAt || (input.expiresAt!=null && (typeof input.expiresAt!=="string" || !(Date.parse(input.expiresAt)>now)))) return false;
  if(input.authorId===input.viewerId)return true;
  if(input.authorAccountType!=="public" && !(input.authorAccountType==="private" && input.connected))return false;
  if(input.organizationAudience==="members" && (!input.organizationId || !input.member))return false;
  return input.privacy==="public" || (input.privacy==="connections" && input.connected) || (input.privacy==="account" && !!input.viewerCampus && input.viewerCampus===input.authorCampus);
}
