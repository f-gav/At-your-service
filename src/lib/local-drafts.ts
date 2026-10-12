/**
 * Durable local recovery for edits not yet acknowledged by Supabase.
 * Data stays on the current device only. Never overwrite newer server state:
 * recovery is allowed only when the local draft is based on the exact state
 * we just loaded from the cloud.
 */
const PREFIX = 'ays-unsaved-draft-v1:';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
type LocalDraft = {base: string; snapshot: string; updatedAt: number};
export function characterDraftKey(userId: string, characterId: string): string {
  return PREFIX + userId + ':' + characterId;
}
function parseRecord(text: string | null): LocalDraft | null {
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object') return null;
    const draft = data as Partial<LocalDraft>;
    return typeof draft.base === 'string' && typeof draft.snapshot === 'string'
      && typeof draft.updatedAt === 'number' && Number.isFinite(draft.updatedAt)
      ? draft as LocalDraft : null;
  } catch { return null; }
}
export function recoverLocalDraft(key: string, serverSnapshot: string): string | null {
  try {
    const draft = parseRecord(window.localStorage.getItem(key));
    if (!draft) return null;
    if (Date.now() - draft.updatedAt > MAX_AGE) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (draft.base !== serverSnapshot || draft.snapshot === serverSnapshot) return null;
    // Corrupt or unexpected drafts are ignored rather than replacing the cloud character.
    JSON.parse(draft.snapshot);
    return draft.snapshot;
  } catch { return null; }
}
export function writeLocalDraft(key: string, base: string, snapshot: string): void {
  try {
    if (snapshot === base) { window.localStorage.removeItem(key); return; }
    window.localStorage.setItem(key, JSON.stringify({base,snapshot,updatedAt:Date.now()} satisfies LocalDraft));
  } catch {
    // Storage can be full or forbidden in private browsing. Cloud saves still work.
  }
}
export function clearLocalDraft(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* no storage permission */ }
}
