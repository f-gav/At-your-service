import {useState} from 'react';
import {MOON_ATTRIBUTES} from '../features/project-moon/model';
import './DiceFormulaExamples.css';

/** The examples intentionally contain only expressions the current parser
 * understands. Project Moon uses its own attribute names, not PF2e's STR/DEX.
 */
export default function DiceFormulaExamples({system}:{system:'pf2e'|'prmoon'}){
  const [expanded,setExpanded]=useState(false);
  return <div className="ays-formula-guide">
    <button type="button" className="ays-formula-guide-trigger"
      aria-expanded={expanded} onClick={()=>setExpanded(open=>!open)}>
      Примеры формул
    </button>
    {expanded&&<section className="ays-formula-guide-content" aria-label="Примеры формул кубиков">
      <p>Базовые броски и модификаторы</p>
      <dl>
        <dt><code>1d20</code> / <code>1к20</code></dt><dd>Один двадцатигранный кубик. Буквы d и к равнозначны.</dd>
        <dt><code>2d8+3</code></dt><dd>Два восьмигранных кубика и бонус +3.</dd>
        <dt><code>2d20kh1</code></dt><dd>Два d20, оставить лучший результат (аналог броска с преимуществом).</dd>
        <dt><code>2d20kl1</code></dt><dd>Два d20, оставить худший результат.</dd>
        <dt><code>4d6dl1</code></dt><dd>Четыре d6, отбросить один наименьший. Также есть kh, kl и dh.</dd>
        <dt><code>(1d6+2)*2</code></dt><dd>Скобки, умножение и другие арифметические действия.</dd>
        <dt><code>floor(1d8/2)</code></dt><dd>Округлить вниз. Доступны ceil, round, abs, min и max.</dd>
        <dt><code>1d20+5 # Атака</code></dt><dd>Указать название броска (необязательно).</dd>
      </dl>
      <p>{system==='prmoon'?'Переменные Project Moon':'Переменные Pathfinder 2e'}</p>
      {system==='pf2e'
        ?<dl>
          <dt><code>[LVL]</code></dt><dd>Уровень персонажа.</dd>
          <dt><code>[STR]</code></dt><dd>Сила.</dd>
          <dt><code>[DEX]</code></dt><dd>Ловкость.</dd>
          <dt><code>[CON]</code></dt><dd>Выносливость.</dd>
          <dt><code>[INT]</code></dt><dd>Интеллект.</dd>
          <dt><code>[WIS]</code></dt><dd>Мудрость.</dd>
          <dt><code>[CHA]</code></dt><dd>Харизма.</dd>
          <dt><code>1d20+[STR]</code></dt><dd>Бросок с текущим модификатором Силы.</dd>
        </dl>
        :<dl>
          <dt><code>[RANK]</code></dt><dd>Ранг персонажа.</dd>
          {MOON_ATTRIBUTES.map(attribute=><div className="ays-formula-guide-attribute" key={attribute.id}>
            <dt><code>[{attribute.english}]</code></dt><dd>{attribute.label}.</dd>
          </div>)}
          <dt><code>1d20+[FORTITUDE]</code></dt><dd>Бросок со значением Стойкости.</dd>
        </dl>}
      <small>Переменные читают текущие значения листа в момент броска. Если характеристика не заполнена, бросок сообщит об ошибке. Примеры не изменяют игровые правила.</small>
    </section>}
  </div>;
}
