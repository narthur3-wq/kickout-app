<script>
  import Pitch from './Pitch.svelte';
  import { events, meta } from '../stores.js';
  import { zoneCode } from './field.js';

  let side = 'us';
  let overlayFilter = '';
  let showNumbers = true;

  const norm = s => (s||'').trim().toLowerCase();

  $: sideEventsAll = $events.filter(e=>e.side===side);
  $: filtered = overlayFilter
      ? (side==='us'
        ? sideEventsAll.filter(e => norm(e.target_player)===norm(overlayFilter))
        : sideEventsAll.filter(e => norm(e.presser_player)===norm(overlayFilter) || norm(e.opponent_receiver)===norm(overlayFilter)))
      : sideEventsAll;

  $: overlays = filtered.map((e,i)=>({ x:e.x, y:e.y, idx: filtered.length - i, ct:e.contest_type, side:e.side, win:!!e.win }));

  // Big numbers
  $: total = sideEventsAll.length;
  $: wins = side==='us' ? sideEventsAll.filter(e=>e.win).length : sideEventsAll.filter(e=>!e.win).length;
  $: pct = total ? Math.round(100 * wins / total) : 0;

  const ZONES = ['Left','Centre','Right'];
  const DEPTHS = ['Short','Medium','Long','Very Long'];
  function buildZoneMap() {
    const map = new Map();
    for (const e of sideEventsAll) {
      const code = zoneCode(e.x, e.y, $meta.kicking_goal_top);
      const m = map.get(code) || { tot:0, win:0 };
      m.tot++; if (side==='us' ? e.win : !e.win) m.win++;
      map.set(code, m);
    }
    return map;
  }
  $: zoneMap = buildZoneMap();

  $: ourReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='us').map(e=>e.target_player).filter(Boolean))).sort();
  $: presserChoices = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.presser_player).filter(Boolean))).sort();
  $: oppReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.opponent_receiver).filter(Boolean))).sort();
</script>

<!-- (template + styles exactly as provided in previous message) -->

