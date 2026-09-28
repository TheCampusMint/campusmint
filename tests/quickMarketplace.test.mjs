import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as listing from '../lib/marketplace/listing.ts';
import * as nearby from '../lib/discovery/nearby.ts';
import * as safety from '../lib/marketplaceSafety.ts';
const seller='11111111-1111-4111-8111-111111111111', buyer='22222222-2222-4222-8222-222222222222', stranger='33333333-3333-4333-8333-333333333333', item='44444444-4444-4444-8444-444444444444';
const fields={ title:'Desk lamp', askingPrice:12.50, brand:'IKEA', condition:'Good', pickupArea:'Student center', requestId:item };
function compile(path,bindings){ const exports={}; const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)((name)=>{assert.ok(name in bindings,`Unexpected dependency ${name}`);return bindings[name]},exports);return exports; }
function harness({userId=buyer,verified=true,authenticated=true,network='campus',revoked=false,disabled=false,rows={}}={}){
 const tables={profile_identities:[{user_id:userId,university_id:'tamu',account_type:'student',verified_student:verified}],campus_network_universities:[{university_id:'tamu',campus_network_id:network}],campus_networks:[{id:network,enabled_features:['marketplace']}],marketplace_verified_students:[{user_id:userId,university_id:'tamu',revoked_at:revoked?'2026-01-01':null}],university_marketplace_policies:disabled?[{university_id:'tamu',marketplace_enabled:false}]:[],profile_blocks:[],profiles:[{user_id:seller,first_name:'Seller'},{user_id:buyer,first_name:'Buyer'},{user_id:stranger,first_name:'Other buyer'}],marketplace_listings:[{id:item,seller_user_id:seller,university_id:'tamu',campus_network_id:'campus',status:'active',title:'Desk',description:'Desk',condition:'good',asking_price:10,pickup_area:'Library'}],marketplace_messages:[],...rows};
 const admin={from(table){tables[table]??=[];let mode='select',value,one=false;const filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},or(expr){const parts=expr.split(',').map(part=>part.split('.eq.'));filters.push(r=>parts.some(([k,v])=>r[k]===v));return q},order(){return q},limit(){return q},maybeSingle(){one=true;return q},insert(v){mode='insert';value=v;return q},update(v){mode='update';value=v;return q},then(resolve){let result=tables[table].filter(r=>filters.every(f=>f(r)));if(mode==='insert'){if(tables[table].some(r=>r.id===value.id))return Promise.resolve({data:null,error:{code:'23505'}}).then(resolve);result=[{created_at:new Date().toISOString(),...value}];tables[table].push(...result)}if(mode==='update'){result.forEach(r=>Object.assign(r,value))}return Promise.resolve({data:one?result[0]??null:result,error:null}).then(resolve)}};return q}};
 const server=compile('../lib/marketplace/server.ts',{'server-only':{},'@/lib/supabase/server':{hasSupabaseServerConfig:()=>true,createSupabaseAdminClient:()=>admin,createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:userId}:null}})}})}});
 const bindings={'@/lib/discovery/nearby':nearby,'next/server':{NextResponse:{json:Response.json}},'@/lib/marketplace/server':server,'@/lib/marketplace/listing':listing,'@/lib/marketplaceSafety':safety};
 return {tables,items:compile('../app/api/marketplace/route.ts',bindings),messages:compile('../app/api/marketplace/messages/route.ts',bindings)};
}
const request=(method,body)=>new Request('https://example.test/api/marketplace',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const inbox=()=>new Request(`https://example.test/api/marketplace/messages?listingId=${item}`);
test('quick listing requires title, price, condition and meetup; brand can be empty',()=>{
 assert.equal(listing.parseQuickListing({...fields,brand:''}).brand,'');
 for(const patch of [{title:' '},{pickupArea:''},{askingPrice:-1},{askingPrice:NaN},{askingPrice:'12'},{askingPrice:0.001},{condition:'unknown'}]) assert.throws(()=>listing.parseQuickListing({...fields,...patch}));
});
test('unverified, logged-out, revoked and disabled accounts cannot publish',async()=>{
 for(const config of [{verified:false},{authenticated:false},{revoked:true},{disabled:true}]){const app=harness(config);const response=await app.items.POST(request('POST',fields));assert.ok([401,403].includes(response.status));assert.equal(app.tables.marketplace_listings.length,1)}
});
test('publishing uses real session identity, persists details and retries without duplicate listings',async()=>{
 const app=harness({rows:{marketplace_listings:[]}});
 for(let n=0;n<2;n++) assert.ok((await app.items.POST(request('POST',{...fields,sellerId:stranger,universityId:'other',campusNetworkId:'other'}))).ok);
 assert.equal(app.tables.marketplace_listings.length,1);const row=app.tables.marketplace_listings[0];assert.equal(row.seller_user_id,buyer);assert.equal(row.university_id,'tamu');assert.equal(row.campus_network_id,'campus');assert.equal(row.moderation_metadata.brand,'IKEA');assert.equal(row.asking_price,12.5);assert.equal(row.status,'active');
 const result=await (await app.items.GET(new Request("https://example.test/api/marketplace"))).json();assert.equal(result.listings[0].brand,'IKEA');
});
test('prohibited items are rejected and only the owner can mark sold',async()=>{
 const app=harness();assert.equal((await app.items.POST(request('POST',{...fields,title:'firearm'}))).status,400);
 assert.equal((await app.items.PATCH(request('PATCH',{id:item,status:'sold'}))).status,404);
 const own=harness({userId:seller});assert.equal((await own.items.PATCH(request('PATCH',{id:item,status:'sold'}))).status,200);assert.equal(own.tables.marketplace_listings[0].status,'sold');
});
test('buyers cannot read other buyers’ messages; seller sees participating buyers',async()=>{
 const messages=[{id:'a',listing_id:item,buyer_id:buyer,sender_id:buyer,body:'My question'},{id:'b',listing_id:item,buyer_id:stranger,sender_id:stranger,body:'Private other question'}];
 const app=harness({rows:{marketplace_messages:messages}});const result=await(await app.messages.GET(inbox())).json();assert.deepEqual(result.messages.map(m=>m.body),['My question']);assert.equal(result.buyers.length,1);
 const own=harness({userId:seller,rows:{marketplace_messages:messages}});assert.equal((await(await own.messages.GET(inbox())).json()).messages.length,2);
});
test('cross-campus and blocked users cannot read or send listing messages',async()=>{
 for(const config of [{network:'different'},{rows:{profile_blocks:[{blocker_id:seller,blocked_id:buyer}]}}]){const app=harness(config);assert.equal((await app.messages.GET(inbox())).status,404);assert.equal((await app.messages.POST(request('POST',{listingId:item,body:'Hello',requestId:buyer}))).status,404)}
});
test('contact binds the sender and buyer to the real session; seller can only reply to an existing buyer',async()=>{
 const app=harness();const body={listingId:item,buyerId:stranger,senderId:stranger,body:'Is it available?',requestId:buyer};
 assert.equal((await app.messages.POST(request('POST',body))).status,200);assert.equal((await app.messages.POST(request('POST',body))).status,200);
 assert.equal(app.tables.marketplace_messages.length,1);assert.equal(app.tables.marketplace_messages[0].sender_id,buyer);assert.equal(app.tables.marketplace_messages[0].buyer_id,buyer);
 const own=harness({userId:seller});assert.equal((await own.messages.POST(request('POST',{...body,buyerId:buyer}))).status,403);
 own.tables.marketplace_messages.push(...app.tables.marketplace_messages);assert.equal((await own.messages.POST(request('POST',{...body,buyerId:buyer,requestId:seller}))).status,200);
});

test('nearby search excludes unknown or distant locations and preserves campus and block boundaries',async()=>{
 const base={id:item,seller_user_id:seller,campus_network_id:'campus',status:'active',asking_price:5};
 const app=harness({rows:{marketplace_listings:[{...base,moderation_metadata:{nearbyLocation:{latitude:30.62,longitude:-96.34}}},{...base,id:'far',moderation_metadata:{nearbyLocation:{latitude:32,longitude:-96}}},{...base,id:'unknown'},{...base,id:'other',campus_network_id:'other',moderation_metadata:{nearbyLocation:{latitude:30.62,longitude:-96.34}}}]}});
 const result=await(await app.items.GET(new Request('https://example.test/api/marketplace?lat=30.62&lng=-96.34'))).json();
 assert.deepEqual(result.listings.map(r=>r.id),[item]);
});
test('location metadata is saved only with per-listing consent, and is coarse',async()=>{
 for(const consent of [false,true]){
 const app=harness({rows:{marketplace_listings:[]}});
 assert.equal((await app.items.POST(request('POST',{...fields,shareNearbyArea:consent,nearbyLocation:{latitude:30.62345,longitude:-96.33456}}))).status,201);
 assert.deepEqual(app.tables.marketplace_listings[0].moderation_metadata.nearbyLocation,consent?{latitude:30.62,longitude:-96.33}:null);
 }
});
