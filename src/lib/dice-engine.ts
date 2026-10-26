/** Safe, local dice expressions. No eval, network, or third-party APIs.
 * Identical parser for PF2e and Project Moon; variable resolution is supplied
 * separately by the sheet, and dice are sampled with crypto.getRandomValues.
 */
export type DieResult={notation:string;faces:number[];kept:boolean[];subtotal:number};
export type DiceResult={formula:string;label:string;total:number;dice:DieResult[];calculation:string};
export type DiceVariables=Record<string,number>;
type Random=()=>number;
const MAX_DICE=1000,MAX_SIDES=100000,MAX_DEPTH=32;
export const DICE_ROLL_EVENT='ays:dice-roll';
export const DICE_ERROR_EVENT='ays:dice-error';
export function normalizeDiceFormula(text:string):string {
  return text.replace(/[кКD]/g,'d').replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/');
}
export function splitDiceLabel(source:string):{expression:string;label:string}{
  const input=source.trim();
  const hash=input.match(/^(.*?)\s*#\s*(.{1,100})$/s);
  if(hash)return {expression:hash[1].trim(),label:hash[2].trim()};
  const trailing=input.match(/^(.*\S)\s+\(([^()]{1,100})\)$/s);
  if(trailing && /[^\d.\s+*\/-]/.test(trailing[2]))
    return {expression:trailing[1],label:trailing[2].trim()};
  return {expression:input,label:''};
}
export function secureDiceRandom():number{
  if(typeof crypto==='undefined'||!crypto.getRandomValues)
    throw new Error('Для безопасного броска нужен защищённый браузер (HTTPS).');
  const sample=new Uint32Array(1);
  crypto.getRandomValues(sample);
  return sample[0]/4294967296;
}
class DiceParser{
  private at=0;
  private count=0;
  private dice:DieResult[]=[];
  private substitutions:{start:number;end:number;text:string}[]=[];
  private depth=0;
  private source:string;
  private vars:DiceVariables;
  private random:Random;
  constructor(source:string,vars:DiceVariables,random:Random){
    this.source=source;this.vars=vars;this.random=random;
  }
  private spaces(){while(/\s/.test(this.source[this.at]??'')&&this.at<this.source.length)this.at++;}
  private take(char:string){this.spaces();if(this.source.startsWith(char,this.at)){this.at+=char.length;return true;}return false;}
  private fail(reason:string):never{throw new Error(reason+' (позиция '+(this.at+1)+').');}
  private numeric():number|null{
    this.spaces();
    const match=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(this.source.slice(this.at));
    if(!match)return null;
    this.at+=match[0].length;
    const n=Number(match[0]);
    if(!Number.isFinite(n))this.fail('Некорректное число');
    return n;
  }
  parse(){
    if(this.source.length>1000)this.fail('Формула слишком длинная');
    const total=this.expression();
    this.spaces();
    if(this.at<this.source.length)this.fail('Неизвестный символ или оператор');
    if(!Number.isFinite(total)||Math.abs(total)>1e12)this.fail('Слишком большое число');
    // Preserve actual die faces and modifiers in the final result line:
    // "1d11: 6 + 2 = 8", rather than "1d11: 6 = 6".
    let expanded='';
    let last=0;
    for(const replacement of this.substitutions.sort((a,b)=>a.start-b.start)){
      expanded+=this.source.slice(last,replacement.start)+replacement.text;
      last=replacement.end;
    }
    expanded+=this.source.slice(last);
    expanded=expanded.trim()
      .replace(/\s*([+*/])\s*/g,' $1 ')
      .replace(/(?<=[\d)])\s*-\s*(?=[\d(a-z])/gi,' - ')
      .replace(/\s+/g,' ');
    if(!Number.isInteger(total))expanded='floor('+expanded+')';
    const notation=this.dice.map(part=>part.notation).join(' + ');
    const calculation=(notation?notation+': ':'')+expanded+' = '+Math.floor(total);
    return {total:Math.floor(total),dice:this.dice,calculation};
  }
  private expression():number{
    let n=this.term();
    for(;;){if(this.take('+'))n+=this.term();else if(this.take('-'))n-=this.term();else return n;}
  }
  private term():number{
    let n=this.unary();
    for(;;){
      if(this.take('*'))n*=this.unary();
      else if(this.take('/')){
        const by=this.unary();
        if(by===0)this.fail('Деление на ноль');
        n/=by;
      }else return n;
    }
  }
  private unary():number{
    if(this.take('+'))return this.unary();
    if(this.take('-'))return -this.unary();
    return this.factor();
  }
  private factor():number{
    this.spaces();
    if(++this.depth>MAX_DEPTH)this.fail('Слишком много вложенных скобок');
    try {return this.atom();}
    finally{this.depth--;}
  }
  private atom():number{
    this.spaces();
    let count:number|null=null;
    if(this.take('(')){
      const value=this.expression();
      if(!this.take(')'))this.fail('Не закрыта скобка');
      return value;
    }
    const variableStart=this.at;
    if(this.take('[')){
      const match=/^[\w]+/.exec(this.source.slice(this.at));
      if(!match)this.fail('Некорректная переменная');
      this.at+=match[0].length;
      if(!this.take(']'))this.fail('Не закрыта переменная');
      const id=match[0].toUpperCase();
      if(!Object.prototype.hasOwnProperty.call(this.vars,id)||!Number.isFinite(this.vars[id]))
        this.fail('Неизвестная или пустая переменная ['+id+']');
      this.substitutions.push({start:variableStart,end:this.at,text:String(this.vars[id])});
      return this.vars[id];
    }
    const diceStart=this.at;
    const head=this.numeric();
    if(head!==null)count=head;
    this.spaces();
    if(this.source[this.at]?.toLowerCase()==='d'){
      this.at++;
      const sides=this.numeric();
      if(sides===null||!Number.isInteger(sides)||sides<2||sides>MAX_SIDES)
        this.fail('Число граней должно быть от 2 до '+MAX_SIDES);
      const n=count??1;
      if(!Number.isInteger(n)||n<0||n>MAX_DICE||this.count+n>MAX_DICE)
        this.fail('Допускается до '+MAX_DICE+' костей за бросок');
      this.count+=n;
      const faces=Array.from({length:n},()=>{
        const sample=this.random();
        if(!Number.isFinite(sample)||sample<0||sample>=1)this.fail('Некорректный источник случайных чисел');
        return Math.floor(sample*sides)+1;
      });
      this.spaces();
      const modifier=/^(kh|kl|dh|dl)(\d+)/i.exec(this.source.slice(this.at));
      let kept=faces.map(()=>true);
      if(modifier){
        this.at+=modifier[0].length;
        const amount=Number(modifier[2]);
        if(!Number.isSafeInteger(amount)||amount>n)this.fail('Некорректное количество сохранённых или отброшенных костей');
        const indices=faces.map((_,i)=>i).sort((a,b)=>
          (modifier[1].toLowerCase().endsWith('h')?faces[b]-faces[a]:faces[a]-faces[b])||a-b);
        if(modifier[1].toLowerCase().startsWith('k')){
          kept=faces.map(()=>false);
          for(const index of indices.slice(0,amount))kept[index]=true;
        }else for(const index of indices.slice(0,amount))kept[index]=false;
      }
      const subtotal=faces.reduce((total,face,i)=>total+(kept[i]?face:0),0);
      this.dice.push({notation:`${n}d${sides}${modifier?.[0]??''}`,faces,kept,subtotal});
      const selected=faces.filter((_,index)=>kept[index]);
      const visible=selected.length===0?'0':selected.join(' + ');
      this.substitutions.push({
        start:diceStart,end:this.at,
        text:selected.length>1?'('+visible+')':visible,
      });
      return subtotal;
    }
    if(count!==null)return count;
    const name=/^[a-z]+/i.exec(this.source.slice(this.at));
    if(name){
      this.at+=name[0].length;
      const fn=name[0].toLowerCase();
      if(!['floor','ceil','round','abs','min','max'].includes(fn)||!this.take('('))
        this.fail('Неизвестная функция '+name[0]);
      const args=[this.expression()];
      while(this.take(','))args.push(this.expression());
      if(!this.take(')'))this.fail('Не закрыта функция');
      if(args.length!==(fn==='min'||fn==='max'?2:1))this.fail('Неверное количество аргументов');
      switch(fn){
        case 'floor':return Math.floor(args[0]);
        case 'ceil':return Math.ceil(args[0]);
        case 'round':return Math.round(args[0]);
        case 'abs':return Math.abs(args[0]);
        case 'min':return Math.min(...args);
        default:return Math.max(...args);
      }
    }
    this.fail('Ожидалось число, переменная или кость');
  }
}
export function rollDiceFormula(source:string,variables:DiceVariables={},random:Random=secureDiceRandom):DiceResult{
  const {expression,label}=splitDiceLabel(source);
  if(!expression)throw new Error('Введите формулу броска.');
  const parsed=new DiceParser(normalizeDiceFormula(expression),variables,random).parse();
  return {formula:expression,label,total:parsed.total,dice:parsed.dice,calculation:parsed.calculation};
}
const DICE_VARIABLE_FIELDS:Record<string,string>={
    STR:'ability_str',DEX:'ability_dex',CON:'ability_con',INT:'ability_int',WIS:'ability_wis',CHA:'ability_cha',
    LVL:'level',RANK:'rank',FORTITUDE:'fortitude',PRUDENCE:'prudence',
    JUSTICE:'determination',DETERMINATION:'determination',
    CHARM:'charm',INSIGHT:'discernment',DISCERNMENT:'discernment',TEMPERANCE:'temperance',
};
export function diceVariables(context:Record<string,unknown>={}):DiceVariables{
  const result:DiceVariables={};
  for(const [variable,key] of Object.entries(DICE_VARIABLE_FIELDS)){
    const v=context[key];
    if((typeof v==='string' && /^[-+]?\d+(?:\.\d+)?$/.test(v.trim()))||typeof v==='number'){
      const n=Number(v);
      if(Number.isFinite(n))result[variable]=n;
    }
  }
  return result;
}

/** Only for input validation before binding a formula. Empty but supported
 * ability references are temporarily replaced by zero. Real clicks always
 * use the character's live value and still report missing characteristics.
 */
export function diceValidationVariables(context:Record<string,unknown>={}):DiceVariables{
  const known=diceVariables(context);
  return Object.fromEntries(Object.keys(DICE_VARIABLE_FIELDS).map(key=>[key,known[key]??0]));
}
