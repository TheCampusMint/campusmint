import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {canShareMint} from '../lib/sharing/publicPolicy.ts';
import {safeWebUrl} from '../lib/discovery/nearby.ts';
const id='11111111-1111-4111-8111-111111111111';
function harness(patch={}) {
 const tables={social_content:[{id,kind:'mint',author_id:'author',caption:'Hello',status:'active',expires_at:null,organization_audience:'public',organization_id:null,poll_definition:{question:'Tea?',options:[{id:'a',label:'Yes'}]},...patch.content}],mints:[{content_id:id,privacy:'public',archived_at:null,...patch.mint}],profiles:[{user_id:'author',username:'student',display_name:'Student',social_account_type:'public',email:'never exposed',...patch.profile}],content_media:[{id:'media',content_id:id,media_type:'video',storage_path:'private-file',width:320,height:640}],organizations:[]};let signed=0;
 const admin={from(t){let filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},maybeSingle(){return Promise.resolve({data:tables[t].find(r=>filters.every(f=>f(r)))??null,error:null})},then(resolve){return Promise.resolve({data:tables[t].filter(r=>filters.every(f=>f(r))),error:null}).then(resolve)}};return q;},storage:{from(){return {async createSignedUrl(){signed++;return {data:{signedUrl:'https://example.test/video'}}}}}}};
 const bindings={'server-only':{},react:{cache:fn=>fn},'@/lib/supabase/server':{createSupabaseAdminClient:()=>admin},'./publicPolicy':{canShareMint},'@/lib/discovery/nearby':{safeWebUrl}};
 const code=ts.transpileModule(readFileSync(new URL('../lib/sharing/publicContent.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in bindings,name);return bindings[name]},exports);
 return {...exports,signed:()=>signed};
}
test('public share signs only the requested public media and returns no account/contact fields',async()=>{
 const app=harness();const result=await app.publicMint(id);assert.equal(result.caption,'Hello');assert.equal(result.poll.question,'Tea?');assert.equal(result.media[0].height,640);assert.equal(app.signed(),1);assert.equal(JSON.stringify(result).includes('never exposed'),false);assert.equal(JSON.stringify(result).includes('private-file'),false);
});
test('private, expired, archived, removed and club-member content never receives a guest media URL',async()=>{
 for(const patch of [{mint:{privacy:'private'}},{mint:{privacy:'account'}},{mint:{archived_at:'2026-01-01'}},{profile:{social_account_type:'private'}},{content:{expires_at:'2020-01-01'}},{content:{status:'removed'}},{content:{organization_audience:'members'}},{content:{organization_id:'missing-club'}}]){
 const app=harness(patch);assert.equal(await app.publicMint(id),null);assert.equal(app.signed(),0);
 }
});
