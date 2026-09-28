import assert from 'node:assert/strict';
import test from 'node:test';
import {canRecordPreference} from '../lib/social/preferencePermissions.ts';
import {coordinates,insideNearby,rankNearbyFood,safeWebUrl} from '../lib/discovery/nearby.ts';
import {bryanDates} from '../lib/discovery/sourceDates.ts';
import {canShareMint} from '../lib/sharing/publicPolicy.ts';
import {learnFeedSignals,preferenceScore,recommendationAllowed,mergeFeedSignals,exploreRankedFeed} from '../lib/social/feedPreferences.ts';
const now=Date.parse('2026-09-27T12:00:00Z');
const post=(id,caption,authorId='author')=>({id,authorId,caption,hashtags:[],viewCount:0});
test('ten-mile boundary rejects invalid or missing coordinates, does not guess campus membership',()=>{
 const origin={latitude:0,longitude:0};
 assert.equal(insideNearby(origin,{latitude:0.14,longitude:0}),true);
 assert.equal(insideNearby(origin,{latitude:0.15,longitude:0}),false);
 for(const p of [null,{}, {latitude:NaN,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:'0',longitude:0}])assert.equal(coordinates(p),null);
 assert.equal(insideNearby(origin,null),false);
});
test('restaurant order is rating, then review count, after strict radius filtering',()=>{
 const items=[{id:'a',title:'A',latitude:0,longitude:0,rating:4.4,ratingCount:200},{id:'b',title:'B',latitude:0,longitude:0,rating:4.8,ratingCount:40},{id:'outside',latitude:1,longitude:0,rating:5}];
 assert.deepEqual(rankNearbyFood(items,{latitude:0,longitude:0}).map(i=>i.id),['b','a']);
 assert.equal(safeWebUrl('javascript:alert(1)'),null);
});
test('guest share policy fails closed for private, campus, archived, deleted, members-only and expired posts',()=>{
 const allowed={status:'active',privacy:'public',accountType:'public',archivedAt:null,expiresAt:null,organizationAudience:'public'};
 assert.equal(canShareMint(allowed,now),true);
 for(const patch of [{privacy:'private'},{privacy:'account'},{privacy:'connections'},{accountType:'private'},{accountType:null},{status:'removed'},{archivedAt:'2026-01-01'},{expiresAt:'2026-01-01'},{expiresAt:'invalid'},{organizationAudience:'members'}])assert.equal(canShareMint({...allowed,...patch},now),false);
});
test('meaningful dwell teaches related interests; skipped and unseen posts stay eligible',()=>{
 const cat=post('cats','Cats and kittens');const dog=post('dogs','Dogs and puppies','second');
 const learned=learnFeedSignals([cat,dog],'viewer',[{userId:'viewer',mintId:'cats',totalMeaningfulDwellMs:45000,lastViewedAt:new Date(now).toISOString()}],[],[]);
 assert.equal(learned.length,1);
 assert.ok(preferenceScore(post('more-cats','Cats playing','third'),learned,now)>preferenceScore(dog,learned,now));
 assert.equal(recommendationAllowed(dog,learned,'session'),true);
 assert.equal(learnFeedSignals([cat],'viewer',[{userId:'viewer',mintId:'cats',totalMeaningfulDwellMs:3000,lastViewedAt:new Date(now).toISOString()}],[],[]).length,0);
});
test('not interested removes the post immediately and future dwell cannot undo it',()=>{
 const item=post('cats','Cats');const no={mintId:'cats',authorId:'author',topics:['cats'],weight:0,reason:'creator',updatedAt:new Date(now).toISOString()};
 const later={...no,reason:null,weight:4,updatedAt:new Date(now+60000).toISOString()};
 const merged=mergeFeedSignals([no],[later]);assert.equal(merged[0].reason,'creator');
 assert.equal(recommendationAllowed(item,merged,'next'),false);
 assert.equal(recommendationAllowed(post('dogs','Dogs','unrelated'),merged,'next'),true);
 const trials=Array.from({length:10000},(_,i)=>recommendationAllowed(post(`other-${i}`,'Fish'),merged,'session')).filter(Boolean).length;
 assert.ok(trials<20,`Suppressed creator surfaced ${trials} / 10000 times`);
});
test('exploration and popularity retain distinct posts instead of removing unfamiliar topics',()=>{
 const ranked=Array.from({length:20},(_,i)=>({mint:{...post(String(i),i<10?'Cats':'Dogs',String(i)),viewCount:i===19?9000:0}}));
 const mixed=exploreRankedFeed(ranked,[{mintId:'old',authorId:'old',topics:['cats'],weight:4,reason:null,updatedAt:new Date(now).toISOString()}],'seed');
 assert.equal(mixed.length,20);assert.equal(new Set(mixed.map(r=>r.mint.id)).size,20);
 assert.equal(mixed[5].mint.caption,'Dogs');assert.ok(mixed.findIndex(r=>r.mint.id==='19')<=8);
});

test('Bryan local wall-clock times are corrected only when confirmed by visible source times',()=>{
 assert.equal(bryanDates('2026-10-04T12:00:00.000000Z','2026-10-04T16:00:00.000000Z','<br>12:00 PM – 4:00 PM').startsAt,'2026-10-04T17:00:00.000Z');
 assert.equal(bryanDates('2026-12-04T12:00:00.000000Z',undefined,'<br>12:00 PM').startsAt,'2026-12-04T18:00:00.000Z');
 assert.equal(bryanDates('2026-10-04T17:00:00Z',undefined,'<br>12:00 PM').startsAt,'2026-10-04T17:00:00Z');
});

test('preference writes cannot reveal private post metadata through guessed IDs',()=>{
 const context={status:'active',expiresAt:null,archivedAt:null,authorId:'author',viewerId:'viewer',authorAccountType:'public',privacy:'public',organizationAudience:'public',organizationId:null,authorCampus:'tamu',viewerCampus:'tamu',connected:false,blocked:false,member:false};
 assert.equal(canRecordPreference(context),true);
 for(const patch of [{blocked:true},{authorAccountType:'private'},{privacy:'private'},{privacy:'account',viewerCampus:'other'},{privacy:'connections'},{organizationAudience:'members',organizationId:'club'},{status:'removed'}])assert.equal(canRecordPreference({...context,...patch}),false);
 assert.equal(canRecordPreference({...context,privacy:'connections',connected:true,authorAccountType:'private'}),true);
 assert.equal(canRecordPreference({...context,privacy:'account'}),true);
 assert.equal(canRecordPreference({...context,organizationAudience:'members',organizationId:'club',member:true}),true);
});

test('content feedback does not suppress unrelated posts just for sharing a broad word',()=>{
 const negative={mintId:'source',authorId:'source-author',topics:['campus','cats'],weight:0,reason:'content',updatedAt:new Date(now).toISOString()};
 assert.equal(recommendationAllowed({...post('other','Campus dogs playing','other-author'),hashtags:['campus','dogs']},[negative],'seed'),true);
});
