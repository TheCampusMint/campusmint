import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as body from '../lib/security/requestBody.ts';
import * as contract from '../lib/social/syncContract.ts';
function route({user={id:'canonical-owner'},rpcError=null}={}) {
 const calls=[];
 const modules={
  'next/server':{NextResponse:{json:Response.json}},
  '@/lib/security/requestBody':body,
  '@/lib/social/syncContract':contract,
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user},error:null})}}),createSupabaseAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:rpcError?null:{ok:true},error:rpcError};}})},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/account/privacy/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(modules[name],name);return modules[name];},exports);
 return{...exports,calls};
}
const request=value=>new Request('https://campusmint.test/api/account/privacy',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
test('privacy route authenticates and derives the only writable owner from the session',async()=>{
 const signedOut=route({user:null});assert.equal((await signedOut.PATCH(request({bio:'private'}))).status,401);assert.equal(signedOut.calls.length,0);
 const owner=route();assert.equal((await owner.PATCH(request({bio:'private',userId:'someone-else'}))).status,400);assert.equal(owner.calls.length,0);
 const response=await owner.PATCH(request({bio:'private',graduationYear:'friends_only'}));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(owner.calls,[{name:'update_profile_privacy',args:{p_actor:'canonical-owner',p_patch:{bio:'private',graduationYear:'friends_only'}}}]);
});
test('privacy route cannot report success when authorization or persistence fails',async()=>{
 for(const [code,status] of [['42501',403],['22023',400],['XX000',503]]){const api=route({rpcError:{code}});const result=await api.PATCH(request({accountType:'public'}));assert.equal(result.status,status);assert.equal((await result.json()).ok,false);}
 const api=route();assert.equal((await api.PATCH(new Request('https://campusmint.test/api/account/privacy',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{'}))).status,400);assert.equal(api.calls.length,0);
});
