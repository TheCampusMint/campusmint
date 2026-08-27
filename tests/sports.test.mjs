import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  apPreseasonPoll,
  baseballSeasons,
  basketballSeasons,
  campusSports,
  featuredFootballTeamByUniversity,
  footballConferenceOptions,
  footballConferences,
  getBaseballSeason,
  getBasketballSeason,
  getFootballConferenceForTeam,
  getFootballSeason,
  getSoccerSeason,
  getSportsTeam,
  getTrackProgram,
  soccerSeasons,
  trackPrograms,
} from "../data/sports/index.ts";
import {
  initialSportsNavigationState,
  sportsNavigationReducer,
} from "../lib/sports/navigation.ts";

const sportsHubSource = readFileSync(
  new URL("../components/sports/SportsHub.tsx", import.meta.url),
  "utf8",
);

test("Sports exposes five real sport surfaces with football first", () => {
  assert.deepEqual(campusSports.map(({ id }) => id), ["football", "basketball", "baseball", "soccer", "track"]);
});

test("AP ranks are plain numeric data and the Sports UI does not prefix them with #", () => {
  assert.ok(apPreseasonPoll.every(({ rank }) => Number.isInteger(rank) && rank > 0));
  assert.doesNotMatch(sportsHubSource, /#\{rank\}|AP #/);
});

test("All teams was removed and SEC is labeled exactly SEC", () => {
  assert.equal(footballConferenceOptions.some(({ label }) => /all teams/i.test(label)), false);
  assert.equal(footballConferenceOptions.find(({ id }) => id === "sec")?.label, "SEC");
});

test("football selector is derived from AP plus every configured 2026 FBS grouping", () => {
  assert.deepEqual(
    footballConferenceOptions.map(({ id }) => id),
    ["ap-poll", ...footballConferences.map(({ id }) => id)],
  );
  assert.equal(footballConferences.length, 11);
});

test("2026 FBS membership contains 138 unique programs", () => {
  const ids = footballConferences.flatMap(({ teamIds }) => teamIds);
  assert.equal(ids.length, 138);
  assert.equal(new Set(ids).size, 138);
});

test("major 2026 realignment memberships are current", () => {
  assert.equal(getFootballConferenceForTeam("texas-am")?.id, "sec");
  assert.equal(getFootballConferenceForTeam("texas-state")?.id, "pac-12");
  assert.equal(getFootballConferenceForTeam("louisiana-tech")?.id, "sun-belt");
  assert.equal(getFootballConferenceForTeam("sacramento-state")?.id, "mac");
  assert.equal(getFootballConferenceForTeam("north-dakota-state")?.id, "mountain-west");
  assert.equal(getFootballConferenceForTeam("notre-dame")?.id, "independent");
});

test("conference team counts match verified 2026 alignment", () => {
  assert.deepEqual(
    Object.fromEntries(footballConferences.map(({ id, teamIds }) => [id, teamIds.length])),
    { sec: 16, "big-ten": 18, acc: 17, "big-12": 16, american: 14, cusa: 10, mac: 13, "mountain-west": 10, "pac-12": 8, "sun-belt": 14, independent: 2 },
  );
});

test("every football membership resolves to a shared team identity", () => {
  for (const conference of footballConferences) {
    for (const teamId of conference.teamIds) assert.ok(getSportsTeam(teamId), teamId);
  }
});

test("Texas A&M 2026 schedule contains the verified 12 opponents in order", () => {
  const games = getFootballSeason("texas-am").games;
  assert.deepEqual(games.map(({ opponentId }) => opponentId), [
    "missouri-state", "arizona-state", "kentucky", "lsu", "arkansas", "missouri",
    "the-citadel", "alabama", "south-carolina", "tennessee", "oklahoma", "texas",
  ]);
});

test("Texas A&M schedule preserves verified home and away mapping", () => {
  assert.deepEqual(getFootballSeason("texas-am").games.map(({ homeAway }) => homeAway), [
    "home", "home", "home", "away", "home", "away", "home", "away", "away", "home", "away", "home",
  ]);
});

test("future Texas A&M games do not contain fabricated results", () => {
  for (const game of getFootballSeason("texas-am").games) {
    assert.equal(game.status, "scheduled");
    assert.equal(game.result, undefined);
    assert.equal(game.scoringHighlight, undefined);
  }
});

test("completed Blinn opener uses the verified official result and scoring note", () => {
  const opener = getFootballSeason("blinn").games[0];
  assert.equal(opener.status, "final");
  assert.deepEqual(opener.result, { outcome: "W", teamScore: 34, opponentScore: 20 });
  assert.match(opener.scoringHighlight ?? "", /21 unanswered points/);
});

test("completed verified games can contain real results and optional scoring highlights", () => {
  const result = basketballSeasons[0].games[0];
  assert.deepEqual(result.result, { outcome: "W", teamScore: 63, opponentScore: 50 });
  assert.match(result.scoringHighlight ?? "", /22 points/);
});

test("every football team detail resolves to a schedule/results model", () => {
  const season = getFootballSeason("ohio-state");
  assert.equal(season.sport, "football");
  assert.ok(Array.isArray(season.games));
  assert.match(season.label, /schedule \/ results/i);
});

test("old roster, coach, overview and history team-detail modes are gone", () => {
  assert.doesNotMatch(sportsHubSource, /TeamDetailView|teamDetailViews|selectedTeam\.roster|selectedTeam\.coach/);
});

test("logo fallback identity retains a correct explicit abbreviation", () => {
  const citadel = getSportsTeam("the-citadel");
  assert.equal(citadel?.logoUrl, undefined);
  assert.equal(citadel?.abbreviation, "CIT");
  assert.equal(getSportsTeam("texas-am")?.abbreviation, "TAMU");
});

test("a school without verified track participation is not fabricated", () => {
  assert.equal(getTrackProgram("blinn"), null);
});

test("basketball, baseball and soccer resolve real campus program models", () => {
  assert.equal(getBasketballSeason("tamu").sport, "basketball");
  assert.equal(getBaseballSeason("tamu").sport, "baseball");
  assert.equal(getSoccerSeason("tamu").sport, "soccer");
  assert.ok(basketballSeasons.length >= 5);
  assert.ok(baseballSeasons.length >= 5);
  assert.ok(soccerSeasons.length >= 5);
});

test("track uses meet models instead of football-style games", () => {
  const program = getTrackProgram("tamu");
  assert.ok(program);
  assert.equal(program.meets.length, 3);
  assert.equal(program.meets.every(({ status }) => status === "completed"), true);
  assert.ok(trackPrograms.length >= 4);
});

test("Sports container uses content-driven height with no giant spacer constants", () => {
  assert.match(sportsHubSource, /data-natural-content-height="true"/);
  assert.doesNotMatch(sportsHubSource, /min-h-\[43rem\]|200vh|3000px|h-\[\d{4,}px\]/);
});

test("selecting a schedule opponent closes the floating panel before detail", () => {
  const selected = sportsNavigationReducer(
    { scheduleOpen: true, selectedTeamId: null },
    { type: "select-team", teamId: "lsu" },
  );
  assert.deepEqual(selected, { scheduleOpen: false, selectedTeamId: "lsu" });
});

test("leaf back action returns one level without reopening the schedule", () => {
  const back = sportsNavigationReducer(
    { scheduleOpen: false, selectedTeamId: "lsu" },
    { type: "back" },
  );
  assert.deepEqual(back, initialSportsNavigationState);
});

test("every configured campus maps to an actual featured football identity", () => {
  assert.deepEqual(featuredFootballTeamByUniversity, {
    tamu: "texas-am", blinn: "blinn", texas: "texas", lsu: "lsu", alabama: "alabama",
  });
  for (const teamId of Object.values(featuredFootballTeamByUniversity)) assert.ok(getSportsTeam(teamId));
});
