import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contracts from '../lib/clubs/contracts.ts';
import * as requestBody from '../lib/security/requestBody.ts';
const uid='10000000-1111-4111-8111-111111111111';
const owner='20000000-1111-4111-8111-111111111111';
const clubId='30000000-1111-4111-8111-111111111111';
function harness({signedIn=true,verified=true,member=false,admin=false}={}) {
 const rpc=[];const rows={profile_identities:[{user_id:uid,university_id:'tamu',verified_student:verified,account_type:'student'}],organizations:[{id:clubId,name:'Private Club',handle:'private-club',short_description:'SECRET summary',full_description:'SECRET details',visibility:'private',member_count:2,leader_user_id:owner,user_created:true,status:'active',university_id:'tamu',is_development:false,keywords:['Secret topic']}],organization_memberships:member||admin?[{organization_id:clubId,user_id:uid,status:admin?'officer':'member'}]:[],club_invitations:[],profile_blocks:[],account_capabilities:[]};
 const db={auth:{getUser:async()=>({data:{user:signedIn?{id:uid}:null},error:null})},rpc:async(name,args)=>{rpc.push({name,args});return {data:clubId,error:null};},from(table){let filters=[],one=false;const chain={select(){return chain},eq(k,v){filters.push(r=>r[k]===v);return chain},in(k,v){filters.push(r=>v.includes(r[k]));return chain},is(k,v){filters.push(r=>(r[k]??null)===v);return chain},or(){return chain},order(){return chain},limit(){return chain},maybeSingle(){one=true;return chain},then(resolve){const found=(rows[table]??[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:one?found[0]??null:found,error:null}).then(resolve)}};return chain;}};
 const modules={'next/server':{NextResponse:{json:Response.json}},'@/lib/supabase/server':{createSupabaseAdminClient:()=>db,createSupabaseServerClient:async()=>db},'@/lib/security/requestBody':requestBody,'@/lib/clubs/contracts':contracts,'@/lib/discovery/nearby':{safeWebUrl:v=>v??null}};
 const output=ts.transpileModule(readFileSync(new URL('../app/api/clubs/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',output)(id=>{assert.ok(id in modules,id);return modules[id]},exports);return {route:exports,rpc};
}
const get=(query='')=>new Request('https://campusmint.test/api/clubs'+query);
const post=body=>new Request('https://campusmint.test/api/clubs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('private club discovery exposes identity but not private page fields to outsiders',async()=>{
 const {route}=harness();const result=await route.GET(get());assert.equal(result.status,200);const {clubs}=await result.json();assert.equal(clubs[0].name,'Private Club');assert.doesNotMatch(JSON.stringify(clubs),/SECRET|Secret topic/);assert.equal(clubs[0].description,undefined);
 const accepted=await harness({member:true}).route.GET(get('?id='+clubId));assert.equal((await accepted.json()).clubs[0].description,'SECRET details');
});
test('club routes verify the session, Student status, campus and administrator search scope',async()=>{
 for(const options of [{signedIn:false},{verified:false}]) {const {route,rpc}=harness(options);assert.equal((await route.GET(get())).status,401);assert.equal((await route.POST(post({action:'request',clubId}))).status,401);assert.equal(rpc.length,0);}
 assert.equal((await harness().route.GET(get('?universityId=texas'))).status,403);
 assert.equal((await harness().route.GET(get('?id='+clubId+'&people=test'))).status,403);
});
test('club mutation actor always comes from verified session and input is normalized',async()=>{
 const {route,rpc}=harness();assert.equal((await route.POST(post({action:'create',name:'  Photo Club ',handle:'photo-club',description:'Campus photos',p_actor:owner,user_id:owner}))).status,200);
 assert.equal(rpc[0].args.p_actor,uid);assert.equal(rpc[0].args.p_data.name,'Photo Club');assert.equal(rpc[0].args.p_data.visibility,'private');
 assert.equal((await route.POST(post({action:'create',name:'Club',handle:'club',description:'Details',website:'javascript:alert(1)'}))).status,400);
 assert.equal((await route.POST(post({action:'approve',clubId:'not-a-uuid',targetId:owner}))).status,400);assert.equal(rpc.length,1);
});
