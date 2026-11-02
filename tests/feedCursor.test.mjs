import assert from "node:assert/strict";
import test from "node:test";
import { encodeFeedCursor, decodeFeedCursor } from "../lib/social/feedCursor.ts";
const position = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", createdAt: "2026-11-02T12:34:56.123456+00:00" };
const secret = "test-key-only", scope = JSON.stringify(["viewer","author",null,false]), now = 1000;
test("feed cursors preserve full PostgreSQL precision and hide private scan positions", () => {
 const token = encodeFeedCursor(position,scope,secret,now);
 assert.deepEqual(decodeFeedCursor(token,scope,secret,now),position);
 assert.ok(!Buffer.from(token,"base64url").toString().includes(position.id));
 assert.notEqual(token,encodeFeedCursor(position,scope,secret,now));
});
test("feed cursors reject account/scope swaps, expired and tampered tokens", () => {
 const token = encodeFeedCursor(position,scope,secret,now);
 for(const [s,k,t] of [["another-viewer",secret,now],[scope,"other-key",now],[scope,secret,now+86400000]]) assert.throws(()=>decodeFeedCursor(token,s,k,t));
 const bytes=Buffer.from(token,"base64url"); bytes[35]^=1;
 for(const bad of [bytes.toString("base64url"),"",token+",id.gt.0","a".repeat(601)]) assert.throws(()=>decodeFeedCursor(bad,scope,secret,now));
 assert.throws(()=>encodeFeedCursor({...position,createdAt:"now),id.gt.0"},scope,secret,now));
});
