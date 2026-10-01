import type { CampusScheduleGame, CampusSportProgram } from "../../data/sports/campus.ts";
import type { UniversityId } from "../../data/universities.ts";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

/** Decode only the schedule subtree of Sidearm's public Nuxt payload. Never execute page scripts. */
function sidearmSchedule(html: string): JsonObject | null {
  const raw = html.match(/<script\b[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;
  const pool: unknown[] = parsed;
  const index = pool.findIndex((entry) => {
    const row = object(entry);
    return "games" in row && "season" in row && "school_name" in row && "sport" in row;
  });
  if (index < 0) return null;
  function resolve(ref: unknown, depth = 0): unknown {
    if (depth > 20 || !Number.isInteger(ref) || (ref as number) < 0) return null;
    const value = pool[ref as number];
    if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, depth + 1)]));
    return value;
  }
  return object(resolve(index));
}

/** Explicit official results only; a elapsed date never invents a final or live score. */
export function parseOfficialSchedule(html: string, universityId: UniversityId, previous: CampusSportProgram, now = new Date()): CampusSportProgram {
  const title = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (!/schedule/i.test(title) && !html.includes("schedule-hero__title")) throw new Error("Official schedule page was not recognized.");
  const year = now.getUTCFullYear();
  if (![year - 1, year, year + 1].some((entry) => title.includes(String(entry)))) throw new Error("Official schedule season is not current.");
  const schedule = sidearmSchedule(html);
  let games: CampusScheduleGame[] = [];
  const baseGame = (id: string, date: string, opponentName: string): CampusScheduleGame => {
    if (!opponentName || !Number.isFinite(Date.parse(date))) throw new Error("Invalid official game.");
    return { id: universityId + "-" + previous.sport + "-" + id, sourceGameId: id, sport: previous.sport, opponentName, date,
      dateLabel: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      timeLabel: null, homeAway: "neutral", location: null, network: null,
      status: Date.parse(date) < now.getTime() ? "verification_pending" : "scheduled",
      campusScore: null, opponentScore: null, result: null, liveDetail: null,
      scheduleSourceUrl: previous.source.sourceUrl, lastUpdated: now.toISOString() };
  };
  if (schedule && Array.isArray(schedule.games)) {
    games = schedule.games.filter((entry) => !text(object(entry).noplay_text)).map((entry) => {
      const row = object(entry);
      const game = baseGame(String(row.id), text(row.date), text(object(row.opponent).title));
      const result = object(row.result);
      const outcome = text(result.status).toUpperCase();
      if (/^[WLT]$/.test(outcome)) {
        if (!/^\d+$/.test(text(result.team_score)) || !/^\d+$/.test(text(result.opponent_score))) throw new Error("Result has no verified score.");
        const ours = Number(result.team_score), theirs = Number(result.opponent_score);
        if (outcome === "W" ? ours <= theirs : outcome === "L" ? ours >= theirs : ours !== theirs) throw new Error("Result contradicts score.");
        game.status = "final"; game.result = outcome as "W" | "L" | "T"; game.campusScore = ours; game.opponentScore = theirs;
      }
      game.homeAway = row.location_indicator === "H" ? "home" : row.location_indicator === "A" ? "away" : "neutral";
      game.location = text(row.location) || null; game.timeLabel = text(row.time) || null;
      game.network = text(object(row.media).tv) || null;
      return game;
    });
  } else if (html.includes("scheduleBeforeScheduledEvent")) {
    function classText(chunk: string, name: string) {
      return text(chunk.match(new RegExp('<([a-z][a-z0-9]*)\\b[^>]*class=["\'][^"\']*\\b' + name + '\\b[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/\\1>', "i"))?.[2]).replace(/&amp;/g, "&").replace(/&#39;/g, "'");
    }
    const chunks = [...html.matchAll(/name=["']scheduleBeforeScheduledEvent(\d+)["']([\s\S]*?)name=["']scheduleAfterScheduledEvent\1["']/g)];
    games = chunks.map(([, id, chunk]) => {
      const date = chunk.match(/<time\b[^>]*datetime=["']([^"']+)["']/)?.[1] ?? "";
      const name = ["schedule-event-default__name", "schedule-item-team__opponent", "schedule-event-item-team__opponent-name", "schedule-event-item__opponent-name"].map((className) => classText(chunk, className)).find(Boolean) ?? "";
      const sourceId = chunk.match(/entity-id=["'](\d+)["']\s+entity-name=["']schedule-events["']/)?.[1] ?? id;
      const game = baseGame(sourceId, date, name.replace(/^\(#?\d+\)\s*/, ""));
      const score = classText(chunk, "schedule-event-item-result__label").match(/^([WLT]),?\s*(?:Win|Loss|Tie)?\s*(\d+)\s*[-–]\s*(\d+)(?:\s.*)?$/i);
      if (score) {
        const ours = Number(score[2]), theirs = Number(score[3]), outcome = score[1].toUpperCase();
        if (outcome === "W" ? ours <= theirs : outcome === "L" ? ours >= theirs : ours !== theirs) throw new Error("Result contradicts score.");
        game.status = "final"; game.result = outcome as "W" | "L" | "T"; game.campusScore = ours; game.opponentScore = theirs;
      }
      game.homeAway = /schedule-event-date--venue-away/.test(chunk) ? "away" : /schedule-event-date--venue-neutral/.test(chunk) ? "neutral" : "home";
      game.location = classText(chunk, "schedule-event-default__venue") || null;
      game.timeLabel = classText(chunk, "schedule-event-date__clock") || null;
      return game;
    });
  } else {
    // Classic Sidearm exposes SportsEvent JSON-LD. It supplies fixtures, not verified scores.
    const events: JsonObject[] = [];
    function visit(value: unknown) {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const row = object(value);
      if (row["@type"] === "SportsEvent") events.push(row);
      // Ignore WebPage graphs: their single featured event is not the full schedule.
    }
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) visit(JSON.parse(match[1]));
    games = events.filter((row) => !/Cancelled|Postponed/.test(text(row.eventStatus))).map((row, index) => {
      // The official school's schedule lists the visiting opponent in awayTeam even for away fixtures.
      const opponentName = text(object(row.awayTeam).name);
      const game = baseGame(text(row.startDate) + "-" + index, text(row.startDate), opponentName);
      game.location = text(object(row.location).name) || null;
      return game;
    });
  }
  const unique = new Map<string, CampusScheduleGame>();
  for (const game of games) {
    const existing = unique.get(game.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(game)) throw new Error("Conflicting official games.");
    unique.set(game.id, game);
  }
  games = [...unique.values()];
  if (!games.length) throw new Error("No complete official schedule found.");
  const season = text(object(schedule?.season).title) || title.match(/\d{4}(?:[-–]\d{2,4})?/)?.[0] || previous.seasonLabel;
  const merged = games.map((game) => {
    const old = previous.games.find((entry) => entry.date.slice(0, 10) === game.date.slice(0, 10) && entry.opponentName === game.opponentName);
    return old?.status === "final" && game.status !== "final" ? old : { ...game, detail: old?.detail ?? null };
  });
  if (previous.seasonLabel === season && previous.games.some((old) => old.status === "final" && !merged.some((game) => game.date.slice(0, 10) === old.date.slice(0, 10) && game.opponentName === old.opponentName))) throw new Error("Official schedule lost a verified result.");
  const dates = games.map(game=>game.date.slice(0,10)).sort();
  return { ...previous, schedulePublished: true, seasonLabel: season, games: merged,
    seasonStart: dates[0], seasonEnd: dates[dates.length-1], record: null,
    source: { ...previous.source, season, verifiedAt: now.toISOString(), lastFetchedAt: now.toISOString(), staleAfter: new Date(now.getTime() + 5 * 60_000).toISOString() } };
}
