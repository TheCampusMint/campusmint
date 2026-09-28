import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { campusReadScope, resolveCampusPreview } from "../lib/runtime/campusPreview.ts";
import { accountScopedValue, activateAccountRequestScope, beginAccountRequest, createAccountRequestScope } from "../lib/content/accountRequestScope.ts";

test("campus preview is optional, session scoped, and revoked without changing the saved identity", () => {
  const selection = Object.freeze({ accountId: "owner", universityId: "harvard" });
  assert.equal(resolveCampusPreview(null, "owner", "tamu", true), null);
  assert.equal(resolveCampusPreview(selection, "owner", "tamu", true), "harvard");
  assert.equal(resolveCampusPreview(selection, "other-account", "tamu", true), null);
  assert.equal(resolveCampusPreview(selection, "owner", "tamu", false), null);
  assert.equal(resolveCampusPreview(selection, "owner", "harvard", true), null);
  assert.deepEqual(selection, { accountId: "owner", universityId: "harvard" });
});

test("campus switches and returning home hide earlier feeds and reject late responses", () => {
  const home = campusReadScope("owner");
  const firstCampus = campusReadScope("owner", "harvard");
  const secondCampus = campusReadScope("owner", "duke");
  const scope = createAccountRequestScope(home);
  const homeRequest = beginAccountRequest(scope, home);
  const privateFeed = [{ id: "home-only", poll: { selectedOptionId: "private-choice" } }];
  assert.deepEqual(accountScopedValue(home, firstCampus, privateFeed, []), []);
  activateAccountRequestScope(scope, firstCampus);
  const firstRequest = beginAccountRequest(scope, firstCampus);
  activateAccountRequestScope(scope, secondCampus);
  assert.equal(homeRequest.isCurrent(), false);
  assert.equal(firstRequest.signal.aborted, true);
  assert.equal(firstRequest.isCurrent(), false);
  assert.equal(beginAccountRequest(scope, firstCampus), null);
  const secondRequest = beginAccountRequest(scope, secondCampus);
  activateAccountRequestScope(scope, home);
  assert.equal(secondRequest.isCurrent(), false);
  assert.deepEqual(accountScopedValue(secondCampus, home, [{ id: "test-post" }], []), []);
  assert.notEqual(home, campusReadScope("another-account"));
});

function compile(relative, dependencies, extra = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", ...Object.keys(extra), compiled)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports, ...Object.values(extra));
  return exports;
}

test("real poll UI permits normal voting but renders disabled answers in campus preview", () => {
  const context = React.createContext(false);
  const { MintPoll } = compile("../components/mintz/MintPoll.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/components/developer/CampusPreviewContext": { useCampusPreview: () => React.useContext(context) },
  });
  const poll = { question: "Coffee or tea?", totalVotes: 4, selectedOptionId: null, options: [{ id: "1", label: "Coffee", voteCount: 3 }, { id: "2", label: "Tea", voteCount: 1 }] };
  const render = (preview) => renderToStaticMarkup(React.createElement(context.Provider, { value: preview }, React.createElement(MintPoll, { mintId: "real-post", poll, isDevelopment: false })));
  assert.equal((render(true).match(/disabled=""/g) ?? []).length, 2);
  assert.match(render(true), /Campus preview · voting is off/);
  assert.doesNotMatch(render(false), /disabled=""/);
  assert.match(render(false), /Choose one answer/);
});

test("event hook clears prior campus immediately and ignores out-of-order reads", async () => {
  let state;
  let previousDependencies;
  let cleanup;
  let effect;
  const requests = [];
  const { useCampusEvents: runWithMockHooks } = compile("../hooks/useCampusEvents.ts", {
    react: {
      useState(initial) { state ??= initial; return [state, (next) => { state = next; }]; },
      useEffect(callback, dependencies) {
        if (!previousDependencies || dependencies.some((value, index) => value !== previousDependencies[index])) {
          previousDependencies = dependencies;
          effect = callback;
        }
      },
    },
    "@/data/events": { campusEvents: [] },
    "@/data/universities": { universities: { harvard: { accessibleCampuses: ["harvard"] }, duke: { accessibleCampuses: ["duke"] } } },
    "@/lib/runtime/campusPreview": { campusReadScope },
  }, {
    fetch: (url, options) => new Promise((resolve) => requests.push({ url, options, resolve })),
  });
  const render = (campus, account = "owner") => {
    const result = runWithMockHooks(campus, account);
    if (effect) { cleanup?.(); const callback = effect; effect = null; cleanup = callback(); }
    return result;
  };
  const resolve = async (index, events) => {
    requests[index].resolve({ ok: true, json: async () => ({ ok: true, events }) });
    await new Promise((done) => setImmediate(done));
  };
  assert.deepEqual(render(null).events, []);
  await resolve(0, [{ id: "home-event" }]);
  assert.deepEqual(render(null).events, [{ id: "home-event" }]);
  assert.deepEqual(render("harvard").events, []);
  assert.equal(requests[1].url, "/api/events?universityId=harvard");
  assert.deepEqual(render("duke").events, []);
  assert.equal(requests[1].options.signal.aborted, true);
  await resolve(2, [{ id: "duke-event" }]);
  await resolve(1, [{ id: "late-harvard-event" }]);
  assert.deepEqual(render("duke").events, [{ id: "duke-event" }]);
  assert.deepEqual(render("duke", "another-account").events, []);
  cleanup?.();
});
