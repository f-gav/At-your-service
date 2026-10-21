import type {SpellView} from '../spell-library/catalog';

type SavedEntry={id:string;prepared:boolean};

/** A prepared-only filter must not scan the full selection for each spell. */
export function filterGrimoireEntries(
  spells:SpellView[],
  rank:number|'all',
  show:'all'|'prepared',
  search:string,
  selected:ReadonlyMap<string,SavedEntry>,
):SpellView[]{
  const needle=search.toLowerCase();
  return spells.filter(spell=>{
    const displayedRank=spell.spell.kind==='cantrip'?0:spell.spell.rank;
    return (rank==='all'||displayedRank===rank)&&
      (show==='all'||selected.get(spell.id)?.prepared===true)&&
      (!needle||[spell.name,spell.englishName].some(name=>name.toLowerCase().includes(needle)));
  });
}

/** Build each rank's list once instead of rescanning all results 11 times. */
export function groupGrimoireEntries(spells:SpellView[]):SpellView[][]{
  const groups=Array.from({length:11},()=>[] as SpellView[]);
  for(const spell of spells){
    const rank=spell.spell.kind==='cantrip'?0:spell.spell.rank;
    if(Number.isInteger(rank)&&rank>=0&&rank<groups.length)groups[rank].push(spell);
  }
  return groups;
}

/** Preserve existing prepared/slot semantics without repeated nested searches. */
export function summarizeGrimoire(
  spells:SpellView[],
  selection:SavedEntry[],
  slotCounts:number[],
){
  const byId=new Map(spells.map(spell=>[spell.id,spell] as const));
  const preparedByRank=Array.from({length:10},()=>0);
  let selectedCount=0;
  for(const entry of selection){
    if(!entry.prepared)continue;
    selectedCount++;
    const spell=byId.get(entry.id);
    if(spell?.spell.kind==='spell'&&spell.spell.rank>=1&&spell.spell.rank<=10)
      preparedByRank[spell.spell.rank-1]++;
  }
  const preparedCount=preparedByRank.reduce((sum,n)=>sum+n,0);
  const slotWarnings=preparedByRank.flatMap((count,i)=>
    count>0&&slotCounts[i]!==undefined&&Number.isFinite(slotCounts[i])&&count>slotCounts[i]
      ? [`${i+1}-й круг: ${count} из ${slotCounts[i]}`]:[]
  );
  return {selectedCount,preparedCount,slotWarnings};
}
