import assert from "node:assert/strict";
import test from "node:test";

import {
  durationForMotion,
  initialNotchScrollState,
  resolveGestureAxis,
  updateNotchScrollState,
} from "../lib/motion/interaction.ts";

test("gesture axis waits for deliberate movement", () => {
  assert.equal(resolveGestureAxis(5, 2), "pending");
  assert.equal(resolveGestureAxis(18, 6), "horizontal");
  assert.equal(resolveGestureAxis(6, 18), "vertical");
  assert.equal(resolveGestureAxis(14, 13), "pending");
});

test("notch ignores jitter and collapses only after sustained downward travel", () => {
  let state = initialNotchScrollState;
  state = updateNotchScrollState(state, 40);
  state = updateNotchScrollState(state, 41);
  assert.equal(state.collapsed, false);

  state = updateNotchScrollState(state, 60);
  assert.equal(state.collapsed, false);
  state = updateNotchScrollState(state, 82);
  assert.equal(state.collapsed, true);
});

test("notch expands after a deliberate upward reversal and near page top", () => {
  let state = {
    collapsed: true,
    lastY: 180,
    direction: "down",
    travel: 0,
  };
  state = updateNotchScrollState(state, 160);
  assert.equal(state.collapsed, true);
  state = updateNotchScrollState(state, 140);
  assert.equal(state.collapsed, false);

  state = { ...state, collapsed: true, lastY: 90 };
  state = updateNotchScrollState(state, 18);
  assert.equal(state.collapsed, false);
});

test("reduced motion removes transition time without changing state", () => {
  assert.equal(durationForMotion(300, false), 300);
  assert.equal(durationForMotion(300, true), 0);
});
