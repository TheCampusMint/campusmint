import type { CampusScheduleGame, CampusSportProgram } from "../../data/sports/campus.ts";

export const FOOTBALL_REFRESH_INTERVAL_MS = 5 * 60_000;
export const officialFootballUrl = (season: string) => `https://12thman.com/sports/football/schedule/season/${season}`;

function plainText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function classText(html: string, className: string) {
  const match = html.match(new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*class=["']${className}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i"));
  return match ? plainText(match[2]) : "";
}

/** Parses only explicit official results. A past kickoff alone never creates a score. */
export function parseOfficialFootballSchedule(html: string, season: string, now = new Date()): CampusScheduleGame[] {
  if (!/^\d{4}$/.test(season) || classText(html, "schedule-hero__title") !== `${season} Football Schedule`) {
    throw new Error("The official football schedule season could not be verified.");
  }
  const chunks = [...html.matchAll(/name=["']scheduleBeforeScheduledEvent(\d+)["']([\s\S]*?)name=["']scheduleAfterScheduledEvent\1["']/g)];
  if (!chunks.length) throw new Error("The official football schedule format was not recognized.");
  const games = chunks.map(([, , chunk]): CampusScheduleGame => {
    const date = chunk.match(/<time\b[^>]*datetime=["']([^"']+)["']/)?.[1];
    const opponentName = classText(chunk, "schedule-event-default__name").replace(/^\(#?\d+\)\s*/, "");
    const dateLabel = classText(chunk, "schedule-event-date__day");
    const resultText = classText(chunk, "schedule-event-item-result__label");
    const resultMatch = resultText.match(/^([WLT]),?\s*(?:Win|Loss|Tie)?\s*(\d+)\s*[-–]\s*(\d+)(?:\s.*)?$/i);
    const sourceGameId = chunk.match(/entity-id=["'](\d+)["']\s+entity-name=["']schedule-events["']/)?.[1];
    if (!date || !date.startsWith(`${season}-`) || !Number.isFinite(Date.parse(date)) || !opponentName || !dateLabel || !sourceGameId || (resultText && !resultMatch)) {
      throw new Error("An official football game could not be verified.");
    }
    const result = resultMatch ? resultMatch[1].toUpperCase() as "W" | "L" | "T" : null;
    const campusScore = resultMatch ? Number(resultMatch[2]) : null;
    const opponentScore = resultMatch ? Number(resultMatch[3]) : null;
    if (result && (result === "W" ? campusScore! <= opponentScore! : result === "L" ? campusScore! >= opponentScore! : campusScore !== opponentScore)) {
      throw new Error("The official result and score disagree.");
    }
    const timeLabel = classText(chunk, "schedule-event-date__clock") || null;
    const venue = classText(chunk, "schedule-event-default__venue") || null;
    const boxScorePath = chunk.match(/href=["']([^"']+)["'][^>]*class=["'][^"']*schedule-event-box-score-link/)?.[1];
    const networkLink = [...chunk.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) => plainText(match[1]).replace(/ Opens in a new window$/, "")).find((label) => /^(?:ABC|ESPN\d?|ESPN\+|SEC Network\+?|SECN\+?|CBS|FOX|FS\d)$/.test(label));
    return {
      id: `tamu-fb-${sourceGameId}`, sourceGameId, sport: "football", opponentName, date, dateLabel, timeLabel,
      homeAway: /schedule-event-date--venue-away/.test(chunk) ? "away" : /schedule-event-date--venue-neutral/.test(chunk) ? "neutral" : "home",
      location: venue, network: networkLink ?? null, status: result ? "final" : Date.parse(date) + 6 * 60 * 60_000 < now.getTime() ? "verification_pending" : "scheduled",
      campusScore, opponentScore, result, liveDetail: null, scheduleSourceUrl: officialFootballUrl(season),
      boxScoreSourceUrl: boxScorePath ? new URL(boxScorePath, "https://12thman.com").href : null, lastUpdated: now.toISOString(),
    };
  });
  if (new Set(games.map((game) => game.sourceGameId)).size !== games.length) throw new Error("The official schedule contains duplicate games.");
  return games;
}

export function updateOfficialFootballProgram(previous: CampusSportProgram, games: CampusScheduleGame[], season: string, now = new Date()): CampusSportProgram {
  const matches = (a: CampusScheduleGame, b: CampusScheduleGame) => a.date.slice(0, 4) === b.date.slice(0, 4) && (
    Boolean(a.sourceGameId && a.sourceGameId === b.sourceGameId) || a.opponentName.toLowerCase() === b.opponentName.toLowerCase()
  );
  if (previous.seasonLabel === season && previous.games.some((game) => !games.some((incoming) => matches(game, incoming)))) {
    throw new Error("The official football schedule is incomplete; keeping the previous snapshot.");
  }
  const merged = games.map((game) => {
    const old = previous.games.find((entry) => matches(entry, game));
    if (old?.status === "final" && game.status !== "final") throw new Error("The official source is missing a previously verified result.");
    return { ...game, id: old?.id ?? game.id, detail: old?.detail ?? null, network: game.network ?? old?.network ?? null };
  });
  const wins = merged.filter((game) => game.result === "W").length;
  const losses = merged.filter((game) => game.result === "L").length;
  const ties = merged.filter((game) => game.result === "T").length;
  return {
    ...previous, seasonLabel: season, seasonStart: `${season}-08-01`, seasonEnd: `${Number(season) + 1}-02-01`, schedulePublished: true,
    games: merged, record: `${wins}–${losses}${ties ? `–${ties}` : ""}`,
    source: { sourceName: `Texas A&M Athletics · ${season} football schedule`, sourceUrl: officialFootballUrl(season), season,
      verifiedAt: now.toISOString(), lastFetchedAt: now.toISOString(), staleAfter: new Date(now.getTime() + FOOTBALL_REFRESH_INTERVAL_MS).toISOString() },
  };
}
