<script>
  import Pitch from './Pitch.svelte';
  import { events, meta } from '../stores.js';
  import { onMount } from 'svelte';
  import { jerseyNums, toMetersX, toMetersY, depthFromKickerGoal, sideBand, depthBand, zoneCode } from './field.js';

  const SIDES = ['us','opp'];
  const CONTESTS = [
    { key:'clean', label:'Clean' },
    { key:'break', label:'Break' },
    { key:'foul',  label:'Foul'  },
    { key:'out',   label:'Sideline' }
  ];

  let side='us';
  let contest='clean';
  let win=true;

  let landing={x:NaN,y:NaN};
  let targetPlayer='';
  let presserPlayer='';
  let oppReceiver='';

  let showNumbers=true;
  let overlayFilter='';

  // Wake-lock
  let lock=null;
  async function ensureWake() {
    if (!$meta.wake_lock || !('wakeLock' in navigator)) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch {}
  }
  onMount(() => {
    ensureWake();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) ensureWake();
    });
  });

  $: $meta;

  function onLanding(e){ landing=e.detail; }
  function clearPoints(){ landing={x:NaN,y:NaN}; }

  function validate(){
    if (Number.isNaN(landing.x)||Number.isNaN(landing.y)) return 'Tap the pitch to set landing.';
    return '';
  }

  function buildEvent(){
    const d = depthFromKickerGoal(landing.y, $meta.kicking_goal_top);
    return {
      id: Date.now(),
      created_at: new Date().toISOString(),
      match_date: new Date().toISOString().slice(0,10),
      team: $meta.team, opponent: $meta.opponent,
      side,
      contest_type: contest,
      win,
      x: landing.x, y: landing.y, x_m: toMetersX(landing.x), y_m: toMetersY(landing.y),
      side_band: sideBand(landing.x), depth_band: depthBand(d), zone_code: zoneCode(landing.x, landing.y, $meta.kicking_goal_top),
      kicking_goal_top: $meta.kicking_goal_top,
      target_player: side==='us' ? (targetPlayer||'') : '',
      presser_player: side==='opp' ? (presserPlayer||'') : '',
      opponent_receiver: side==='opp' ? (oppReceiver||'') : ''
    };
  }

  function saveEvent(){
    const err=validate(); if (err){ alert(err); return; }
    events.update(list => [buildEvent(), ...list]);
    clearPoints();
    if (side==='us') targetPlayer=''; else { presserPlayer=''; oppReceiver=''; }
    navigator.vibrate?.(20);
  }
  function undoLast(){ events.update(list => list.slice(1)); }
  function delEvent(id){ if(!confirm('Delete this event?')) return; events.update(list => list.filter(e=>e.id!==id)); }
  function loadToForm(e){
    side = e.side; win = !!e.win; contest = e.contest_type;
    targetPlayer = e.target_player||''; presserPlayer = e.presser_player||''; oppReceiver = e.opponent_receiver||'';
    landing = { x:e.x, y:e.y };
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function exportCSV(){
    const headers=['id','created_at','match_date','team','opponent','side','contest_type','win','x','y','x_m','y_m','side_band','depth_band','zone_code','kicking_goal_top','target_player','presser_player','opponent_receiver'];
    const rows=[headers.join(',')].concat(
      $events.map(e=>headers.map(h=>{
        const v=e[h];
        return (typeof v==='number' || typeof v==='boolean') ? String(v) : '"'+String(v??'').replace(/"/g,'""')+'"';
      }).join(','))
    ).join('\n');
    const url=URL.createObjectURL(new Blob([rows],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download='kickouts.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // Overlay + KPIs
  const norm = s => (s||'').trim().toLowerCase();

  $: sideEventsAll = $events.filter(e=>e.side===side);
  $: filteredForOverlay = side==='us'
      ? sideEventsAll.filter(e => overlayFilter ? norm(e.target_player)===norm(overlayFilter) : true)
      : sideEventsAll.filter(e => overlayFilter ? (norm(e.presser_player)===norm(overlayFilter) || norm(e.opponent_receiver)===norm(overlayFilter)) : true);

  $: overlays = filteredForOverlay.map((e,i)=>({
    x:e.x, y:e.y, idx: filteredForOverlay.length - i,
    ct:e.contest_type, side:e.side, win:!!e.win
  }));

  $: ourPlayerStats = (()=> {
    const map=new Map();
    for (const e of $events){ if (e.side!=='us') continue; const key=norm(e.target_player); if(!key) continue;
      const m=map.get(key)||{label:(e.target_player||'—'), tot:0, win:0};
      m.tot++; if (e.win) m.win++; map.set(key,m);
    }
    return Array.from(map.values()).sort((a,b)=>b.tot-a.tot);
  })();

  $: presserStats = (()=> {
    const map=new Map();
    for (const e of $events){ if (e.side!=='opp') continue; const key=norm(e.presser_player); if(!key) continue;
      const m=map.get(key)||{label:(e.presser_player||'—'), tot:0, win:0};
      m.tot++; if (!e.win) m.win++; map.set(key,m); // press win = their loss
    }
    return Array.from(map.values()).sort((a,b)=>b.tot-a.tot);
  })();

  // choices for datalists
  $: ourReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='us').map(e=>e.target_player).filter(Boolean))).sort();
  $: presserChoices = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.presser_player).filter(Boolean))).sort();
  $: oppReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.opponent_receiver).filter(Boolean))).sort();
</script>

<!-- (template + styles omitted for brevity since identical to prior message) -->
<!-- Use the same <div class="container"> … </div> and <style> … </style> content I provided above. -->
