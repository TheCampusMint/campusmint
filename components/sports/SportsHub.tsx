"use client";

import { useMemo, useReducer, useState } from "react";

import { TeamMark } from "@/components/sports/TeamMark";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import {
  AP_POLL_SOURCE,
  apPreseasonPoll,
  baseballSeasons,
  basketballSeasons,
  campusSports,
  footballConferenceOptions,
  getBaseballSeason,
  getBasketballSeason,
  getFeaturedFootballTeamId,
  getFootballConference,
  getFootballSeason,
  getSoccerSeason,
  getSportsTeam,
  getTrackProgram,
  soccerSeasons,
  trackPrograms,
  type CampusSportId,
  type SportsGame,
  type SportsSeason,
  type SportsTeamIdentity,
  type TrackProgram,
} from "@/data/sports";
import type { UniversityId, UniversityTheme } from "@/data/universities";
import {
  initialSportsNavigationState,
  sportsNavigationReducer,
} from "@/lib/sports/navigation";

type SportsHubProps = {
  theme: UniversityTheme;
  universityId: UniversityId | null;
};

type FootballView = (typeof footballConferenceOptions)[number]["id"];

function FootballFieldBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-football-field
    >
      <div className="absolute inset-0 bg-[#07563b]" />
      <div className="absolute inset-0 opacity-95 [background-image:repeating-linear-gradient(to_bottom,transparent_0px,transparent_92px,rgba(255,255,255,.27)_93px,rgba(255,255,255,.27)_95px,transparent_96px),repeating-linear-gradient(to_right,rgba(255,255,255,.018)_0%,rgba(255,255,255,.018)_10%,rgba(0,0,0,.045)_10%,rgba(0,0,0,.045)_20%)]" />
      <div className="absolute inset-y-0 left-[5%] w-px bg-white/38" />
      <div className="absolute inset-y-0 right-[5%] w-px bg-white/38" />
      <div className="absolute inset-y-0 left-[35%] w-5 opacity-45 [background-image:repeating-linear-gradient(to_bottom,transparent_0px,transparent_42px,rgba(255,255,255,.7)_43px,rgba(255,255,255,.7)_47px,transparent_48px,transparent_95px)]" />
      <div className="absolute inset-y-0 right-[35%] w-5 opacity-45 [background-image:repeating-linear-gradient(to_bottom,transparent_0px,transparent_42px,rgba(255,255,255,.7)_43px,rgba(255,255,255,.7)_47px,transparent_48px,transparent_95px)]" />
      <div className="absolute inset-x-[5%] top-0 h-9 border-b border-white/30 bg-emerald-950/30" />
      <div className="absolute inset-x-[5%] bottom-0 h-9 border-t border-white/30 bg-emerald-950/30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(105,255,180,.18),transparent_31%),linear-gradient(90deg,rgba(0,15,10,.5),transparent_16%,transparent_84%,rgba(0,15,10,.5)),linear-gradient(180deg,rgba(0,20,13,.08),rgba(0,20,13,.43))]" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,rgba(255,255,255,.16)_0_1px,transparent_1.5px),radial-gradient(circle_at_70%_62%,rgba(0,0,0,.22)_0_1px,transparent_1.5px)] [background-size:7px_7px,9px_9px]" />
    </div>
  );
}

function locationLabel(game: SportsGame) {
  if (game.homeAway === "home") return "Home";
  if (game.homeAway === "away") return "Away";
  return "Neutral";
}

function TeamRow({
  team,
  theme,
  rank,
  onSelect,
}: {
  team: SportsTeamIdentity;
  theme: UniversityTheme;
  rank?: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="interactive-pop flex w-full items-center gap-3 rounded-[1.25rem] border border-white/18 bg-emerald-950/55 p-3 text-left text-white shadow-sm backdrop-blur-md transition hover:bg-emerald-950/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <TeamMark team={team} theme={theme} />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-black">{team.name}</strong>
        <span className="mt-0.5 block text-xs text-emerald-50/70">
          {getFootballConference(team.footballConferenceId ?? "")?.label ?? "College football"}
        </span>
      </span>
      {rank !== undefined ? (
        <span className="min-w-5 text-center text-xs font-bold tabular-nums text-white/62" data-ap-rank>
          {rank}
        </span>
      ) : null}
      <span className="text-lg text-white/55" aria-hidden="true">›</span>
    </button>
  );
}

