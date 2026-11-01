import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function verifyHarness({eligible=true,metadata=null,recordFails=false}={}) {
 const calls={claims:0,records:0,signouts:0,verify:0};
 const user={id,email:'student@tamu.edu',app_metadata:metadata?{account_type:metadata}:{}};
 const session={user,access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:2000000000};
 const auth={auth:{verifyOtp:async()=>{calls.verify++;return{data:{user,session}};},signOut:async()=>{calls.signouts++;}}};
 const modules={
  '@/lib/security/server':{consumeRateLimit:async()=>({allowed:true}),auditSecurityEvent:async()=>{}},
  '@/lib/security/nativeSession':{recordNativeSession:async()=>{calls.records++;if(recordFails)throw new Error('offline');}},
  '@/lib/security/requestBody':{readJsonBody:request=>request.json()},
  'next/server':{NextResponse:{json:Response.json}},
  '@/lib/auth/accountTypes':{isSignupAccountType:value=>['student','brand','creator'].includes(value),normalizeAuthEmail:value=>value.trim().toLowerCase()},
  '@/lib/auth/studentEmail':{assessStudentEmail:()=>eligible?{ok:true,resolved:{identity:{knownUniversityId:'tamu'}}}:{ok:false}},
  '@/lib/supabase/server':{hasSupabasePublicConfig:()=>true,hasSupabaseServerConfig:()=>true,createSupabaseServerClient:async()=>auth,createSupabaseAdminClient:()=>({auth:{admin:{updateUserById:async()=>{calls.claims++;return{};}}}})},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/student-verification/verify/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in modules,name);return modules[name];},exports);
 return{calls,run:patch=>exports.POST(new Request('https://campusmint.test/api/student-verification/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,code:'123456',client:'ios',mode:'sign_up',accountType:'student',...patch})}))};
}
test('native signup requires an explicit Student flow and never silently upgrades sign-in',async()=>{
 for(const patch of [{mode:'anything'},{accountType:'brand'},{accountType:'creator'}]){const h=verifyHarness();assert.equal((await h.run(patch)).status,400);assert.equal(h.calls.verify,0);}
 const h=verifyHarness();assert.equal((await h.run({mode:'sign_in'})).status,403);assert.equal(h.calls.claims,0);assert.equal(h.calls.records,0);
});
test('native signup verifies eligibility and identity before returning tokens',async()=>{
 const bad=verifyHarness({eligible:false});assert.equal((await bad.run()).status,400);assert.equal(bad.calls.claims,0);assert.equal(bad.calls.records,0);
 const mismatch=verifyHarness({metadata:'brand'});assert.equal((await mismatch.run()).status,400);assert.equal(mismatch.calls.records,0);
 const h=verifyHarness();const response=await h.run();assert.equal(response.status,200);const body=await response.json();assert.equal(body.userId,id);assert.equal(body.session.userId,id);assert.equal(h.calls.records,1);assert.equal(h.calls.claims,1);
});
test('failed native-session tracking returns no usable credentials',async()=>{
 const h=verifyHarness({recordFails:true});const response=await h.run();assert.equal(response.status,503);assert.equal((await response.json()).session,undefined);assert.equal(h.calls.signouts,1);
});
