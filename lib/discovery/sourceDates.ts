import { zonedDateTimeToIso } from "../content/eventTiming.ts";
/** This source labels local wall-clock times with Z. Correct only when its
 * visible event time confirms the same wall clock, not for arbitrary feeds. */
export function bryanDates(start:string,end:string|undefined,visibleDetail:string) {
  const clock=visibleDetail.match(/(?:<br\s*\/?\s*>|\n)\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if(!clock || !start.endsWith("Z")) return {startsAt:start,endsAt:end};
  const hour=Number(clock[1])%12+(clock[3].toUpperCase()==="PM"?12:0);
  if(start.slice(11,16)!==`${String(hour).padStart(2,"0")}:${clock[2]}`) return {startsAt:start,endsAt:end};
  const convert=(value:string)=>zonedDateTimeToIso(value.slice(0,10),value.slice(11,16),"America/Chicago") ?? value;
  return {startsAt:convert(start),endsAt:end ? convert(end):undefined};
}
