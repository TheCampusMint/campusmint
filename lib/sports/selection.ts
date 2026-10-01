import type { CampusSportProgram, LaunchCampusSportId } from '../../data/sports/campus.ts';

// Fallback competition windows, not evidence that any particular game is live.
const months: Record<LaunchCampusSportId, readonly number[]> = {
  football: [8,9,10,11,12,1], basketball: [11,12,1,2,3,4], baseball: [2,3,4,5,6],
  soccer: [8,9,10,11,12], volleyball: [8,9,10,11,12], softball: [2,3,4,5,6],
  gymnastics: [1,2,3,4], track: [1,2,3,4,5,6], hockey: [10,11,12,1,2,3,4],
  rowing: [9,10,11,3,4,5,6], golf: [9,10,11,2,3,4,5,6], equestrian: [9,10,11,1,2,3,4],
  lacrosse: [2,3,4,5], tennis: [1,2,3,4,5],
};

export function isProgramInSeason(program: CampusSportProgram, now: number) {
  if (program.schedulePublished && program.games.length) {
    const start = Date.parse(program.seasonStart);
    const end = Date.parse(program.seasonEnd.slice(0,10) + 'T23:59:59Z');
    if (Number.isFinite(start) && Number.isFinite(end)) return now >= start && now <= end;
  }
  return months[program.sport].includes(new Date(now).getUTCMonth() + 1);
}

export function rankCampusPrograms(programs: CampusSportProgram[], now: number, favorites: readonly string[] = []) {
  return programs.map((program, importance) => ({program, importance, active:isProgramInSeason(program,now)}))
    .sort((a,b) => Number(b.active)-Number(a.active)
      || Number(b.active && favorites.includes(b.program.sport))-Number(a.active && favorites.includes(a.program.sport))
      || a.importance-b.importance).map(row=>row.program);
}

export function seasonRecord(program: CampusSportProgram, now = Date.now()) {
  // Never present a partial results feed as a complete season record.
  if (program.games.some(game => game.status !== 'final' && Date.parse(game.date) <= now)) return null;
  if (program.record && /^\d+\s*[-–]\s*\d+(?:\s*[-–]\s*\d+)?$/.test(program.record.trim())) return program.record;
  if (!program.schedulePublished || !program.games.length) return null;
  // A partial results feed cannot establish the team's full record.
  if (program.games.some(game=>game.status==='verification_pending')) return null;
  const results=program.games.filter(game=>game.status==='final' && game.result && !/exhibition|scrimmage/i.test(game.opponentName));
  if (!results.length && ['golf','track','rowing'].includes(program.sport)) return null;
  const count=(result:string)=>results.filter(game=>game.result===result).length;
  return `${count('W')}–${count('L')}${count('T') ? `–${count('T')}` : ''}`;
}
