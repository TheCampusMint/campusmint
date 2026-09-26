"use client";

import { useEffect, useMemo, useState } from "react";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";

import {
  defaultSportsEntitlement,
  getAvailableCampusPrograms,
  getCampusAthleticsProfile,
  getCampusGameDetail,
  getCampusRankingBoards,
  getLiveCampusGames,
  getNextCampusGame,
  launchCampusSports,
  resolveDefaultCampusSport,
  resolveCampusGameState,
  type CampusScheduleGame,
  type CampusAthleticsProfile,
  type CampusSportProgram,
  type LaunchCampusSportId,
} from "@/data/sports";
import type { UniversityId, UniversityTheme } from "@/data/universities";

type SportsHubProps = {
  theme: UniversityTheme;
  universityId: UniversityId | null;
  initialSport?: LaunchCampusSportId | null;
  onBack?: () => void;
};

function locationLabel(game: CampusScheduleGame) {
  if (game.homeAway === "home") return "Home";
  if (game.homeAway === "away") return "Away";
  return "Neutral";
}

function ScheduleRow({ game, program, currentTime, onOpen }: { game: CampusScheduleGame; program: CampusSportProgram; currentTime: number; onOpen: () => void }) {
  const state = resolveCampusGameState(game, program.source, currentTime);
  const completed = state === "final";
  const live = state === "live";

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-[0_10px_32px_-28px_rgba(15,23,42,.6)] sm:px-4">
      <time
        dateTime={game.date}
        className="w-14 shrink-0 text-xs font-black tabular-nums text-slate-500"
      >
        {game.dateLabel}
      </time>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">
          {game.homeAway === "away" ? "at " : "vs "}{game.opponentName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {locationLabel(game)}
          {game.location ? ` · ${game.location}` : ""}
          {game.timeLabel ? ` · ${game.timeLabel}` : ""}
          {game.network ? ` · ${game.network}` : ""}
        </p>
      </div>
      {live && game.campusScore !== null && game.opponentScore !== null ? (
        <div className="shrink-0 text-right">
          <span className="block text-[9px] font-black uppercase tracking-wide text-red-600">
            Live
          </span>
          <strong className="text-sm tabular-nums text-slate-950">
            {game.campusScore}–{game.opponentScore}
          </strong>
        </div>
      ) : completed && game.campusScore !== null && game.opponentScore !== null ? (
        <div className="shrink-0 text-right">
          <span className="block text-[9px] font-black text-slate-400">Final</span>
          <strong className="text-sm tabular-nums text-slate-950">
            {game.result} {game.campusScore}–{game.opponentScore}
          </strong>
        </div>
      ) : state === "verification_pending" ? <span className="shrink-0 text-right text-[9px] font-black uppercase tracking-wide text-slate-500">Awaiting<br/>result</span> : null}
    </button>
  );
}

