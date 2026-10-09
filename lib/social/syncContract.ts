export const isAccountId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const actions = ['comment','appreciate','endorse','save','share','comment_like','delete_comment','message','message_seen','conversation_pin','follow','block','attendance','notification_read','note'] as const;
export type SocialAction = typeof actions[number];
export function parseSocialRead(query: URLSearchParams) {
  const resource=query.get('resource')??'state',target=query.get('target'),before=query.get('before'),beforeId=query.get('beforeId');
  if (!['state','comments','conversations','messages','notifications'].includes(resource)) return null;
  if ((['comments','messages'].includes(resource)&&!target)||(target&&!isAccountId(target))) return null;
  if ((before&&!Number.isFinite(Date.parse(before)))||(beforeId&&!isAccountId(beforeId))||Boolean(before)!==Boolean(beforeId)) return null;
  return {p_resource:resource,p_target:target,p_before:before,p_before_id:beforeId??'ffffffff-ffff-ffff-ffff-ffffffffffff'};
}
export function parseSocialMutation(input: Record<string,unknown>) {
  if (!actions.includes(input.action as SocialAction)) return null;
  const action=input.action as SocialAction;
  if (input.target!=null&&!isAccountId(input.target)) return null;
  if (!['notification_read','note'].includes(action)&&!isAccountId(input.target)) return null;
  const data:Record<string,unknown>={};
  if (input.enabled!==undefined&&typeof input.enabled!=='boolean')return null;
  if (input.enabled!==undefined)data.enabled=input.enabled;
  if (['comment','message','share'].includes(action)) {
    if (!isAccountId(input.requestId))return null;data.requestId=input.requestId;
  }
  if (['comment','message','note'].includes(action)) {
    if (typeof input.body!=='string')return null;
    data.body=input.body.trim();
    if ((data.body as string).length>(action==='note'?150:5000)||(action!=='note'&&!data.body))return null;
    for(const key of ['parentId','replyTo'])if(input[key]!=null) {if(!isAccountId(input[key]))return null;data[key]=input[key];}
  }
  if(action==='share') {if(!['copy_link','direct_message','external'].includes(String(input.channel)))return null;data.channel=input.channel;}
  if(action==='note'&&input.website) {
    if(typeof input.website!=='string'||input.website.length>1000)return null;
    try {const url=new URL(input.website);if(url.protocol!=='https:'||url.username||url.password)return null;data.website=url.href;}catch{return null;}
  }
  // Actor IDs, permissions, attachment URLs and arbitrary metadata are never accepted.
  return {p_action:action,p_target:input.target??null,p_data:data};
}
