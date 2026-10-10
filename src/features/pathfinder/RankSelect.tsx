import type { CSSProperties } from 'react';
import { RANK_LABELS, RANK_MARKS } from './rules-core';
import type { Rank } from './rules-core';

export default function RankSelect({
  id, label, rank, style, onChange, disabled,
}: {
  id: string;
  label: string;
  rank: Rank;
  style: CSSProperties;
  onChange: (rank: Rank) => void;
  disabled: boolean;
}) {
  return <label className="pf-field pf-rank-field" style={style} title={label + ': ' + RANK_LABELS[rank]}>
    <span className="pf-rank-marks" aria-hidden="true">
      {([1, 2, 3, 4] as Rank[]).map(value =>
        <span key={value} className={'pf-rank-mark' + (rank === value ? ' pf-rank-mark-selected' : '')} />,
      )}
    </span>
    <select id={id} aria-label={label} title={label + ': ' + RANK_LABELS[rank]}
      value={String(rank)} disabled={disabled} onChange={event => onChange(Number(event.target.value) as Rank)}>
      {RANK_LABELS.map((name, value) =>
        <option value={value} key={name}>{RANK_MARKS[value]} — {name}</option>,
      )}
    </select>
  </label>;
}