function GameRow({
  game,
  theme,
  onOpponent,
}: {
  game: SportsGame;
  theme: UniversityTheme;
  onOpponent?: (teamId: string) => void;
}) {
  const opponent = getSportsTeam(game.opponentId);
  if (!opponent) return null;

  const result = game.result;
  const status = game.status === "verification_pending"
    ? "Result awaiting official verification"
    : game.status === "scheduled"
      ? game.timeLabel ?? "Time TBA"
      : "Final";

  return (
    <button
      type="button"
      onClick={() => onOpponent?.(opponent.id)}
      disabled={!onOpponent}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-black/24 p-3 text-left text-white disabled:cursor-default sm:p-4"
    >
      <TeamMark team={opponent} theme={theme} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="cm-eyebrow block text-emerald-100/65">
          {locationLabel(game)} · {game.dateLabel}
        </span>
        <strong className="mt-1 block truncate text-sm font-black">
          {game.homeAway === "away" ? "at " : "vs "}{opponent.shortName}
        </strong>
        <span className="mt-1 block text-[11px] text-white/62">
          {game.venue ? `${game.venue} · ` : ""}{status}
        </span>
        {game.scoringHighlight ? (
          <span className="mt-1.5 block text-[11px] leading-4 text-emerald-100/75">
            {game.scoringHighlight}
          </span>
        ) : null}
      </span>
      {result ? (
        <span className="shrink-0 text-right">
          <span className={`block text-xs font-black ${result.outcome === "W" ? "text-emerald-300" : result.outcome === "L" ? "text-rose-300" : "text-white"}`}>
            {result.outcome}
          </span>
          <span className="mt-0.5 block text-sm font-black tabular-nums">
            {result.teamScore}–{result.opponentScore}
          </span>
        </span>
      ) : null}
      {onOpponent ? <span aria-hidden="true" className="text-white/45">›</span> : null}
    </button>
  );
}

