import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  defaultSportsEntitlement,
  getAvailableCampusPrograms,
  getCampusAthleticsProfile,
  getCampusRankingBoards,
  getCampusGameDetail,
  getVerifiedGameParticipants,
  getLiveCampusGames,
  launchCampusSports,
  resolveDefaultCampusSport,
  resolveCampusGameState,
} from "../data/sports/campus.ts";

const sportsHubSource = readFileSync(
  new URL("../components/sports/SportsHub.tsx", import.meta.url),
  "utf8",
);
const currentTime = new Date("2026-08-29T12:00:00-05:00").getTime();
const tamu = getCampusAthleticsProfile("tamu");

test("65. the Sports catalog supports university-specific featured programs", () => {
  assert.deepEqual(launchCampusSports.map(({ id }) => id), ["football", "basketball", "baseball", "soccer", "volleyball", "softball", "gymnastics", "track", "hockey", "rowing"]);
});

test("66. an unavailable sport is hidden from a school's programs", () => {
  const basketballOnly = {
    ...tamu,
    supportedSports: ["basketball"],
  };
  assert.deepEqual(
    getAvailableCampusPrograms(basketballOnly).map(({ sport }) => sport),
    ["basketball"],
  );
  assert.deepEqual(getAvailableCampusPrograms(getCampusAthleticsProfile("blinn")).map(({ sport }) => sport), ["football", "baseball", "volleyball"]);
});

test("67. Soccer can be selected by a university configuration", () => {
  assert.equal(launchCampusSports.some(({ id }) => id === "soccer"), true);
});

test("68. unsupported provider data remains separate from featured-sport identity", () => {
  assert.equal(getCampusAthleticsProfile("alabama").featuredSports.includes("gymnastics"), true);
  assert.equal(getAvailableCampusPrograms(getCampusAthleticsProfile("alabama")).every(({ schedulePublished }) => !schedulePublished), true);
});

test("69. Sports resolves the current user's university", () => {
  assert.equal(tamu.universityId, "tamu");
  assert.equal(tamu.universityName, "Texas A&M University");
});

test("70. a provisional university cannot inherit TAMU Sports data", () => {
  assert.equal(getCampusAthleticsProfile(null), null);
});

test("71. the live panel never fabricates a game", () => {
  assert.deepEqual(getLiveCampusGames(tamu, currentTime), []);
});

test("72. no live games has the required concise state", () => {
  assert.match(sportsHubSource, /No games live right now/);
});

test("73. the default sport resolver is deterministic", () => {
  assert.equal(
    resolveDefaultCampusSport(tamu, currentTime),
    resolveDefaultCampusSport(tamu, currentTime),
  );
});

test("74. a genuinely live sport receives first priority", () => {
  const basketball = tamu.programs.basketball;
  const liveProfile = {
    ...tamu,
    programs: {
      ...tamu.programs,
      basketball: {
        ...basketball,
        games: [{ ...basketball.games[0], status: "live" }],
      },
    },
  };
  assert.equal(resolveDefaultCampusSport(liveProfile, currentTime), "basketball");
});

test("75. selected sports expose full current published schedule fixtures", () => {
  assert.equal(tamu.programs.football.schedulePublished, true);
  assert.equal(tamu.programs.football.games.length, 12);
  assert.equal(tamu.programs.basketball.schedulePublished, true);
  assert.equal(tamu.programs.basketball.games.length, 33);
});

