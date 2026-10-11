/** The four printed dying skulls represent a single Pathfinder Dying value
 * (0–4). Keep the original numeric sheet key for old characters and exports.
 */
export const DYING_SKULL_COUNT=4;
export function readDyingSkulls(value:unknown):number {
  const raw=String(value??'').trim();
  if(!/^[+]?\d+$/.test(raw))return 0;
  return Math.max(0,Math.min(DYING_SKULL_COUNT,Number(raw)));
}
/** Clicking a slot sets the Dying count; clicking the last filled one
 * toggles it off and removes one step. Never creates a separate per-slot key.
 */
export function toggleDyingSkull(current:unknown,slot:number):string {
  const count=readDyingSkulls(current);
  if(!Number.isInteger(slot)||slot<1||slot>DYING_SKULL_COUNT)return String(count);
  return String(slot===count?slot-1:slot);
}