function SeasonPanel({
  season,
  theme,
  onOpponent,
}: {
  season: SportsSeason;
  theme: UniversityTheme;
  onOpponent?: (teamId: string) => void;
}) {
  const team = getSportsTeam(season.teamId);
  if (!team) return null;

  return (
    <section
      className="rounded-[1.75rem] border border-white/18 bg-emerald-950/58 p-4 shadow-xl backdrop-blur-lg sm:p-6"
      data-season-panel
    >
      <div className="flex items-center gap-4">
        <TeamMark team={team} theme={theme} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="cm-eyebrow text-emerald-200">
            {season.conferenceLabel ?? "Verified program"}{season.disciplineLabel ? ` · ${season.disciplineLabel}` : ""}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-balance sm:text-3xl">{team.name}</h2>
          <p className="mt-1 text-xs font-semibold text-emerald-50/68">
            {season.label}{season.record ? ` · ${season.record}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {season.games.length ? season.games.map((game) => (
          <GameRow key={game.id} game={game} theme={theme} onOpponent={onOpponent} />
        )) : (
          <p className="rounded-2xl border border-dashed border-white/18 bg-black/18 p-5 text-sm leading-6 text-emerald-50/72">
            No verified local schedule entries are available for this program. Campus Mint does not fill gaps with placeholder matchups.
          </p>
        )}
      </div>
      <a href={season.source.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[11px] font-bold text-emerald-100 underline decoration-emerald-300/40 underline-offset-4">
        Official source
      </a>
    </section>
  );
}

function ProgramChooser({
  seasons,
  selectedTeamId,
  onSelect,
}: {
  seasons: readonly SportsSeason[];
  selectedTeamId: string;
  onSelect: (teamId: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Verified programs">
      {seasons.map((season) => {
        const team = getSportsTeam(season.teamId);
        if (!team) return null;
        const active = selectedTeamId === team.id;
        return (
          <button key={season.id} type="button" aria-pressed={active} onClick={() => onSelect(team.id)} className={`cm-pill-control shrink-0 border px-3 ${active ? "border-white bg-white text-emerald-950" : "border-white/20 bg-emerald-950/45 text-white/85"}`}>
            {team.shortName}
          </button>
        );
      })}
    </div>
  );
}

function TrackPanel({ program, theme }: { program: TrackProgram | null; theme: UniversityTheme }) {
  if (!program) {
    return (
      <section className="rounded-[1.75rem] border border-white/18 bg-emerald-950/58 p-7 text-center backdrop-blur-lg">
        <p className="cm-eyebrow text-emerald-200">Participation check</p>
        <h2 className="mt-2 text-2xl font-black">No verified track program</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-emerald-50/72">
          This campus is not represented in the verified track dataset. Cross country is not being mislabeled as track.
        </p>
      </section>
    );
  }

  const team = getSportsTeam(program.teamId);
  if (!team) return null;

  return (
    <section className="rounded-[1.75rem] border border-white/18 bg-emerald-950/58 p-4 backdrop-blur-lg sm:p-6">
      <div className="flex items-center gap-4">
        <TeamMark team={team} theme={theme} size="lg" />
        <div>
          <p className="cm-eyebrow text-emerald-200">{program.season}</p>
          <h2 className="mt-1 text-2xl font-black">{team.name}</h2>
          <p className="mt-1 text-xs text-white/65">{program.label}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {program.meets.length ? program.meets.map((meet) => (
          <article key={meet.id} className="rounded-2xl border border-white/12 bg-black/22 p-4">
            <p className="cm-eyebrow text-emerald-200/75">{meet.status} · {meet.dateLabel}</p>
            <h3 className="mt-2 font-black">{meet.name}</h3>
            <p className="mt-1 text-xs text-white/62">{meet.location}</p>
            {meet.resultNote ? <p className="mt-2 text-xs text-emerald-100/72">{meet.resultNote}</p> : null}
          </article>
        )) : (
          <p className="rounded-2xl border border-dashed border-white/18 p-5 text-sm text-white/70 sm:col-span-2">
            The program is verified, but meet results have not been seeded locally.
          </p>
        )}
      </div>
      <a href={program.source.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[11px] font-bold text-emerald-100 underline underline-offset-4">
        Official source
      </a>
    </section>
  );
}

export function SportsHub({ theme, universityId }: SportsHubProps) {
  const [activeSport, setActiveSport] = useState<CampusSportId>("football");
  const [footballView, setFootballView] = useState<FootballView>("ap-poll");
  const [navigation, dispatch] = useReducer(sportsNavigationReducer, initialSportsNavigationState);
  const [programOverrides, setProgramOverrides] = useState<Partial<Record<"basketball" | "baseball" | "soccer" | "track", string>>>({});
  const defaultSeasons = useMemo(() => ({
    basketball: getBasketballSeason(universityId),
    baseball: getBaseballSeason(universityId),
    soccer: getSoccerSeason(universityId),
  }), [universityId]);

  const featuredTeamId = getFeaturedFootballTeamId(universityId);
  const featuredTeam = featuredTeamId ? getSportsTeam(featuredTeamId) : null;
  const featuredSeason = featuredTeamId ? getFootballSeason(featuredTeamId) : null;
  const selectedFootballTeam = navigation.selectedTeamId ? getSportsTeam(navigation.selectedTeamId) : null;
  const selectedFootballSeason = navigation.selectedTeamId ? getFootballSeason(navigation.selectedTeamId) : null;
  const conference = footballView === "ap-poll" ? null : getFootballConference(footballView);
  const visibleFootballTeams = footballView === "ap-poll"
    ? apPreseasonPoll.flatMap(({ rank, teamId }) => {
        const team = getSportsTeam(teamId);
        return team ? [{ team, rank }] : [];
      })
    : (conference?.teamIds ?? []).flatMap((teamId) => {
        const team = getSportsTeam(teamId);
        return team ? [{ team, rank: undefined }] : [];
      });
  const activeLabel = campusSports.find((sport) => sport.id === activeSport)?.label;

  function selectSport(sport: CampusSportId) {
    setActiveSport(sport);
    dispatch({ type: "reset" });
  }

  function selectTeam(teamId: string) {
    dispatch({ type: "select-team", teamId });
  }

  let nonFootballContent = null;
  if (activeSport === "basketball" || activeSport === "baseball" || activeSport === "soccer") {
    const collection = activeSport === "basketball"
      ? basketballSeasons
      : activeSport === "baseball"
        ? baseballSeasons
        : soccerSeasons;
    const defaultSeason = defaultSeasons[activeSport];
    const selectedId = programOverrides[activeSport] ?? defaultSeason.teamId;
    const season = collection.find((entry) => entry.teamId === selectedId) ?? defaultSeason;
    nonFootballContent = (
      <div className="mt-7">
        <ProgramChooser
          seasons={collection}
          selectedTeamId={season.teamId}
          onSelect={(teamId) => setProgramOverrides((current) => ({ ...current, [activeSport]: teamId }))}
        />
        <SeasonPanel season={season} theme={theme} />
      </div>
    );
  } else if (activeSport === "track") {
    const defaultProgram = getTrackProgram(universityId);
    const selectedId = programOverrides.track ?? defaultProgram?.teamId ?? "";
    const program = trackPrograms.find((entry) => entry.teamId === selectedId) ?? defaultProgram;
    nonFootballContent = (
      <div className="mt-7">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {trackPrograms.map((entry) => {
            const team = getSportsTeam(entry.teamId);
            if (!team) return null;
            return (
              <button key={entry.id} type="button" aria-pressed={program?.teamId === entry.teamId} onClick={() => setProgramOverrides((current) => ({ ...current, track: entry.teamId }))} className={`cm-pill-control shrink-0 border px-3 ${program?.teamId === entry.teamId ? "border-white bg-white text-emerald-950" : "border-white/20 bg-emerald-950/45 text-white/85"}`}>
                {team.shortName}
              </button>
            );
          })}
        </div>
        <TrackPanel program={program ?? null} theme={theme} />
      </div>
    );
  }

  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] border border-emerald-100/25 p-4 text-white shadow-[0_24px_80px_rgba(4,80,46,0.3)] sm:p-7"
      data-sports-hub
      data-natural-content-height="true"
    >
      {activeSport === "football" ? (
        <FootballFieldBackdrop />
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_80%_0%,rgba(65,195,142,.24),transparent_34%),linear-gradient(145deg,#063c2b,#071f19)]" aria-hidden="true" />
      )}

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="cm-eyebrow inline-flex rounded-full border border-emerald-100/30 bg-emerald-950/50 px-3 py-1 text-emerald-50 backdrop-blur-md">Campus sports</span>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-balance sm:text-6xl">{activeLabel}</h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-emerald-50/78 sm:text-sm">Verified schedules and results, kept intentionally compact.</p>
            {process.env.NODE_ENV === "development" ? <p className="mt-1 text-[10px] font-semibold text-emerald-100/55">Sports data checked Aug 25, 2026</p> : null}
          </div>

          {activeSport === "football" && featuredTeam && featuredSeason ? (
            <div className="relative w-full sm:w-auto">
              <button
                type="button"
                aria-expanded={navigation.scheduleOpen}
                aria-controls="featured-campus-schedule"
                onClick={() => dispatch({ type: "toggle-schedule" })}
                className="interactive-pop flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-white/30 px-4 py-3 text-left shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-w-72"
                style={{ backgroundColor: theme.primary, color: theme.secondary }}
              >
                <span>
                  <span className="cm-eyebrow block opacity-70">Your campus</span>
                  <strong className="mt-0.5 block text-sm font-black">{featuredTeam.name}</strong>
                  <span className="mt-0.5 block text-[11px] font-bold opacity-70">{featuredSeason.label}</span>
                </span>
                <span className="text-xl" aria-hidden="true">{navigation.scheduleOpen ? "⌃" : "⌄"}</span>
              </button>

              {navigation.scheduleOpen ? (
                <div id="featured-campus-schedule" className="absolute inset-x-0 top-[calc(100%+0.7rem)] z-30 max-h-[68dvh] overflow-y-auto rounded-[1.5rem] border border-white/40 bg-emerald-950/96 p-3 shadow-[0_22px_70px_rgba(0,0,0,.38)] backdrop-blur-xl sm:left-auto sm:right-0 sm:w-[25rem]">
                  <div className="sticky -top-3 z-10 mb-2 flex items-center justify-between bg-emerald-950/96 px-1 pb-2 pt-1">
                    <div>
                      <p className="cm-eyebrow text-emerald-200">{featuredSeason.label}</p>
                      <p className="mt-0.5 text-[11px] text-white/65">{featuredSeason.games.length} verified fixtures</p>
                    </div>
                    <button type="button" onClick={() => dispatch({ type: "close-schedule" })} aria-label="Close" title="Close" className="cm-icon-control flex items-center justify-center bg-white/10 text-lg">×</button>
                  </div>
                  <div className="space-y-2">
                    {featuredSeason.games.map((game) => {
                      const opponent = getSportsTeam(game.opponentId);
                      if (!opponent) return null;
                      const style = game.homeAway === "home"
                        ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.secondary }
                        : game.homeAway === "away"
                          ? { backgroundColor: "#ffffff", borderColor: "rgba(255,255,255,.8)", color: "#0f172a" }
                          : { backgroundColor: "#cbd5e1", borderColor: "#e2e8f0", color: "#0f172a" };
                      return (
                        <button key={game.id} type="button" onClick={() => selectTeam(opponent.id)} className="interactive-pop flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm" style={style}>
                          <TeamMark team={opponent} theme={theme} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="cm-eyebrow block opacity-60">{locationLabel(game)}</span>
                            <strong className="mt-1 block truncate text-sm font-black">{game.homeAway === "away" ? "at" : "vs"} {opponent.shortName}</strong>
                            <span className="mt-0.5 block text-[11px] font-semibold opacity-70">{game.dateLabel} · {game.status === "verification_pending" ? "Result pending verification" : game.timeLabel ?? "TBA"}</span>
                          </span>
                          <span aria-hidden="true">›</span>
                        </button>
                      );
                    })}
                  </div>
                  <a href={featuredSeason.source.sourceUrl} target="_blank" rel="noreferrer" className="block px-2 py-3 text-center text-[11px] font-bold text-emerald-100 underline underline-offset-4">Official schedule source</a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Sports">
          {campusSports.map((sport) => {
            const active = activeSport === sport.id;
            return (
              <button key={sport.id} type="button" aria-pressed={active} onClick={() => selectSport(sport.id)} className="cm-pill-control interactive-pop shrink-0 border px-3.5 shadow-sm backdrop-blur-md" style={active ? { backgroundColor: "#ffffff", borderColor: "#ffffff", color: "#064e3b" } : { backgroundColor: "rgba(3,45,31,.54)", borderColor: "rgba(255,255,255,.24)", color: "rgba(255,255,255,.88)" }}>
                {sport.label}
              </button>
            );
          })}
        </div>

        {activeSport === "football" ? (
          selectedFootballTeam && selectedFootballSeason ? (
            <div className="mt-7">
              <MintLeafBackButton onClick={() => dispatch({ type: "back" })} aria-label="Back" title="Back" tone="inverse" />
              <div className="mt-4">
                <SeasonPanel season={selectedFootballSeason} theme={theme} onOpponent={selectTeam} />
              </div>
            </div>
          ) : (
            <div className="mt-7">
              <div className="flex gap-1.5 overflow-x-auto pb-2" aria-label="Football conferences">
                {footballConferenceOptions.map((option) => (
                  <button key={option.id} type="button" aria-pressed={footballView === option.id} onClick={() => setFootballView(option.id)} className={`cm-pill-control shrink-0 border px-3 text-[11px] backdrop-blur-md ${footballView === option.id ? "border-white bg-white text-emerald-950" : "border-white/20 bg-emerald-950/52 text-white/85"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] font-semibold text-emerald-50/65">
                {footballView === "ap-poll" ? "2026 preseason AP Poll" : `${conference?.longName} · ${conference?.teamIds.length} football members`}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visibleFootballTeams.map(({ team, rank }) => (
                  <TeamRow key={team.id} team={team} rank={rank} theme={theme} onSelect={() => selectTeam(team.id)} />
                ))}
              </div>
              <a href={(conference?.source ?? AP_POLL_SOURCE).sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[11px] font-bold text-emerald-100 underline decoration-emerald-300/40 underline-offset-4">Verified source</a>
            </div>
          )
        ) : nonFootballContent}
      </div>
    </section>
  );
}
