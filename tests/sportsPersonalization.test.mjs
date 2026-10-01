import test from 'node:test';
import assert from 'node:assert/strict';
import {getCampusAthleticsProfile,getCampusProgramCatalog,getRecommendedCampusPrograms,resolveCampusGameState} from '../data/sports/campus.ts';
import {rankCampusPrograms,seasonRecord} from '../lib/sports/selection.ts';
const tamu=getCampusAthleticsProfile('tamu');
const at=date=>Date.parse(`${date}T12:00:00Z`);
const sample=(sport)=>({...tamu.programs.football,sport,record:null,schedulePublished:false,games:[]});
test('full-year dates keep January and February 2027 upcoming in fall 2026',()=>{
  for(const date of ['2027-01-10','2027-02-10'])for(const status of ['scheduled','verification_pending','live']) {
    assert.equal(resolveCampusGameState({...tamu.programs.football.games[0],date:`${date}T18:00:00Z`,status},tamu.programs.football.source,at('2026-10-01')),'scheduled');
  }
});
test('active sports rotate before school importance; favorite only overrides while active',()=>{
  const catalog=['football','basketball','baseball','golf'].map(sample);
  assert.deepEqual(rankCampusPrograms(catalog,at('2026-10-01')).map(p=>p.sport),['football','golf','basketball','baseball']);
  assert.equal(rankCampusPrograms(catalog,at('2026-10-01'),['golf'])[0].sport,'golf');
  assert.equal(rankCampusPrograms(catalog,at('2027-01-10'),['golf'])[0].sport,'football');
  assert.equal(rankCampusPrograms(catalog,at('2027-02-10'))[0].sport,'basketball');
  assert.equal(rankCampusPrograms(catalog,at('2027-05-10'))[0].sport,'baseball');
  assert.equal(rankCampusPrograms(catalog,at('2027-07-10'))[0].sport,'football');
});
test('school hierarchy differs; one or two available programs never create filler sports',()=>{
  assert.equal(getRecommendedCampusPrograms(getCampusAthleticsProfile('harvard'),at('2026-10-10'))[0].sport,'rowing');
  assert.equal(getRecommendedCampusPrograms(tamu,at('2026-10-10'))[0].sport,'football');
  for(const count of [1,2])assert.equal(getRecommendedCampusPrograms({...tamu,supportedSports:['football','basketball'].slice(0,count)},at('2026-10-01')).length,count);
  assert.ok(getCampusProgramCatalog(tamu).some(p=>p.sport==='equestrian'));
  assert.equal(getRecommendedCampusPrograms(tamu,at('2026-10-01'),['golf'])[0].sport,'golf');
});
test('records are withheld when past results are missing and non-dual sports do not invent wins',()=>{
  const base={...sample('basketball'),schedulePublished:true};
  const game={...tamu.programs.football.games[0],date:'2026-09-01T18:00:00Z'};
  assert.equal(seasonRecord({...base,games:[{...game,status:'scheduled',result:null}]},at('2026-10-01')),null);
  assert.equal(seasonRecord({...base,games:[{...game,status:'final',result:'W'}]},at('2026-10-01')),'1–0');
  assert.equal(seasonRecord({...base,games:[{...game,date:'2027-01-01T18:00:00Z',status:'scheduled',result:null}]},at('2026-10-01')),'0–0');
  assert.equal(seasonRecord({...base,sport:'golf',games:[{...game,status:'final',result:null}]},at('2026-10-01')),null);
});
