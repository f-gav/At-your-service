import {roomViewState,distinctRoomUsers} from './room-state';
import {requireRoomMutationRows} from './room-action-guard';
import {roomOverviewRequests,roomDetailRequests,createRoomRow,joinRoomByCode,leaveRoomRow,updateRoomRollPermissions,renameRoomRow,setRoomClosed,deleteRoomRow} from './room-repository';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useModalAccessibility} from '../../lib/use-modal-accessibility';
import {ArrowLeft,Copy,Dices,LogOut,Plus,RefreshCw,Shield,Trash2,Users,X,LayoutDashboard,Settings,Save,ChevronRight,UserPlus} from 'lucide-react';
import type {Character} from '../../lib/models';
import {supabase} from '../../lib/supabase';
import {takeRoomRequestPermit} from '../../lib/room-request-guard';
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
const roomBadgeLabels:Record<RoomSystem,string>={pf2e:'Pathfinder 2e',prmoon:'Project Moon'};
function participantLabel(n:number):string {
  const m100=n%100,m10=n%10;
  return m100>=11&&m100<=14?'участников':m10===1?'участник':m10>=2&&m10<=4?'участника':'участников';
}
const friendlyError=(error:unknown)=>{
  const message=error&&typeof error==='object'&&'message'in error?String(error.message):String(error);
  if(/Could not find the table|schema cache|PGRST205|Could not find the function/.test(message))
    return 'Комнаты ещё не подключены к Supabase. Необходимо применить миграцию supabase/migrations/20261026_game_rooms.sql к базе At your service!.';
  if(/already in this room|already in a room|duplicate key/i.test(message))return 'Этот персонаж уже подключён к этой комнате.';
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
  const overviewRequest=useRef(0);
  const roomRequest=useRef(0);
  const activeRoom=useRef<string|null>(null);
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
  const operationLock=useRef(false);
  const [loading,setLoading]=useState(false);
  const [roomTab,setRoomTab]=useState<'table'|'players'|'settings'>('table');
  const [roomTitleDraft,setRoomTitleDraft]=useState('');
  const room=rooms.find(r=>r.id===selected);
  const viewState=roomViewState(userId,selected,room??null,members);
  const isOwner=viewState.canManage;
  const roomMembersOwn=members.filter(m=>m.user_id===userId);
  const eligible=characters.filter(c=>c.system==='pf2e'||c.system==='prmoon');
  const sortedRooms=useMemo(()=>[...rooms].sort((a,b)=>b.created_at.localeCompare(a.created_at)),[rooms]);
  const roomMembershipCounts=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const member of mine)counts.set(member.character_id,(counts.get(member.character_id)??0)+1);
    return counts;
  },[mine]);
  useModalAccessibility(!!dialog,()=>{setDialog(null);setError('');},busy);
  const loadOverview=useCallback(async()=>{
    const request=++overviewRequest.current;
    if(!supabase||!userId){setRooms([]);setMine([]);setRoomCounts({});return;}
    const [roomsResponse,mineResponse,countsResponse]=await roomOverviewRequests(userId);
    if(request!==overviewRequest.current)return;
    if(roomsResponse.error||mineResponse.error)throw roomsResponse.error??mineResponse.error;
    const availableRooms=(roomsResponse.data??[]) as Room[];
    setRooms(availableRooms);
    // Clear a selected room that has been removed or is no longer visible through RLS.
    setSelected(current=>current&&!availableRooms.some(item=>item.id===current)?null:current);
    setMine((mineResponse.data??[]) as Member[]);
    // Count distinct players, not sheets. A user can attach several characters.
    // Counts come only from rows that existing room-member RLS makes readable.
    if(!countsResponse.error)setRoomCounts(distinctRoomUsers(countsResponse.data??[]));
    else setRoomCounts({});
  },[userId]);
  const loadRoom=useCallback(async(roomId:string)=>{
    if(!supabase||!userId)return;
    const request=++roomRequest.current;
    const [people,events]=await roomDetailRequests(roomId);
    if(request!==roomRequest.current||activeRoom.current!==roomId)return;
    if(people.error||events.error)throw people.error??events.error;
    setMembers((people.data??[]) as Member[]);
    setRolls((events.data??[]) as Roll[]);
  },[userId]);
  useEffect(()=>{
    if(!userId){
      // Clear private room data before the next account can view this component.
      ++overviewRequest.current;++roomRequest.current;activeRoom.current=null;
      setRooms([]);setMine([]);setRoomCounts({});setMembers([]);setRolls([]);
      setSelected(null);setError('');setLoading(false);
      return;
    }
    let active=true;
    setLoading(true);
    void loadOverview().catch(cause=>{if(active)setError(friendlyError(cause));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;++overviewRequest.current;};
  },[loadOverview,userId]);
  useEffect(()=>{
    activeRoom.current=selected;
    ++roomRequest.current;
    if(!selected||!userId||!supabase){setMembers([]);setRolls([]);return;}
    const client=supabase;
    let live=true;
    const refresh=()=>{void loadRoom(selected).catch(cause=>{if(live)setError(friendlyError(cause));});};
    refresh();
    const channel=client.channel('ays-room-'+selected)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_room_members',filter:'room_id=eq.'+selected},refresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_room_rolls',filter:'room_id=eq.'+selected},refresh)
      .subscribe(status=>{if(status==='SUBSCRIBED'&&live)refresh();});
    // Fallback when Realtime is unavailable or network reconnects.
    const timer=window.setInterval(()=>{if(document.visibilityState!=='hidden'){refresh();void loadOverview().catch(()=>{});}},8000);
    const reconnect=()=>{if(!live)return;refresh();void loadOverview().catch(()=>{});};
    const visible=()=>{if(document.visibilityState==='visible')reconnect();};
    window.addEventListener('online',reconnect);
    document.addEventListener('visibilitychange',visible);
    return()=>{live=false;++roomRequest.current;window.clearInterval(timer);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',visible);void client.removeChannel(channel);};
  },[selected,userId,loadRoom,loadOverview]);
  async function operate(action:()=>Promise<void>){
    // A ref closes the same-tick double-click gap before React renders busy=true.
    if(operationLock.current)return;
    operationLock.current=true;setBusy(true);setError('');
    try{await action();await loadOverview();if(activeRoom.current)await loadRoom(activeRoom.current);}
    catch(cause){setError(friendlyError(cause));
      // A failed optimistic write may mean another session already changed the row.
      try{await loadOverview();if(activeRoom.current)await loadRoom(activeRoom.current);}catch{ /* Keep original error. */ }
    }
    finally{operationLock.current=false;setBusy(false);}
  }
  async function createRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!userId)return;
    await operate(async()=>{
      const {data,error:failure}=await createRoomRow(userId,createTitle.trim(),createSystem);
      if(failure||!data)throw failure??new Error('Не удалось создать комнату');
      activeRoom.current=data.id;
      setMembers([]);setRolls([]);
      setSelected(data.id);setRoomTab('table');setCreateTitle('');setDialog(null);
    });
  }
  async function joinRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!inviteCharacter||!eligible.some(c=>c.id===inviteCharacter))return;
    // Browser-only burst guard. RPC must also enforce limits on the server.
    if(!takeRoomRequestPermit('join')){
      setError('Слишком много попыток входа. Повтори попытку через несколько секунд.');return;
    }
    await operate(async()=>{
      const {data,error:failure}=await joinRoomByCode(inviteCode,inviteCharacter);
      if(failure||!data)throw failure??new Error('Не удалось подключить персонажа');
      activeRoom.current=data as string;
      setMembers([]);setRolls([]);
      setSelected(data as string);setRoomTab('table');setInviteCode('');setInviteCharacter('');setDialog(null);
    });
  }
  async function leaveRoom(member:Member){
    if(!supabase)return;
    if(!window.confirm(member.user_id===userId?'Вывести своего персонажа из комнаты?':'Исключить персонажа из комнаты?'))return;
    await operate(async()=>{
      const {data,error:failure}=await leaveRoomRow(member.room_id,member.character_id);
      requireRoomMutationRows(data,failure,'Персонаж уже покинул комнату или нет разрешения на исключение.');
    });
  }
  async function toggleRolls(member:Member){
    if(!supabase||!userId||member.user_id!==userId)return;
    await operate(async()=>{
      const {data,error:failure}=await updateRoomRollPermissions(member.room_id,member.character_id,userId,!member.casts_enabled);
      requireRoomMutationRows(data,failure,'Разрешение на броски уже изменилось в другой вкладке.');
    });
  }
  async function renameRoom(event:FormEvent){
    event.preventDefault();
    if(!supabase||!room||!isOwner||!roomTitleDraft.trim())return;
    await operate(async()=>{
      const {data,error:failure}=await renameRoomRow(room.id,roomTitleDraft.trim(),room.title,userId!);
      requireRoomMutationRows(data,failure,'Название комнаты изменилось в другой вкладке или у вас больше нет прав.');
    });
  }
  async function closeRoom(){
    if(!supabase||!room||!isOwner)return;
    const next=!room.closed;
    await operate(async()=>{
      const {data,error:failure}=await setRoomClosed(room.id,next,userId!);
      requireRoomMutationRows(data,failure,'Доступ в комнату уже изменился в другой вкладке или у вас больше нет прав.');
    });
  }
  async function deleteRoom(){
    if(!supabase||!room||!isOwner||!window.confirm('Удалить комнату и историю бросков? Листы персонажей останутся без изменений.'))return;
    await operate(async()=>{
      const {data,error:failure}=await deleteRoomRow(room.id,userId!);
      requireRoomMutationRows(data,failure,'Комната уже удалена или у вас больше нет прав.');
      activeRoom.current=null;
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
      <button type="button" onClick={()=>{if(loading)return;setLoading(true);setError('');
        void loadOverview().catch(cause=>setError(friendlyError(cause))).finally(()=>setLoading(false));}}
        disabled={loading} title="Обновить список" aria-label="Обновить комнаты"><RefreshCw size={20}/></button>
    </div>}
    {error&&!dialog&&<div className="ays-room-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Закрыть ошибку"><X size={16}/></button></div>}
    {selected&&room?<section className="ays-room-open">
      <header className="ays-room-topline">
        <div className="ays-room-identity">
          <button type="button" className="ays-room-back" onClick={()=>{activeRoom.current=null;setSelected(null);setError('');}}><ArrowLeft size={16}/> Комнаты</button>
          <h2>{room.title}</h2>
          <span className={'ays-room-system ays-room-system-'+room.system}>{roomBadgeLabels[room.system]}</span>
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
          <h3 className="ays-room-characters-title">Персонажи</h3>
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
            <button type="button" className="ays-rooms-join-button" onClick={()=>{setError('');setDialog('join');}}><UserPlus size={16}/> Подключиться по коду</button>
            <button type="button" className="ays-rooms-create-button" onClick={()=>{setError('');setDialog('create');}}><Plus size={17}/> Создать комнату</button>
          </div>
        </div>
        {loading?<p className="ays-room-empty" role="status">Загружаем комнаты…</p>:sortedRooms.length===0?
          <div className="ays-rooms-empty">
            <Users size={30}/>
            <p>Пока нет комнат. Создай свою или присоединись по коду мастера.</p>
          </div>:
          <div className="ays-room-cards">{sortedRooms.map(item=><button type="button"
            className="ays-room-tile" key={item.id}
            onClick={()=>{activeRoom.current=item.id;setSelected(item.id);setRoomTab('table');setMembers([]);setRolls([]);setError('');}}>
            <span className="ays-room-tile-body">
              <strong>{item.title}</strong>
              <span className={'ays-room-system-pill ays-room-system-'+item.system}>{roomBadgeLabels[item.system]}</span>
              <small><Users size={14}/> {roomCounts[item.id]??0} {participantLabel(roomCounts[item.id]??0)}{item.closed?' · Приглашения закрыты':''}</small>
            </span>
            <ChevronRight className="ays-room-tile-arrow" size={23}/>
          </button>)}</div>}
      </section>
      {dialog&&<div className="ays-room-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setDialog(null);}}>
        <section className="ays-room-dialog" role="dialog" aria-modal="true" aria-labelledby="ays-room-dialog-title" aria-busy={busy}>
          <div className="ays-room-dialog-header">
            <h2 id="ays-room-dialog-title">{dialog==='create'?'Создать комнату':'Подключить персонажа'}</h2>
            <button type="button" onClick={()=>setDialog(null)} disabled={busy} aria-label="Закрыть окно"><X size={20}/></button>
          </div>
          {error&&<p className="ays-room-dialog-error" role="alert">{error}</p>}
          {dialog==='create'?<form onSubmit={event=>void createRoom(event)}>
            <label>Название комнаты
              <input autoFocus maxLength={100} minLength={1} required
                placeholder="Например, Запалка" value={createTitle} onChange={e=>setCreateTitle(e.target.value)}/>
            </label>
            <label>Игровая система
              <select value={createSystem} onChange={e=>setCreateSystem(e.target.value as RoomSystem)}>
                <option value="pf2e">Pathfinder 2e</option><option value="prmoon">Project Moon</option>
              </select>
            </label>
            <div className="ays-room-dialog-actions">
              <button type="button" onClick={()=>setDialog(null)} disabled={busy}>Отмена</button>
              <button type="submit" className="ays-room-dialog-primary" disabled={busy||!createTitle.trim()}><Plus size={16}/> {busy?'Создаём…':'Создать комнату'}</button>
            </div>
          </form>:<form onSubmit={event=>void joinRoom(event)}>
            <label>Код комнаты
              <input autoFocus required minLength={8} maxLength={8} autoCapitalize="characters" autoComplete="off"
                value={inviteCode} placeholder="8 символов" onChange={e=>setInviteCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))}/>
            </label>
            <label>Персонаж
              <select required value={inviteCharacter} onChange={e=>setInviteCharacter(e.target.value)}>
                <option value="">Выбрать персонажа</option>
                {eligible.map(c=><option key={c.id} value={c.id}>{c.name} · {systemLabels[c.system as RoomSystem]}{roomMembershipCounts.get(c.id)?' · комнат: '+roomMembershipCounts.get(c.id):''}</option>)}
              </select>
            </label>
            <div className="ays-room-dialog-actions">
              <button type="button" onClick={()=>setDialog(null)} disabled={busy}>Отмена</button>
              <button type="submit" className="ays-room-dialog-primary" disabled={busy||inviteCode.length!==8||!inviteCharacter}><UserPlus size={16}/> {busy?'Подключаем…':'Подключиться'}</button>
            </div>
          </form>}
        </section>
      </div>}
    </>}
  </main>;
}
