import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialMutation,parseSocialRead} from '../lib/social/syncContract.ts';
import {mapServerNotification} from '../lib/notifications/serverNotifications.ts';
const id='12345678-1234-4123-8123-123456789012';
test('social mutations retain only validated fields, never an actor or attachment URL',()=>{
 const result=parseSocialMutation({action:'comment',target:id,requestId:id,body:' hi ',p_actor:id,actor:id,attachmentUrl:'https://arbitrary.test'});
 assert.deepEqual(result,{p_action:'comment',p_target:id,p_data:{requestId:id,body:'hi'}});
 for(const body of ['', ' \n\t ', 'x'.repeat(5001)]) assert.equal(parseSocialMutation({action:'message',target:id,requestId:id,body}),null);
 for(const enabled of ['true',1,{}])assert.equal(parseSocialMutation({action:'save',target:id,enabled}),null);
 assert.equal(parseSocialMutation({action:'message',target:id,body:'Missing id'}),null);
 assert.equal(parseSocialMutation({action:'admin',target:id}),null);
});
test('social read cursors require a date/id pair and private resources require a target',()=>{
 for(const query of ['resource=messages','resource=comments&target=no','resource=secrets','before=2026-01-01','beforeId='+id,'before=bad&beforeId='+id]) assert.equal(parseSocialRead(new URLSearchParams(query)),null,query);
 assert.ok(parseSocialRead(new URLSearchParams({resource:'comments',target:id,before:'2026-01-01T00:00:00Z',beforeId:id})));
});
test('notes refuse embedded credentials, insecure links and oversize text',()=>{
 for(const website of ['javascript:alert(1)','http://site.test','https://user:pass@site.test'])assert.equal(parseSocialMutation({action:'note',body:'Hi',website}),null);
 assert.equal(parseSocialMutation({action:'note',body:'x'.repeat(151)}),null);
});
test('notification mapper does not expose private payload bodies or arbitrary destinations',()=>{
 const row={id,actor_id:id,kind:'private_message',payload:{body:'Private text',url:'javascript:alert(1)'},created_at:'2026-01-01',read_at:null,username:'student',display_name:'Student'};
 const mapped=mapServerNotification(row,id);
 assert.equal(mapped.preview,null);assert.deepEqual(mapped.destination,{scene:'message',userId:id});
 assert.equal(JSON.stringify(mapped).includes('Private text'),false);
 assert.equal(mapServerNotification({...row,kind:'unknown'},id),null);
});