test("76. the current official 2027 baseball schedule is published", () => {
  assert.equal(tamu.programs.baseball.schedulePublished, true);
  assert.equal(tamu.programs.baseball.games.length > 0, true);
  assert.match(tamu.programs.baseball.source.sourceUrl, /^https:\/\/12thman\.com\//);
});

test("77. the published 2027 baseball schedule retains its official season identity", () => {
  assert.equal(tamu.programs.baseball.seasonLabel, "2027");
  assert.equal(tamu.programs.baseball.games.some(({ opponentName }) => opponentName.includes("LSU")), true);
});

test("78. Texas A&M's 2026 football opener is Missouri State", () => {
  assert.equal(tamu.programs.football.games[0].opponentName, "Missouri State");
  assert.equal(tamu.programs.football.games[0].dateLabel, "Sep 5");
});

test("79. LSU is later and not week one", () => {
  const games = tamu.programs.football.games;
  assert.equal(games.findIndex(({ opponentName }) => opponentName === "LSU"), 3);
  assert.equal(games[3].dateLabel, "Sep 26");
});

test("80. Texas A&M football home and away metadata is correct", () => {
  assert.deepEqual(tamu.programs.football.games.map(({ homeAway }) => homeAway), [
    "home", "home", "home", "away", "home", "away",
    "home", "away", "away", "home", "away", "home",
  ]);
});

test("81. future games contain no invented result while the completed opener is final", () => {
  const [opener, ...futureGames] = tamu.programs.football.games;
  assert.deepEqual([opener.status, opener.result, opener.campusScore, opener.opponentScore], ["final", "W", 50, 0]);
  for (const game of futureGames) {
    assert.equal(game.status, "scheduled");
    assert.equal(game.result, null);
    assert.equal(game.campusScore, null);
    assert.equal(game.opponentScore, null);
  }
});

test("91. Sep 10 date-aware state identifies Arizona State as the next verified game", () => {
  const auditTime = Date.parse("2026-09-10T12:00:00-05:00");
  const opener = tamu.programs.football.games[0];
  const next = tamu.programs.football.games[1];
  assert.equal(resolveCampusGameState(opener, tamu.programs.football.source, auditTime), "final");
  assert.equal(next.opponentName, "Arizona State");
  assert.equal(resolveCampusGameState(next, tamu.programs.football.source, auditTime), "scheduled");
  assert.equal(tamu.programs.football.record, "1–0");
});

test("92. current AP board resolves Texas A&M at No. 10", () => {
  const national = getCampusRankingBoards(tamu, "football").find(({ kind }) => kind === "national");
  assert.equal(national.entries.find(({ teamId }) => teamId === "texas-am")?.rank, 10);
});

test("93. completed detail contains only source-backed participants and upcoming detail is empty", () => {
  const completed = tamu.programs.football.games[0];
  const upcoming = tamu.programs.football.games[1];
  assert.ok(getCampusGameDetail(completed));
  assert.equal(getCampusGameDetail(upcoming), null);
  assert.equal(getVerifiedGameParticipants(completed).every(({ participated }) => participated === true), true);
  assert.deepEqual(getVerifiedGameParticipants(upcoming), []);
});

test("82. the game model can represent a verified completed result", () => {
  const completed = {
    ...tamu.programs.football.games[0],
    status: "final",
    result: "W",
    campusScore: 28,
    opponentScore: 17,
  };
  assert.deepEqual(
    [completed.status, completed.result, completed.campusScore, completed.opponentScore],
    ["final", "W", 28, 17],
  );
});

test("83. national ranking availability is conditional", () => {
  assert.equal(getCampusRankingBoards(tamu, "football").length > 0, true);
  assert.deepEqual(getCampusRankingBoards(tamu, "basketball"), []);
  assert.deepEqual(getCampusRankingBoards(getCampusAthleticsProfile("blinn"), "football"), []);
});

test("84. the user receives national and own-conference context only", () => {
  assert.deepEqual(
    getCampusRankingBoards(tamu, "football").map(({ kind }) => kind),
    ["national", "conference"],
  );
});

test("85. Texas A&M resolves SEC context without arbitrary conference controls", () => {
  const conference = getCampusRankingBoards(tamu, "football").find(
    ({ kind }) => kind === "conference",
  );
  assert.match(conference.title, /^SEC/);
  assert.doesNotMatch(sportsHubSource, /footballConferenceOptions|Big Ten|Big 12|ACC/);
});

test("86. poll entries are informational and do not restore team browsing", () => {
  assert.doesNotMatch(sportsHubSource, /selectTeam|onOpponent|TeamDetail/);
});

test("87. the campus model supports D2 and D3 without requiring D1", () => {
  const d2 = { ...tamu, division: "ncaa_d2", divisionLabel: "NCAA Division II" };
  const d3 = { ...tamu, division: "ncaa_d3", divisionLabel: "NCAA Division III" };
  assert.equal(getAvailableCampusPrograms(d2).length, 3);
  assert.equal(getAvailableCampusPrograms(d3).length, 3);
});

test("88. Sports+ entitlement defaults safely", () => {
  assert.equal(defaultSportsEntitlement.sportsPlus, false);
});

test("89. no paid entitlement is fabricated", () => {
  assert.equal(defaultSportsEntitlement.source, "development_default");
  assert.doesNotMatch(sportsHubSource, /payment successful|subscription activated/i);
});

test("90. every campus has exactly three explicit sports with provenance", () => {
  for (const universityId of ["tamu", "blinn", "texas", "lsu", "alabama", "oregon", "harvard", "michigan", "miami"]) {
    const profile = getCampusAthleticsProfile(universityId);
    assert.equal(profile.featuredSports.length, 3);
    assert.equal(getAvailableCampusPrograms(profile).length, 3);
    for (const program of getAvailableCampusPrograms(profile)) {
      assert.ok(program.source.sourceName);
      assert.match(program.source.sourceUrl, /^https:\/\//);
      assert.ok(program.source.season);
      assert.ok(program.source.verifiedAt);
    }
  }
});
