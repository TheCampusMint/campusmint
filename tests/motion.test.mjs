import assert from "node:assert/strict";
import test from "node:test";

import {
  clampNavigationIndex,
  durationForMotion,
  expandNotchPresentation,
  getNotchDotAvailability,
  initialNotchScrollState,
  resistFiniteNavigationEdge,
  resolveFiniteNavigationDestination,
  resolveGestureAxis,
  updateNotchScrollState,
} from "../lib/motion/interaction.ts";

test("gesture axis waits for deliberate movement", () => {
  assert.equal(resolveGestureAxis(5, 2), "pending");
  assert.equal(resolveGestureAxis(18, 6), "horizontal");
  assert.equal(resolveGestureAxis(6, 18), "vertical");
  assert.equal(resolveGestureAxis(14, 13), "pending");
});

test("notch ignores jitter and progressively collapses through compact to dots", () => {
  let state = initialNotchScrollState;
  state = updateNotchScrollState(state, 40);
  state = updateNotchScrollState(state, 41);
  assert.equal(state.presentation, "expanded");

  state = updateNotchScrollState(state, 60);
  assert.equal(state.presentation, "expanded");
  state = updateNotchScrollState(state, 82);
  assert.equal(state.presentation, "compact");
  state = updateNotchScrollState(state, 120);
  assert.equal(state.presentation, "compact");
  state = updateNotchScrollState(state, 180);
  assert.equal(state.presentation, "dots");
});

test("notch expands after a deliberate upward reversal and near page top", () => {
  let state = {
    presentation: "dots",
    lastY: 180,
    direction: "down",
    travel: 0,
  };
  state = updateNotchScrollState(state, 160);
  assert.equal(state.presentation, "dots");
  state = updateNotchScrollState(state, 140);
  assert.equal(state.presentation, "compact");

  state = { ...state, presentation: "dots", lastY: 90 };
  state = updateNotchScrollState(state, 18);
  assert.equal(state.presentation, "expanded");
});

test("dot expansion is presentation-only and boundaries remain finite", () => {
  assert.equal(expandNotchPresentation("dots"), "compact");
  assert.equal(expandNotchPresentation("compact"), "expanded");
  assert.deepEqual(getNotchDotAvailability(0, 4), { hasPrevious: false, hasNext: true });
  assert.deepEqual(getNotchDotAvailability(3, 4), { hasPrevious: true, hasNext: false });
});

test("reduced motion removes transition time without changing state", () => {
  assert.equal(durationForMotion(300, false), 300);
  assert.equal(durationForMotion(300, true), 0);
});

test("primary navigation clamps at Messages and Groups without wrapping", () => {
  assert.equal(clampNavigationIndex(-1, 4), 0);
  assert.equal(clampNavigationIndex(4, 4), 3);
  assert.equal(resolveFiniteNavigationDestination(0, 1, 4), 0);
  assert.equal(resolveFiniteNavigationDestination(3, -1, 4), 3);
  assert.equal(resolveFiniteNavigationDestination(1, -1, 4), 2);
  assert.equal(resolveFiniteNavigationDestination(2, 1, 4), 1);
});

test("finite navigation resists only outward edge drags", () => {
  assert.equal(resistFiniteNavigationEdge(0.5, 0, 4), 0.1);
  assert.equal(resistFiniteNavigationEdge(-0.5, 3, 4), -0.1);
  assert.equal(resistFiniteNavigationEdge(-0.5, 0, 4), -0.5);
  assert.equal(resistFiniteNavigationEdge(0.5, 3, 4), 0.5);
});
