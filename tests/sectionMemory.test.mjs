import assert from "node:assert/strict";
import test from "node:test";

import { SectionMemory } from "../lib/navigation/sectionMemory.ts";

test("direct return restores the immediately previous section", () => {
  const memory = new SectionMemory("mint");
  memory.capture("mint", 720);

  assert.deepEqual(memory.commit("sports"), {
    scrollY: 0,
    refreshGeneration: 0,
    refreshed: false,
  });

  memory.capture("sports", 360);

  assert.deepEqual(memory.commit("mint"), {
    scrollY: 720,
    refreshGeneration: 0,
    refreshed: false,
  });
});

test("a third settled section evicts the oldest one", () => {
  const memory = new SectionMemory("mint");
  memory.capture("mint", 720);
  memory.commit("sports");
  memory.capture("sports", 360);
  memory.commit("messages");

  assert.deepEqual(memory.getRetainedSections(), ["messages", "sports"]);
  assert.equal(memory.getScrollY("mint"), 0);
});

test("returning to an evicted section resets and refreshes it", () => {
  const memory = new SectionMemory("mint");
  memory.capture("mint", 720);
  memory.commit("sports");
  memory.commit("messages");

  assert.deepEqual(memory.commit("mint"), {
    scrollY: 0,
    refreshGeneration: 1,
    refreshed: true,
  });
});

test("rendered neighbors do not affect recency until committed", () => {
  const memory = new SectionMemory("mint");

  memory.getScrollY("groups");
  memory.getRefreshGeneration("groups");

  assert.deepEqual(memory.getRetainedSections(), ["mint"]);
});

test("Sports uses the same two-section retention and refresh behavior", () => {
  const memory = new SectionMemory("mint", 2);
  memory.commit("sports");
  memory.capture("sports", 410);
  memory.commit("groups");

  assert.deepEqual(memory.getRetainedSections(), ["groups", "sports"]);
  assert.deepEqual(memory.commit("sports"), {
    scrollY: 410,
    refreshGeneration: 0,
    refreshed: false,
  });
});
