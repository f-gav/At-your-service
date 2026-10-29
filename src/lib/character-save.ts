/**
 * Reject stale character saves rather than silently overwriting edits from
 * another tab or device. No database migration required: the existing
 * characters.updated_at trigger provides the compare-and-swap revision.
 *
 * A portrait edit or card reordering also changes updated_at; those metadata-
 * only changes may be safely retried, but edits to name/details never are.
 */
export type CharacterRevision = {
  name: string;
  details: unknown;
  updated_at: string;
};
export type ReadResult<T> = {data: T | null; error: unknown};

export class StaleCharacterError extends Error {
  constructor() {
    super('Персонаж изменён в другой вкладке или на другом устройстве. Автосохранение остановлено, ваши правки остались в локальном черновике. Скопируйте их перед обновлением страницы.');
    this.name='StaleCharacterError';
  }
}

function canonical(value: unknown): unknown {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object'){
    return Object.fromEntries(Object.entries(value)
      .filter(([,item])=>item!==undefined)
      .sort(([left],[right])=>left.localeCompare(right))
      .map(([key,item])=>[key,canonical(item)]));
  }
  return value;
}

export function sameEditableContent(a: Pick<CharacterRevision,'name'|'details'>,
  b: Pick<CharacterRevision,'name'|'details'>): boolean {
  return a.name===b.name && JSON.stringify(canonical(a.details))===JSON.stringify(canonical(b.details));
}

function raiseDatabaseError(error: unknown): void {
  if(!error)return;
  if(error instanceof Error)throw error;
  if(typeof error==='object' && error!==null && 'message' in error &&
    typeof error.message==='string')throw new Error(error.message);
  throw new Error('Не удалось проверить версию персонажа в облаке.');
}

export async function saveCharacterIfCurrent<T extends CharacterRevision>(
  baseline: CharacterRevision,
  updateAtRevision: (updatedAt:string)=>Promise<ReadResult<T>>,
  readLatest: ()=>Promise<ReadResult<CharacterRevision>>,
):Promise<T> {
  // The comparison is atomic inside Postgres; do not replace with a separate
  // SELECT followed by an unconditional UPDATE.
  const first=await updateAtRevision(baseline.updated_at);
  raiseDatabaseError(first.error);
  if(first.data)return first.data;

  const latest=await readLatest();
  raiseDatabaseError(latest.error);
  if(!latest.data || !sameEditableContent(baseline,latest.data)){
    throw new StaleCharacterError();
  }

  // A change limited to sort order or portrait metadata is harmless to the
  // content being edited. Retry ONCE with a fresh CAS guard. A concurrent
  // change between this read and the retry must still fail closed.
  const second=await updateAtRevision(latest.data.updated_at);
  raiseDatabaseError(second.error);
  if(!second.data)throw new StaleCharacterError();
  return second.data;
}