function SchedulePanel({ program, currentTime, onOpenGame }: { program: CampusSportProgram; currentTime: number; onOpenGame: (game: CampusScheduleGame) => void }) {
  const stale = program.source.staleAfter
    ? currentTime > new Date(program.source.staleAfter).getTime()
    : false;
  return (
    <section aria-labelledby="campus-schedule-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {program.seasonLabel}
          </p>
          <h2 id="campus-schedule-title" className="mt-1 text-xl font-black text-slate-950">
            {program.label} schedule
          </h2>
        </div>
        <span className="text-right text-[9px] font-semibold text-slate-400">
          {stale ? "Last verified" : "Updated"} {program.source.lastFetchedAt ?? program.source.verifiedAt}
          {program.record ? <><br/>{program.record}</> : null}
        </span>
      </div>

      {program.schedulePublished ? (
        <div className="mt-3 space-y-2" data-full-current-schedule>
          {program.games.map((game) => <ScheduleRow key={game.id} game={game} program={program} currentTime={currentTime} onOpen={() => onOpenGame(game)} />)}
        </div>
      ) : (
        <p className="mt-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Schedule isn&apos;t posted yet.
        </p>
      )}

      <a
        href={program.source.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex text-[11px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        Official source
      </a>
    </section>
  );
}

function GameDetail({ game, program, campusLabel, onBack }: { game: CampusScheduleGame; program: CampusSportProgram; campusLabel: string; onBack: () => void }) {
  const detail = getCampusGameDetail(game);
  const final = game.status === "final";
  return <section className="cm-content-swap space-y-5" data-game-detail>
    <MintLeafBackButton onClick={onBack} label={`Back to ${program.label}`} tone="minimal" className="text-slate-700" />
    <header className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{program.label} · {final ? "Final" : "Game detail"}</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{campusLabel} {game.homeAway === "away" ? "at" : "vs"} {game.opponentName}</h2>
      {final && game.campusScore !== null && game.opponentScore !== null && <p className="mt-2 text-xl font-black text-[var(--app-accent)]">{game.result} {game.campusScore}–{game.opponentScore}</p>}
      <p className="mt-2 text-sm text-slate-500">{game.dateLabel}{game.timeLabel ? ` · ${game.timeLabel}` : ""}{game.location ? ` · ${game.location}` : ""}{game.network ? ` · ${game.network}` : ""}</p>
    </header>
    {!final ? <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><h3 className="font-black text-slate-950">Upcoming game</h3><p className="mt-2 text-sm leading-6 text-slate-500">Participant statistics will appear only after a verified game source reports them. Campus Mint does not infer starters or participants.</p></div> : detail ? <>
      <p className="text-xs font-semibold text-slate-500">{detail.scopeLabel}</p>
      {detail.statGroups.map((group) => <section key={group.id} aria-labelledby={`game-stat-${group.id}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
        <h3 id={`game-stat-${group.id}`} className="text-xs font-black uppercase tracking-[.16em] text-slate-500">{group.label}</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] border-collapse text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4 font-black">Player</th>{group.columns.map((column) => <th key={column} className="pb-2 px-2 text-right font-black">{column}</th>)}</tr></thead><tbody>{group.rows.map((row) => <tr key={row.playerId} className="border-b border-slate-100 last:border-0"><th className="py-3 pr-4 font-bold text-slate-800">{row.playerName}<span className="block text-[9px] font-medium text-slate-400">{row.teamName}</span></th>{row.values.map((value, index) => <td key={`${row.playerId}:${group.columns[index]}`} className="px-2 py-3 text-right font-semibold tabular-nums text-slate-600">{value}</td>)}</tr>)}</tbody></table></div>
      </section>)}
      <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs font-bold text-[var(--app-accent)] underline underline-offset-4">Official game source</a>
    </> : <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><h3 className="font-black text-slate-950">Participation details unavailable</h3><p className="mt-2 text-sm leading-6 text-slate-500">The result is verified, but no normalized participation source is available. No players have been inferred.</p></div>}
  </section>;
}

export function SportsHub({ theme, universityId, initialSport = null, onBack }: SportsHubProps) {
  const profile = useMemo(
    () => getCampusAthleticsProfile(universityId),
    [universityId],
  );
  const [remoteProfile, setRemoteProfile] = useState<CampusAthleticsProfile | null>(null);
  const resolvedProfile = remoteProfile?.universityId === universityId ? remoteProfile : profile;
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const defaultSport = resolvedProfile
    ? resolveDefaultCampusSport(resolvedProfile, currentTime)
    : null;
  const [activeSport, setActiveSport] = useState<LaunchCampusSportId | null>(
    defaultSport,
  );
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!universityId) return;
    let active = true;
    fetch(`/api/sports?universityId=${encodeURIComponent(universityId)}`, { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { ok?: boolean; profile?: CampusAthleticsProfile | null } }))
      .then(({ response, payload }) => {
        if (active && response.ok && payload.ok && payload.profile?.universityId === universityId) setRemoteProfile(payload.profile);
      })
      .catch(() => null);
    return () => { active = false; };
  }, [universityId]);

  useEffect(() => {
    if (!resolvedProfile) return;
    const storageKey = `campusmint:sports:${resolvedProfile.universityId}:sport:v1`;
    const stored = window.localStorage.getItem(storageKey) as LaunchCampusSportId | null;
    const available = getAvailableCampusPrograms(resolvedProfile).map((program) => program.sport);
    const next = initialSport && available.includes(initialSport)
      ? initialSport
      : stored && available.includes(stored)
        ? stored
        : defaultSport;
    // University identity is an external boundary for this local preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSport(next);
  }, [defaultSport, initialSport, resolvedProfile]);

  if (!resolvedProfile) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-7 text-center shadow-sm" data-sports-hub>
        <h1 className="text-xl font-black text-slate-950">Campus Sports</h1>
        <p className="mt-2 text-sm text-slate-500">
          Athletics data isn&apos;t available for this university yet.
        </p>
      </section>
    );
  }

  const programs = getAvailableCampusPrograms(resolvedProfile);
  const selectedProgram =
    programs.find((program) => program.sport === activeSport) ?? programs[0] ?? null;
  const liveGames = getLiveCampusGames(resolvedProfile, currentTime);
  const nextGame = getNextCampusGame(resolvedProfile, currentTime);
  const rankingBoards = selectedProgram
    ? getCampusRankingBoards(resolvedProfile, selectedProgram.sport)
    : [];
  const selectedGame = selectedProgram?.games.find((game) => game.id === selectedGameId) ?? null;

  function selectSport(sport: LaunchCampusSportId) {
    setActiveSport(sport);
    setSelectedGameId(null);
    window.localStorage.setItem(
      `campusmint:sports:${resolvedProfile!.universityId}:sport:v1`,
      sport,
    );
  }

  return (
    <section
      className="space-y-5 rounded-[1.75rem] border border-slate-200/80 bg-slate-50/75 p-4 shadow-[0_22px_64px_-48px_rgba(15,23,42,.55)] sm:p-6"
      data-sports-hub
      data-natural-content-height="true"
      data-university-id={resolvedProfile.universityId}
    >
      <header className="flex items-center gap-3">
        {onBack && <MintLeafBackButton onClick={onBack} label="Back" aria-label="Back" tone="minimal" className="shrink-0 text-slate-800" />}
        <span
          className="h-11 w-1.5 rounded-full"
          style={{ backgroundColor: theme.primary }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {resolvedProfile.divisionLabel} · {resolvedProfile.conferenceLabel}
          </p>
          <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">
            {resolvedProfile.universityName}
          </h1>
          <p className="text-sm font-bold" style={{ color: theme.primary }}>
            {resolvedProfile.nickname}
          </p>
        </div>
      </header>

      <section
        className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_12px_38px_-30px_rgba(15,23,42,.7)]"
        aria-labelledby="live-games-title"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="live-games-title" className="text-sm font-black text-slate-950">
            Live / Current
          </h2>
          {liveGames.length > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-red-600">
              Live
            </span>
          )}
        </div>
        {liveGames.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {liveGames.map((game) => (
              <button type="button" key={game.id} onClick={() => { selectSport(game.sport); setSelectedGameId(game.id); }} className="min-w-56 rounded-2xl bg-slate-950 p-3 text-left text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
                <p className="text-[9px] font-black uppercase tracking-wide text-white/55">
                  {launchCampusSports.find((sport) => sport.id === game.sport)?.label}
                </p>
                <p className="mt-1 font-black">{game.opponentName}</p>
                <p className="mt-1 text-xs text-white/70">{game.liveDetail}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">No games live right now</p>
            {nextGame && (
              <p className="text-xs font-semibold text-slate-400">
                Next: {launchCampusSports.find((sport) => sport.id === nextGame.sport)?.label} · {nextGame.opponentName} · {nextGame.dateLabel}
              </p>
            )}
          </div>
        )}
      </section>

      {programs.length > 0 ? (
        <>
          <div className="flex justify-center">
            <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1" aria-label="Campus sports">
              {programs.map((program) => {
                const active = selectedProgram?.sport === program.sport;
                return (
                  <button
                    key={program.sport}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectSport(program.sport)}
                    className="shrink-0 rounded-full px-3.5 py-2 text-xs font-black"
                    style={
                      active
                        ? { backgroundColor: theme.primary, color: theme.secondary }
                        : { color: "var(--app-text-secondary)" }
                    }
                  >
                    {launchCampusSports.find((sport) => sport.id === program.sport)?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedProgram && !selectedGame && (
            <div key={selectedProgram.sport} className="cm-content-swap">
              <SchedulePanel program={selectedProgram} currentTime={currentTime} onOpenGame={(game) => setSelectedGameId(game.id)} />
            </div>
          )}

          {selectedProgram && selectedGame && <GameDetail game={selectedGame} program={selectedProgram} campusLabel={resolvedProfile.universityName} onBack={() => setSelectedGameId(null)} />}

          {!selectedGame && rankingBoards.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2" aria-label="Relevant rankings">
              {rankingBoards.map((board) => (
                <section key={board.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-black text-slate-950">{board.title}</h2>
                  <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                    {board.entries.map((entry) => (
                      <div
                        key={`${board.id}:${entry.teamId}`}
                        className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm ${
                          entry.teamId === "texas-am" ? "bg-[var(--app-accent-soft)]" : ""
                        }`}
                      >
                        <span className="w-5 text-right text-xs font-black tabular-nums text-slate-400">
                          {entry.rank}
                        </span>
                        <span className="font-semibold text-slate-700">{entry.teamName}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">Verified schedules and results aren&apos;t available from a connected provider yet.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Configured featured sports">
            {resolvedProfile.featuredSports.map((sportId) => <span key={sportId} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700">{launchCampusSports.find((sport) => sport.id === sportId)?.label ?? sportId}</span>)}
          </div>
          <a href={resolvedProfile.featuredSportsSource.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold text-[var(--app-accent)] underline underline-offset-4">Official athletics source</a>
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-950">Sports Plus</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Deeper campus-team context when verified providers are connected.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600">
          {defaultSportsEntitlement.sportsPlus ? "Active" : "Coming Soon"}
        </span>
      </section>
    </section>
  );
}
