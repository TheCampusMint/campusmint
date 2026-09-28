import assert from "node:assert/strict";
import test from "node:test";
import { campusAthleticsProfiles, getAvailableCampusPrograms } from "../data/sports/campus.ts";
import { configuredUniversityIds } from "../data/universities.ts";
import { parseOfficialSchedule } from "../lib/sports/officialSchedule.ts";

const now = new Date("2026-09-27T12:00:00Z");
const program = campusAthleticsProfiles.harvard.programs.rowing;
const fixture = { "@type": "SportsEvent", startDate: "2026-10-17T12:00:00Z", awayTeam: { name: "Head of the Charles" }, location: { name: "Cambridge" } };
const html = (value) => '<title>2026 Rowing Schedule</title><script type="application/ld+json">' + JSON.stringify(value) + "</script>";

test("WMT display indices are not game IDs and nested result markup is parsed", () => {
  const game = (id, date) => '<div name="scheduleBeforeScheduledEvent0"></div><time datetime="' + date + '">Date</time><div class="schedule-item-team__opponent">Opponent</div><div class="schedule-event-item-result__label"><strong>W</strong><span>Win</span> 45-24</div><div entity-id="' + id + '" entity-name="schedule-events"></div><div name="scheduleAfterScheduledEvent0"></div>';
  const page = '<title>2026 Football Schedule</title>' + game("100", "2026-09-05") + game("101", "2026-09-12");
  const result = parseOfficialSchedule(page, "ucla", campusAthleticsProfiles.ucla.programs.football, now);
  assert.equal(result.games.length, 2);
  assert.deepEqual(result.games.map(g => g.sourceGameId), ["100", "101"]);
  assert.ok(result.games.every(g => g.result === "W" && g.campusScore === 45));
});

test("all 20 campuses have one to three distinct source-backed slots; Harvard leads with rowing", () => {
  assert.equal(configuredUniversityIds.length, 20);
  for (const id of configuredUniversityIds) {
    const programs = getAvailableCampusPrograms(campusAthleticsProfiles[id]);
    assert.ok(programs.length >= 1 && programs.length <= 3, id);
    assert.equal(new Set(programs.map(p => p.sport)).size, programs.length);
    assert.ok(programs.every(p => p.source.sourceUrl.includes("/schedule")));
  }
  assert.equal(getAvailableCampusPrograms(campusAthleticsProfiles.harvard)[0].sport, "rowing");
  assert.equal(getAvailableCampusPrograms(campusAthleticsProfiles.williams).length, 2);
  const oversized = { ...campusAthleticsProfiles.harvard, featuredSports: ["rowing", "rowing", "hockey", "football", "basketball"], supportedSports: ["rowing", "hockey", "football", "basketball"], programs: { ...campusAthleticsProfiles.harvard.programs, basketball: campusAthleticsProfiles.tamu.programs.basketball } };
  assert.equal(getAvailableCampusPrograms(oversized).length, 3);
});

test("official fixture imports preserve shape and never infer live/final results from dates", () => {
  const next = parseOfficialSchedule(html([fixture]), "harvard", program, now);
  assert.equal(next.games[0].opponentName, "Head of the Charles");
  assert.equal(next.games[0].status, "scheduled");
  const past = parseOfficialSchedule(html([{ ...fixture, startDate: "2026-09-01" }]), "harvard", program, now);
  assert.equal(past.games[0].status, "verification_pending");
  assert.equal(past.games[0].campusScore, null);
  assert.throws(() => parseOfficialSchedule(html({ "@graph": [fixture] }), "harvard", program, now), /No complete/);
  assert.throws(() => parseOfficialSchedule(html([fixture]).replace("2026 Rowing", "2020 Rowing"), "harvard", program, now), /not current/);
});

test("explicit Sidearm scores validate outcomes and preserve previous verified finals", () => {
  const pool = [];
  function encode(value) {
    const index = pool.length; pool.push(null);
    pool[index] = Array.isArray(value) ? value.map(encode) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])) : value;
    return index;
  }
  function page(outcome, score) {
    pool.length = 0;
    encode({ school_name: "Alabama", sport: "football", season: { title: "2026" }, games: [{ id: 42, date: "2026-09-05", opponent: { title: "Opponent" }, result: { status: outcome, team_score: score, opponent_score: "10" }, location_indicator: "H" }] });
    return '<title>2026 Football Schedule</title><script id="__NUXT_DATA__">' + JSON.stringify(pool) + "</script>";
  }
  const fb = campusAthleticsProfiles.alabama.programs.football;
  const result = parseOfficialSchedule(page("W", "48"), "alabama", fb, now);
  assert.equal(result.games[0].status, "final");
  assert.equal(result.games[0].campusScore, 48);
  assert.throws(() => parseOfficialSchedule(page("L", "48"), "alabama", fb, now), /contradicts/);
  const kept = parseOfficialSchedule(page("", ""), "alabama", result, now);
  assert.equal(kept.games[0].campusScore, 48);
});
