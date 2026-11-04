/** D&D-only, bounded formula interpreter. This does not alter PF2e/Project Moon dice.
 * LSS-compatible notation subset: NdS, Fate/percentile, keep/drop, rerolls,
 * explosions, numeric clamps, success counting, arithmetic and if().
 * No eval, dynamic code, remote calls or unbounded random draws.
 */
import {normalizeDiceFormula,secureDiceRandom,splitDiceLabel} from '../../../lib/dice-engine.ts';
import type {DiceResult,DieResult,DiceVariables} from '../../../lib/dice-engine.ts';
import type {Dnd5eSheet} from './model.ts';


type RNG=()=>number;
const MAX_LENGTH=1000, MAX_DICE=1000, MAX_DEPTH=32, MAX_EXTRA=100;
type Comparator='='|'!='|'>'|'<'|'>='|'<=';
function check(a:number,op:Comparator,b:number):boolean {
  switch(op){
    case '=':return a===b;
    case '!=':return a!==b;
    case '>':return a>b;
    case '<':return a<b;
    case '>=':return a>=b;
    case '<=':return a<=b;
  }
}
export function dndFormulaVariables(sheet:Dnd5eSheet):DiceVariables {
  const prof=2+Math.floor((sheet.identity.level-1)/4);
  const result:DiceVariables={LVL:sheet.identity.level,PROF:prof,HALF_PROF:Math.floor(prof/2)};
  for(const a of ['str','dex','con','int','wis','cha'] as const){
    const stat=sheet.abilities[a];
    result[a.toUpperCase()]=stat.manualModifierOverride??Math.floor((stat.score-10)/2);
  }
  return result;
}
class Parser {
  private source:string;
  private i=0;
  private depth=0;
  private diceCount=0;
  private dice:DieResult[]=[];
  private random:RNG;
  private vars:DiceVariables;
  constructor(input:string,vars:DiceVariables,random:RNG){
    this.source=normalizeDiceFormula(input);
    this.vars=vars;this.random=random;
    if(this.source.length>MAX_LENGTH)throw Error('D&D: формула длиннее 1000 символов');
  }
  private whitespace(){while(/\s/.test(this.source[this.i]??'')&&this.i<this.source.length)this.i++;}
  private take(s:string):boolean{
    this.whitespace();
    if(this.source.slice(this.i,this.i+s.length).toLowerCase()!==s.toLowerCase())return false;
    this.i+=s.length;return true;
  }
  private fail(msg:string):never{throw Error('D&D: '+msg+' (символ '+(this.i+1)+')');}
  private digit():number|null{
    this.whitespace();
    const m=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(this.source.slice(this.i));
    if(!m)return null;
    this.i+=m[0].length;
    return Number(m[0]);
  }
  private word():string|null{
    this.whitespace();
    const m=/^[a-z_]+/i.exec(this.source.slice(this.i));
    if(!m)return null;this.i+=m[0].length;return m[0].toLowerCase();
  }
  private cmp():{op:Comparator;threshold:number}|null{
    this.whitespace();
    const m=/^(>=|<=|!=|<>|=|>|<)\s*(-?\d+(?:\.\d+)?)/.exec(this.source.slice(this.i));
    if(!m)return null;
    this.i+=m[0].length;
    return {op:m[1]==='<>'?'!=':m[1] as Comparator,threshold:Number(m[2])};
  }
  private bounded(n:number):number{
    if(!Number.isFinite(n)||Math.abs(n)>1e12)this.fail('слишком большое или неконечное число');
    return n;
  }
  parse(roll:boolean):{value:number;dice:DieResult[]}{
    const n=this.expr(roll);
    this.whitespace();
    if(this.i<this.source.length)this.fail('неизвестный оператор или символ');
    return {value:Math.floor(this.bounded(n)),dice:this.dice};
  }
  private expr(run:boolean){return this.or(run);}
  private or(run:boolean):number {
    let n=this.and(run);
    while(this.keyword('or')){const right=this.and(run&&n===0);n=(n!==0||right!==0)?1:0;}
    return n;
  }
  private and(run:boolean):number {
    let n=this.comparison(run);
    while(this.keyword('and')){const right=this.comparison(run&&n!==0);n=(n!==0&&right!==0)?1:0;}
    return n;
  }
  private keyword(word:string):boolean{
    this.whitespace();
    const sub=this.source.slice(this.i);
    if(!new RegExp('^'+word+'(?![a-z_])','i').test(sub))return false;
    this.i+=word.length;return true;
  }
  private comparison(run:boolean):number {
    let n=this.add(run);
    this.whitespace();
    const symbols:['>=','<=','!=','<>','==','>','<']=['>=','<=','!=','<>','==','>','<'];
    for(const symbol of symbols){
      if(this.source.startsWith(symbol,this.i)){
        this.i+=symbol.length;
        const right=this.add(run);
        const operator=symbol==='=='?'=':symbol==='<>'?'!=':symbol as Comparator;
        return check(n,operator,right)?1:0;
      }
    }
    return n;
  }
  private add(run:boolean):number {
    let n=this.mul(run);
    while(true){
      if(this.take('+'))n=this.bounded(n+this.mul(run));
      else if(this.take('-'))n=this.bounded(n-this.mul(run));
      else return n;
    }
  }
  private mul(run:boolean):number {
    let n=this.power(run);
    while(true){
      if(this.take('*'))n=this.bounded(n*this.power(run));
      else if(this.take('/')){const d=this.power(run);if(d===0&&run)this.fail('деление на ноль');n=d===0?0:n/d;}
      else if(this.take('%')){const d=this.power(run);if(d===0&&run)this.fail('остаток при делении на ноль');n=d===0?0:n%d;}
      else return this.bounded(n);
    }
  }
  private power(run:boolean):number {
    let n=this.unary(run);
    if(this.take('^'))n=this.bounded(Math.pow(n,this.power(run)));
    return n;
  }
  private unary(run:boolean):number {
    if(this.take('+'))return this.unary(run);
    if(this.take('-'))return -this.unary(run);
    if(this.keyword('not'))return this.unary(run)===0?1:0;
    return this.factor(run);
  }
  private factor(run:boolean):number {
    if(++this.depth>MAX_DEPTH)this.fail('слишком глубокие скобки');
    try{return this.atom(run);}finally{this.depth--;}
  }
  private atom(run:boolean):number {
    this.whitespace();
    let n:number;
    if(this.take('(')){
      n=this.expr(run);
      if(!this.take(')'))this.fail('не закрыта скобка');
    }else if(this.take('[')){
      this.whitespace();
      const word=/^[a-z_][a-z_0-9]*/i.exec(this.source.slice(this.i));
      if(word&&this.source.slice(this.i+word[0].length).trimStart().startsWith(']')){
        this.i+=word[0].length;
        const key=word[0].toUpperCase();
        if(!Object.prototype.hasOwnProperty.call(this.vars,key)||!Number.isFinite(this.vars[key]))
          this.fail('неизвестная переменная ['+key+']');
        n=this.vars[key];
      }else n=this.expr(run);
      if(!this.take(']'))this.fail('не закрыта переменная');
    }else{
      const num=this.digit();
      if(num!==null)n=num;
      else {
        this.whitespace();
        if(this.source[this.i]?.toLowerCase()==='d'&&/[0-9(%f]/i.test(this.source[this.i+1]??'')){
          n=this.rollDice(1,run);return n;
        }
        const name=this.word();
        if(!name)this.fail('ожидалось число, переменная или кость');
        if(!this.take('('))this.fail('неизвестная функция '+name);
        if(name==='if'){
          const cond=this.expr(false);
          if(!this.take(','))this.fail('if требует три аргумента');
          // Conditions are always deterministic. Parse twice only when needed:
          // first branch/other branch still consume syntax, but do not roll.
          const yes=this.expr(run&&cond!==0);
          if(!this.take(','))this.fail('if требует третий аргумент');
          const no=this.expr(run&&cond===0);
          if(!this.take(')'))this.fail('не закрыта if');
          n=cond!==0?yes:no;
        }else{
          const args=[this.expr(run)];
          while(this.take(','))args.push(this.expr(run));
          if(!this.take(')'))this.fail('не закрыта функция');
          n=this.fn(name,args);
        }
      }
    }
    this.whitespace();
    if(this.source[this.i]?.toLowerCase()==='d'&&/[0-9(%f]/i.test(this.source[this.i+1]??'')){
      this.i++;
      return this.rollDice(n,run,true);
    }
    return n;
  }
  private fn(name:string,args:number[]):number{
    const unary:Record<string,(n:number)=>number>={
      floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs,sqrt:Math.sqrt,
      sign:Math.sign,exp:Math.exp,log:Math.log,sin:Math.sin,cos:Math.cos,tan:Math.tan,
    };
    if(name in unary&&args.length===1)return this.bounded(unary[name](args[0]));
    if(name==='min'&&args.length>=2)return Math.min(...args);
    if(name==='max'&&args.length>=2)return Math.max(...args);
    if(name==='pow'&&args.length===2)return this.bounded(Math.pow(args[0],args[1]));
    this.fail('неизвестная функция или неверное число аргументов '+name);
  }
  private rollDice(rawCount:number,run:boolean,dConsumed=false):number {
    if(!dConsumed)this.i++;
    const count=Math.max(0,Math.floor(rawCount));
    if(!Number.isFinite(count)||count>MAX_DICE)this.fail('слишком много костей');
    let sides=0,fate=false;
    if(this.take('%'))sides=100;
    else if(this.take('F')){sides=3;fate=true;}
    else if(this.take('(')){
      sides=this.expr(false);
      if(!this.take(')'))this.fail('не закрыты грани кости');
    }else sides=this.digit()??0;
    if(!Number.isInteger(sides)||sides<2||sides>100000)this.fail('число граней вне диапазона 2…100000');
    if(this.diceCount+count>MAX_DICE)this.fail('общий предел 1000 костей');
    const start=this.i;
    let mode='' as ''|'kh'|'kl'|'dh'|'dl',amount=0,reroll:''|'r'|'ro'|'u'|'uo'='';
    let rerollRule:{op:Comparator;threshold:number}|null=null;
    let explosion:''|'!'|'!!'|'!p'='',explosionRule:{op:Comparator;threshold:number}|null=null;
    let clampMin:number|undefined,clampMax:number|undefined;
    let success:{op:Comparator;threshold:number}|null=null,fail:{op:Comparator;threshold:number}|null=null;
    while(true){
      this.whitespace();
      const m=/^(kh|kl|dh|dl)(\d+)/i.exec(this.source.slice(this.i));
      if(m){if(mode)this.fail('несколько модификаторов сохранения костей');
        mode=m[1].toLowerCase() as typeof mode;amount=Number(m[2]);
        if(amount>count)this.fail('больше сохранённых костей, чем брошено');
        this.i+=m[0].length;continue;
      }
      const min=/^(min|max)(\d+)/i.exec(this.source.slice(this.i));
      if(min){const value=Number(min[2]);if(!Number.isSafeInteger(value)||value<1||value>sides)this.fail('неверный предел кости');
        if(min[1].toLowerCase()==='min')clampMin=value;else clampMax=value;
        this.i+=min[0].length;continue;
      }
      const er=/^(ro|r)(?=(?:>=|<=|!=|<>|=|>|<))/i.exec(this.source.slice(this.i));
      if(er){if(reroll)this.fail('несколько перебросов');
        reroll=er[1].toLowerCase() as 'r'|'ro';this.i+=er[0].length;
        rerollRule=this.cmp();if(!rerollRule)this.fail('нет условия переброса');continue;
      }
      const u=/^(uo|u)(?![a-z])/i.exec(this.source.slice(this.i));
      if(u){if(reroll)this.fail('несколько перебросов');
        reroll=u[1].toLowerCase() as 'u'|'uo';this.i+=u[0].length;continue;
      }
      if(this.source.startsWith('!p',this.i)||this.source.startsWith('!!',this.i)||this.source.startsWith('!',this.i)){
        if(explosion)this.fail('несколько взрывов костей');
        explosion=this.source.startsWith('!p',this.i)?'!p':this.source.startsWith('!!',this.i)?'!!':'!';
        this.i+=explosion.length;explosionRule=this.cmp();continue;
      }
      const crit=/^(cs|cf)(?=(?:>=|<=|!=|<>|=|>|<))/i.exec(this.source.slice(this.i));
      if(crit){this.i+=crit[0].length;if(!this.cmp())this.fail('неверный критерий критического броска');continue;}
      if(/^(sa|sd)(?![a-z])/i.test(this.source.slice(this.i))){this.i+=2;continue;}
      const c=this.cmp();
      if(c){if(success)this.fail('повторное условие подсчёта');success=c;
        if(this.take('f')){fail=this.cmp();if(!fail)this.fail('нет условия провала');}
        continue;
      }
      break;
    }
    const notation=String(count)+'d'+(fate?'F':sides)+this.source.slice(start,this.i);
    if(!run)return 0;
    this.diceCount+=count;
    const values:number[]=[],groups:number[][]=[];
    const sample=():number=>{
      const v=this.random();
      if(!Number.isFinite(v)||v<0||v>=1)this.fail('неверный генератор случайных чисел');
      return Math.floor(v*sides)+(fate?-1:1);
    };
    const cap=(v:number)=>Math.min(clampMax??v,Math.max(clampMin??v,v));
    const counts=new Set<number>();
    for(let k=0;k<count;k++){
      const indices:number[]=[];
      let value=sample(),loops=0;
      indices.push(values.length);values.push(value);
      while(reroll&&loops<MAX_EXTRA&&(
        rerollRule?check(value,rerollRule.op,rerollRule.threshold):counts.has(value))){
        if((reroll==='ro'||reroll==='uo')&&loops>=1)break;
        loops++;value=sample();indices.push(values.length);values.push(value);
      }
      if(loops===MAX_EXTRA)this.fail('превышен предел перебросов 100 на кость');
      counts.add(value);groups.push(indices);
    }
    // Keep/drop selects entire base dice (not their discarded reroll faces).
    const final=groups.map(g=>cap(values[g[g.length-1]]));
    const indices=final.map((_,i)=>i).sort((a,b)=>(mode.endsWith('h')?final[b]-final[a]:final[a]-final[b])||a-b);
    const keep=final.map(()=>true);
    if(mode.startsWith('k')){keep.fill(false);for(const i of indices.slice(0,amount))keep[i]=true;}
    if(mode.startsWith('d'))for(const i of indices.slice(0,amount))keep[i]=false;
    const flags=values.map(()=>false);
    let sum=0,successCount=0;
    for(let k=0;k<groups.length;k++){
      const baseIndex=groups[k][groups[k].length-1],v=final[k];
      if(!keep[k])continue;
      flags[baseIndex]=true;
      sum+=v;
      if(success)successCount+=check(v,success.op,success.threshold)?1:fail&&check(v,fail.op,fail.threshold)?-1:0;
      if(explosion){
        let prev=v,loops=0;
        const explode=()=>explosionRule?check(prev,explosionRule.op,explosionRule.threshold):prev===(fate?1:sides);
        while(explode()){
          if(++loops>MAX_EXTRA)this.fail('превышен предел взрывов 100 на кость');
          prev=sample();const value=cap(prev);
          values.push(value);flags.push(true);
          sum+=explosion==='!!'||explosion==='!p'?value-1:value;
          if(success)successCount+=check(value,success.op,success.threshold)?1:fail&&check(value,fail.op,fail.threshold)?-1:0;
        }
      }
    }
    this.dice.push({notation,faces:values,kept:flags,subtotal:success?successCount:sum});
    return success?successCount:sum;
  }
}
export function rollDndLssFormula(source:string,vars:DiceVariables={},random:RNG=secureDiceRandom):DiceResult{
  const {expression,label}=splitDiceLabel(source);
  if(!expression)throw Error('D&D: введите формулу');
  const x=new Parser(expression,vars,random).parse(true);
  return {formula:expression,label,total:x.value,dice:x.dice,
    calculation:(x.dice.map(d=>d.notation).join(' + ')?x.dice.map(d=>d.notation).join(' + ')+': ':'')+
      x.dice.map(d=>d.faces.filter((_,i)=>d.kept[i]).join(' + ')).filter(Boolean).join(' ; ')+
      (x.dice.length?' → ':'')+String(x.value)};
}
export function evaluateDndNumericFormula(source:string,vars:DiceVariables={}):number {
  if(/(?:\d|[)\]])\s*d\s*(?:\d|%|F|\()|\bd(?:\d|%|F|\()/i.test(normalizeDiceFormula(source)))
    throw Error('D&D: в числовом поле запрещены случайные кости');
  const result=new Parser(source,vars,()=>{throw Error('D&D: запрещены кости');}).parse(true);
  return result.value;
}
