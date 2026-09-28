import assert from "node:assert/strict";
import test from "node:test";

import { configuredUniversityIds, universities } from "../data/universities.ts";
import { getCampusNetwork, getCampusNetworkForUniversity, isUniversityInCampusNetwork } from "../data/campusNetworks.ts";

const additionalIds = [
  "ucla", "stanford", "usc", "washington", "ohio-state", "penn-state",
  "duke", "uconn", "wisconsin", "mines", "williams",
];

test("the nationwide catalog has 20 distinct campuses with usable local display metadata", () => {
  assert.equal(configuredUniversityIds.length, 20);
  assert.equal(new Set(configuredUniversityIds).size, 20);
  assert.equal(new Set(Object.values(universities).map((campus) => campus.name)).size, 20);
  for (const id of configuredUniversityIds) {
    const campus = universities[id];
    assert.ok(campus.name && campus.shortName);
    assert.ok(campus.campusLatitude > 24 && campus.campusLatitude < 50);
    assert.ok(campus.campusLongitude > -125 && campus.campusLongitude < -66);
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: campus.timeZone }).format());
    assert.ok(campus.emailDomains.every((domain) => domain.endsWith(".edu")));
    const network = getCampusNetworkForUniversity(id);
    assert.equal(network?.id, campus.campusNetworkId, id);
    assert.equal(isUniversityInCampusNetwork(id, campus.campusNetworkId), true);
  }
});

test("new campus configuration does not enable ticket sales or broaden private campus access", () => {
  for (const id of additionalIds) {
    const campus = universities[id];
    assert.deepEqual(campus.accessibleCampuses, [id]);
    assert.equal(campus.marketplace.ticketMarketplaceEnabled, false);
    assert.equal(campus.marketplace.ticketResaleAllowed, null);
    assert.equal(campus.marketplace.ticketPolicyUrl, null);
    assert.deepEqual(getCampusNetwork(campus.campusNetworkId).enabledFeatures, []);
  }
});

test("regional geography never silently falls back to another campus", () => {
  assert.equal(getCampusNetwork("unknown"), null);
  assert.equal(getCampusNetworkForUniversity("unknown"), null);
  assert.equal(isUniversityInCampusNetwork("harvard", "los-angeles"), false);
  assert.equal(isUniversityInCampusNetwork("ucla", "los-angeles"), true);
  assert.equal(isUniversityInCampusNetwork("usc", "los-angeles"), true);
  assert.deepEqual(universities.ucla.accessibleCampuses, ["ucla"]);
  assert.deepEqual(universities.usc.accessibleCampuses, ["usc"]);
});
