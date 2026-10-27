import {useCallback,useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowLeft,Copy,Dices,LogOut,Plus,RefreshCw,Shield,Trash2,Users,X,LayoutDashboard,Settings,Save,ChevronRight,UserPlus} from 'lucide-react';
import type {Character} from '../../lib/models';
import {supabase} from '../../lib/supabase';
import './RoomsHub.css';

export type RoomSystem='pf2e'|'prmoon';
type Room={id:string;owner_id:string;title:string;system:RoomSystem;invite_code:string;closed:boolean;created_at:string};
type Snapshot={name?:string;hpCurrent?:string;hpMax?:string;hpTemp?:string;ac?:string;level?:string;
  stCurrent?:string;stMax?:string;spCurrent?:string;spMax?:string;rank?:string};
type Member={room_id:string;character_id:string;user_id:string;casts_enabled:boolean;joined_at:string;snapshot:Snapshot};
type Roll={id:string;room_id:string;character_id:string;formula:string;label:string;total:number;
  calculation:string;created_at:string;dice:unknown[]};
type Props={userId:string|null;characters:Character[];onOpenCharacter:(id:string)=>void};
const systemLabels:Record<RoomSystem,string>={pf2e:'Pathfinder 2e',prmoon:'Project Moon'};
const friendlyError=(error:unknown)=>{
  const message=error&&typeof error==='object'&&'message'in error?String(error.message):String(error);
  if(/Could not find the table|schema cache|PGRST205|Could not find the function/.test(message))
    return 'Комнаты ещё не подключены к Supabase. Необходимо применить миграцию supabase/migrations/20261026_game_rooms.sql к базе At your service!.';
  if(/already in a room|duplicate key/i.test(message))return 'Этот персонаж уже состоит в комнате.';
  if(/does not match room/i.test(message))return 'Система персонажа не совпадает с системой комнаты.';
  if(/Room not found|closed/i.test(message))return 'Комната с таким кодом не найдена или закрыта.';
  return message;
};
function stat(value:unknown){return typeof value==='string'&&value.trim()?value:'—';}
function ratio(current:unknown,max:unknown){
  const a=Number(current),b=Number(max);
  return typeof current==='string'&&current.trim()!==''&&typeof max==='string'&&max.trim()!==''&&
    Number.isFinite(a)&&Number.isFinite(b)&&b>0 ? Math.max(0,Math.min(100,a/b*100)) : null;
}
function Resource({label,current,max}:{label:string;current?:string;max?:string}){
  const progress=ratio(current,max);
  return <div className="ays-room-stat">
    <div className="ays-room-stat-top"><span>{label}</span><strong>{stat(current)} / {stat(max)}</strong></div>
    <div className="ays-room-stat-bar">{progress!==null&&<div style={{width:progress+'%'}}/>}</div>
  </div>;
}
export default function RoomsHub({userId,characters,onOpenCharacter}:Props){
  const [rooms,setRooms]=useState<Room[]>([]);
  const [mine,setMine]=useState<Member[]>([]);
  const [roomCounts,setRoomCounts]=useState<Record<string,number>>({});
  const [dialog,setDialog]=useState<'create'|'join'|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [rolls,setRolls]=useState<Roll[]>([]);
  const [createTitle,setCreateTitle]=useState('');
  const [createSystem,setCreateSystem]=useState<RoomSystem>('pf2e');
  const [inviteCode,setInviteCode]=useState('');
  const [inviteCharacter,setInviteCharacter]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [roomTab,setRoomTab]=useState<'table'|'players'|'settings'>('table');
  const [roomTitleDraft,setRoomTitleDraft]=useState('');
  const room=rooms.find(r=>r.id===selected);
  const isOwner=!!room&&room.owner_id===userId;
  const roomMembersOwn=members.filter(m=>m.user_id===userId);
  const eligible=characters.filter(c=>(c.system==='pf2e'||c.system==='prmoon')&&!mine.some(m=>m.character_id===c.id));
  const sortedRooms=useMemo(()=>[...rooms].sort((a,b)=>b.created_at.localeCompare(a.created_at)),[rooms]);
  useEffect(()=>{
    if(!dialog)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)setDialog(null);};
    document.addEventListener('keydown',closeOnEscape);
    return()=>document.removeEventListener('keydown',closeOnEscape);
  },[dialog,busy]);
  const loadOverview=useCallback(async()=>{
    if(!supabase||!userId){setRooms([]);setMine([]);setRoomCounts({});return;}
    const [roomsResponse,mineResponse,countsResponse]=await Promise.all([
      supabase.from('game_rooms').select('id,owner_id,title,system,invite_code,closed,created_at').order('created_at',{ascending:false}),
      supabase.from('game_room_members').select('room_id,character_id,user_id,casts_enabled,joined_at,snapshot').eq('user_id',userId),
      supabase.from('game_room_members').select('room_id,user_id'),
    ]);
    if(roomsResponse.error||mineResponse.error)throw roomsResponse.error??mineResponse.error;
    setRooms((roomsResponse.data??[]) as Room[]);
    setMine((mineResponse.data??[]) as Member[]);
    // Count distinct players, not sheets. A user can attach several characters.
    // Counts come only from rows that existing room-member RLS makes readable.
    const roomUsers:Record<string,Set<string>>={};
    if(!countsResponse.error){for(const entry of countsResponse.data??[]){
      (roomUsers[entry.room_id]??=new Set<string>()).add(entry.user_id);
    }}
    setRoomCounts(Object.fromEntries(Object.entries(roomUsers).map(([id,people])=>[id,people.size])));
  },[userId]);
  const loadRoom=useCallback(async(roomId:string)=>{
    if(!supabase||!userId)return;
    const [people,events]=await Promise.all([
      supabase.from('game_room_members').select('room_id,character_id,user_id,casts_enabled,joined_at,snapshot').eq('room_id',roomId).order('joined_at'),
      supabase.from('game_room_rolls').select('id,room_id,character_id,formula,label,total,calculation,created_at,dice').eq('room_id',roomId).order('created_at',{ascending:false}).limit(80),
    ]);
    if(people.error||events.error)throw people.error??events.error;
    setMembers((people.data??[]) as Member[]);
    setRolls((events.data??[]) as Roll[]);
  },[userId]);
  useEffect(()=>{
    if(!userId)return;
    let active=true;
    setLoading(true);
    void loadOverview().catch(cause=>{if(active)setError(friendlyError(cause));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[loadOverview,userId]);
  useEffect(()=>{
    if(!selected||!userId||!supabase)return;
    const client=supabase;
    let live=true;
    const refresh=()=>{void loadRoom(selected).catch(cause=>{if(live)setError(friendlyError(cause));});};
    refresh();
    const channel=client.channel('ays-room-'+selected)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_room_members',filter:'room_id=eq.'+selected},refresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_room_rolls',filter:'room_id=eq.'+selected},refresh)
      .subscribe();
    // Fallback when Realtime is unavailable or network reconnects.
    const timer=window.setInterval(()=>{refresh();void loadOverview().catch(()=>{});},8000);
    return()=>{live=false;window.clearInterval(timer);void client.removeChannel(channel);};
  },[selected,userId,loadRoom,loadOverview]);
  async function operate(action:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await action();await loadOverview();if(selected)await loadRoom(selected);}
    catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);}
  }
  async function createRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!userId)return;
    await operate(async()=>{
      const {data,error:failure}=await supabase!.from('game_rooms')
        .insert({owner_id:userId,title:createTitle.trim(),system:createSystem})
        .select('id').single();
      if(failure||!data)throw failure??new Error('Не удалось создать комнату');
      setSelected(data.id);setRoomTab('table');setCreateTitle('');setDialog(null);
    });
  }
  async function joinRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!inviteCharacter)return;
    await operate(async()=>{
      const {data,error:failure}=await supabase!.rpc('join_game_room',{
        p_code:inviteCode.trim().toUpperCase(),p_character:inviteCharacter,
      });
      if(failure||!data)throw failure??new Error('Не удалось подключить персонажа');
      setSelected(data as string);setRoomTab('table');setInviteCode('');setInviteCharacter('');setDialog(null);
    });
  }
  async function leaveRoom(member:Member){
    if(!supabase)return;
    if(!window.confirm(member.user_id===userId?'Вывести своего персонажа из комнаты?':'Исключить персонажа из комнаты?'))return;
    await operate(async()=>{
      const {error:failure}=await supabase!.from('game_room_members').delete()
        .eq('room_id',member.room_id).eq('character_id',member.character_id);
      if(failure)throw failure;
    });
  }
  async function toggleRolls(member:Member){
    if(!supabase)return;
    await operate(async()=>{
      const {error:failure}=await supabase!.from('game_room_members')
        .update({casts_enabled:!member.casts_enabled})
        .eq('room_id',member.room_id).eq('character_id',member.character_id).eq('user_id',userId!);
      if(failure)throw failure;
    });
  }
  async function renameRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!room||!isOwner||!roomTitleDraft.trim())return;
    await operate(async()=>{
      const {error:failure}=await supabase!.from('game_rooms').update({title:roomTitleDraft.trim()}).eq('id',room.id);
      if(failure)throw failure;
    });
  }
  async function closeRoom(){
    if(!supabase||!room||!isOwner)return;
    const next=!room.closed;
    await operate(async()=>{
      const {error:failure}=await supabase!.from('game_rooms').update({closed:next}).eq('id',room.id);
      if(failure)throw failure;
    });
  }
  async function deleteRoom(){
    if(!supabase||!room||!isOwner||!window.confirm('Удалить комнату и историю бросков? Листы персонажей останутся без изменений.'))return;
    await operate(async()=>{
      const {error:failure}=await supabase!.from('game_rooms').delete().eq('id',room.id);
      if(failure)throw failure;
      setSelected(null);setMembers([]);setRolls([]);
    });
  }
  if(!userId)return <main className="ays-rooms"><h1>Комнаты</h1><p>Войди через Google, чтобы создавать комнаты или подключать своих персонажей.</p></main>;
  return <main className={'ays-rooms'+(selected&&room?' ays-rooms-in-room':'')}>
    {!(selected&&room)&&<div className="ays-rooms-heading">
      <div>
        <span className="ays-rooms-kicker">СОВМЕСТНАЯ ИГРА</span>
        <h1>Комнаты</h1>
        <p>Персонажи одной игровой системы, ключевые ресурсы и общий журнал бросков.</p>
      </div>
      <button type="button" onClick={()=>void loadOverview().catch(cause=>setError(friendlyError(cause)))}
        title="Обновить список" aria-label="Обновить комнаты"><RefreshCw size={20}/></button>
    </div>}
    {error&&<div className="ays-room-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Закрыть ошибку"><X size={16}/></button></div>}
    {selected&&room?<section className="ays-room-open">
      <header className="ays-room-topline">
        <div className="ays-room-identity">
          <button type="button" className="ays-room-back" onClick={()=>{setSelected(null);setError('');}}><ArrowLeft size={16}/> Комнаты</button>
          <h2>{room.title}</h2>
          <span className="ays-room-system">{systemLabels[room.system]}</span>
        </div>
        <div className="ays-room-code">
          <span>Код комнаты: <strong>{room.invite_code}</strong></span>
          <button type="button" title="Скопировать код" aria-label="Скопировать код" onClick={()=>void navigator.clipboard.writeText(room.invite_code).catch(()=>setError('Не удалось скопировать код.'))}><Copy size={18}/></button>
        </div>
      </header>
      <nav className="ays-room-tabs" aria-label="Разделы комнаты">
        <button type="button" className={roomTab==='table'?'active':''} aria-current={roomTab==='table'?'page':undefined} onClick={()=>setRoomTab('table')}><LayoutDashboard size={17}/> Стол</button>
        <button type="button" className={roomTab==='players'?'active':''} aria-current={roomTab==='players'?'page':undefined} onClick={()=>setRoomTab('players')}><Users size={17}/> Игроки и персонажи</button>
        <button type="button" className={roomTab==='settings'?'active':''} aria-current={roomTab==='settings'?'page':undefined} onClick={()=>{setRoomTitleDraft(room.title);setRoomTab('settings');}}><Settings size={17}/> Настройки</button>
      </nav>
      {roomTab==='table'&&<div className="ays-room-table">
        <section className="ays-room-table-characters" aria-label="Персонажи">
          <h3>Персонажи</h3>
          <div className="ays-room-member-grid">
          {members.length===0&&<p className="ays-room-empty">Пока нет персонажей. Передай игрокам код комнаты.</p>}
          {members.map(member=>{
            const snap=member.snapshot??{};
            const local=characters.find(c=>c.id===member.character_id);
            return <article className="ays-room-member" key={member.character_id}>
              <div className="ays-room-member-title">
                <div className="ays-room-member-name"><span className="ays-room-member-avatar"><Users size={19}/></span>
                  <span><strong>{snap.name||'Персонаж'}</strong><small>{room.system==='pf2e'&&snap.level?'Уровень '+snap.level:room.system==='prmoon'&&snap.rank?'Ранг '+snap.rank:''}</small></span>
                </div>
                {member.user_id===userId&&local&&<button type="button" title="Открыть свой лист" onClick={()=>onOpenCharacter(local.id)}>Лист</button>}
              </div>
              {room.system==='pf2e'?<>
                <Resource label="ПЗ" current={snap.hpCurrent} max={snap.hpMax}/>
                <div className="ays-room-member-secondary"><span><Shield size={15}/> КД <b>{stat(snap.ac)}</b></span>{snap.hpTemp&&<span>Врем. ПЗ {snap.hpTemp}</span>}</div>
              </>:<>
                <Resource label="HP" current={snap.hpCurrent} max={snap.hpMax}/>
                <Resource label="ST" current={snap.stCurrent} max={snap.stMax}/>
                <Resource label="SP" current={snap.spCurrent} max={snap.spMax}/>
              </>}
            </article>;
          })}
          </div>
        </section>
        <aside className="ays-room-events">
          <h3><Dices size={18}/> История событий <small>(последние 80)</small></h3>
          {rolls.length===0?<p className="ays-room-empty">Бросков ещё не было.</p>:
            <div className="ays-room-event-list">{rolls.map(roll=><article key={roll.id} className="ays-room-event">
              <div><strong>{members.find(m=>m.character_id===roll.character_id)?.snapshot?.name??'Персонаж'}</strong>
                <span>{new Date(roll.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span></div>
              <h4>{roll.label||roll.formula}<b>{roll.total}</b></h4>
              <p>{roll.calculation||roll.formula+' = '+roll.total}</p>
            </article>)}</div>}
        </aside>
      </div>}
      {roomTab==='players'&&<div className="ays-room-players">
        <h3>Игроки и персонажи <small>({members.length})</small></h3>
        {members.length===0&&<p className="ays-room-empty">В комнате ещё нет персонажей.</p>}
        {members.map(member=>{
          const own=member.user_id===userId;
          const local=characters.find(c=>c.id===member.character_id);
          return <article key={member.character_id} className="ays-room-player">
            <div className="ays-room-player-heading"><strong>{own?'Вы':'Игрок'}</strong><span>{own?'Ваш аккаунт':'Участник комнаты'}</span></div>
            <div className="ays-room-player-body">
              <span className="ays-room-member-avatar"><Users size={18}/></span>
              <div><strong>{member.snapshot?.name||'Персонаж'}</strong><small>{systemLabels[room.system]}</small></div>
              {own&&local&&<button type="button" onClick={()=>onOpenCharacter(local.id)}>Открыть лист</button>}
              {(own||isOwner)&&<button className="ays-room-kick" title={own?'Покинуть комнату':'Исключить персонажа'} type="button" disabled={busy} onClick={()=>void leaveRoom(member)}><LogOut size={16}/>{own?'Покинуть':'Выгнать'}</button>}
            </div>
            {own&&<label className="ays-room-roll-toggle"><input type="checkbox" checked={member.casts_enabled} disabled={busy} onChange={()=>void toggleRolls(member)}/> Отправлять броски в комнату</label>}
          </article>;
        })}
      </div>}
      {roomTab==='settings'&&<div className="ays-room-settings">
        <section>
          <h3>Настройки комнаты</h3>
          <form onSubmit={event=>void renameRoom(event)}>
            <label>Название<input maxLength={100} minLength={1} required value={isOwner?roomTitleDraft:room.title} disabled={!isOwner||busy} onChange={e=>setRoomTitleDraft(e.target.value)}/></label>
            {isOwner&&<button type="submit" disabled={busy||!roomTitleDraft.trim()||roomTitleDraft.trim()===room.title}><Save size={16}/> Сохранить изменения</button>}
          </form>
        </section>
        <section>
          <h3>Доступ в комнату</h3>
          <p>Система: {systemLabels[room.system]} · {members.length} персонажей</p>
          <p>Приглашения: {room.closed?'закрыты':'открыты'}</p>
          {isOwner&&<button type="button" disabled={busy} onClick={()=>void closeRoom()}>{room.closed?'Открыть приглашения':'Закрыть приглашения'}</button>}
        </section>
        {isOwner&&<section className="ays-room-danger">
          <h3>Удаление комнаты</h3>
          <p>Комната и журнал бросков будут удалены. Листы персонажей сохранятся.</p>
          <button type="button" disabled={busy} onClick={()=>void deleteRoom()}><Trash2 size={16}/> Удалить комнату</button>
        </section>}
        {!isOwner&&roomMembersOwn.length>0&&<section><h3>Участие</h3><p>Вы можете покинуть комнату во вкладке «Игроки и персонажи».</p></section>}
      </div>}

    </section>:<>
      <section className="ays-rooms-overview" aria-labelledby="ays-my-rooms">
        <div className="ays-rooms-overview-heading">
          <div>
            <h2 id="ays-my-rooms">Мои комнаты <span>({rooms.length})</span></h2>
            <p>Выбери комнату, чтобы продолжить игру или управлять персонажами.</p>
          </div>
          <div className="ays-rooms-overview-actions">
            <button type="button" className="ays-rooms-join-button" onClick={()=>setDialog('join')}><UserPlus size={16}/> Подключиться по коду</button>
            <button type="button" className="ays-rooms-create-button" onClick={()=>setDialog('create')}><Plus size={17}/> Создать комнату</button>
          </div>
        </div>
        {loading?<p className="ays-room-empty" role="status">Загружаем комнаты…</p>:sortedRooms.length===0?
          <div className="ays-rooms-empty">
            <Users size={30}/>
            <p>Пока нет комнат. Создай свою или присоединись по коду мастера.</p>
          </div>:
          <div className="ays-room-cards">{sortedRooms.map(item=><button type="button"
            className="ays-room-tile" key={item.id}
            onClick={()=>{setSelected(item.id);setRoomTab('table');setMembers([]);setRolls([]);setError('');}}>
            <span className="ays-room-tile-avatar"><Users size={23}/></span>
            <span className="ays-room-tile-body">
              <strong>{item.title}</strong>
              <span className={'ays-room-system-pill ays-room-system-'+item.system}>{systemLabels[item.system]}</span>
              <small><Users size={14}/> {roomCounts[item.id]??0} участников{item.closed?' · Приглашения закрыты':''}</small>
            </span>
            <ChevronRight className="ays-room-tile-arrow" size={23}/>
          </button>)}</div>}
      </section>
      {dialog&&<div className="ays-room-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setDialog(null);}}>
        <section className="ays-room-dialog" role="dialog" aria-modal="true" aria-labelledby="ays-room-dialog-title">
          <div className="ays-room-dialog-header">
            <h2 id="ays-room-dialog-title">{dialog==='create'?'Создать комнату':'Подключить персонажа'}</h2>
            <button type="button" onClick={()=>setDialog(null)} disabled={busy} aria-label="Закрыть окно"><X size={20}/></button>
          </div>
          {dialog==='create'?<form onSubmit={event=>void createRoom(event)}>
            <label>Название комнаты
              <input autoFocus maxLength={100} minLength={1} required
                placeholder="Например, Кампания в Абсаломе" value={createTitle} onChange={e=>setCreateTitle(e.target.value)}/>
            </label>
            <label>Игровая система
              <select value={createSystem} onChange={e=>setCreateSystem(e.target.value as RoomSystem)}>
                <option value="pf2e">Pathfinder 2e</option><option value="prmoon">Project Moon</option>
              </select>
            </label>
            <div className="ays-room-dialog-actions">
              <button type="button" onClick={()=>setDialog(null)} disabled={busy}>Отмена</button>
              <button type="submit" className="ays-room-dialog-primary" disabled={busy||!createTitle.trim()}><Plus size={16}/> Создать комнату</button>
            </div>
          </form>:<form onSubmit={event=>void joinRoom(event)}>
            <label>Код комнаты
              <input autoFocus required minLength={8} maxLength={8} autoCapitalize="characters" autoComplete="off"
                value={inviteCode} placeholder="8 символов" onChange={e=>setInviteCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))}/>
            </label>
            <label>Персонаж
              <select required value={inviteCharacter} onChange={e=>setInviteCharacter(e.target.value)}>
                <option value="">Выбрать персонажа</option>
                {eligible.map(c=><option key={c.id} value={c.id}>{c.name} · {systemLabels[c.system as RoomSystem]}</option>)}
              </select>
            </label>
            <div className="ays-room-dialog-actions">
              <button type="button" onClick={()=>setDialog(null)} disabled={busy}>Отмена</button>
              <button type="submit" className="ays-room-dialog-primary" disabled={busy||inviteCode.length!==8||!inviteCharacter}><UserPlus size={16}/> Подключиться</button>
            </div>
          </form>}
        </section>
      </div>}
    </>}
  </main>;
}
