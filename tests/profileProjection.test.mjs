import test from 'node:test';
import assert from 'node:assert/strict';
import { databasePrivacyField, projectFeedAuthor } from '../lib/social/profileProjection.ts';
const author={account:{id:'author',capabilities:['owner_campus_tester','creator']},profile:{bio:'BIO',major:'MAJOR',academicArea:'ACADEMIC',hometown:'HOME',interests:['HIDDEN'],classIds:['CLASS'],clubIds:['CLUB'],photo:{storagePath:'private/avatar'},roommatePreferences:['ROOM'],lookingForRoommate:true},privacy:{bio:'friends_only',major:'students_only',hometown:'private',interests:'private',classes:'friends_only',clubs:'students_only',roommate:'private'},socialSettings:{accountType:'public'}};
test('feed authors redact private fields before any client receives them',()=>{
 const result=projectFeedAuthor(author,{id:'viewer',verifiedStudent:true,connected:false,preview:false});
 assert.equal(result.profile.bio,null);assert.equal(result.profile.hometown,null);assert.deepEqual(result.profile.interests,[]);assert.deepEqual(result.profile.classIds,[]);assert.equal(result.profile.major,'MAJOR');assert.equal(result.profile.photo.storagePath,null);assert.deepEqual(result.account.capabilities,['creator']);
 assert.equal(author.profile.bio,'BIO','source is not mutated');
 const friend=projectFeedAuthor(author,{id:'viewer',verifiedStudent:true,connected:true,preview:false});assert.equal(friend.profile.bio,'BIO');assert.equal(friend.profile.hometown,null);
});
test('private accounts, unverified viewers and preview mode cannot bypass field visibility',()=>{
 const privateAccount={...author,socialSettings:{accountType:'private'}};
 assert.equal(projectFeedAuthor(privateAccount,{id:'viewer',verifiedStudent:true,connected:false,preview:false}).profile.major,null);
 assert.equal(projectFeedAuthor(author,{id:'viewer',verifiedStudent:false,connected:false,preview:false}).profile.academicArea,null);
 assert.equal(projectFeedAuthor(author,{id:'viewer',verifiedStudent:true,connected:true,preview:true}).profile.bio,null);
 assert.equal(projectFeedAuthor(author,{id:'author',verifiedStudent:true,connected:false,preview:false}),author);
});

test('database privacy names map identically for account restoration and feed redaction',()=>{
 assert.equal(databasePrivacyField('graduationYear'),'graduation_year');
 assert.equal(databasePrivacyField('portfolioUrl'),'portfolio_url');
 assert.equal(databasePrivacyField('personalWebsite'),'personal_website');
 assert.equal(databasePrivacyField('bio'),'bio');
});
