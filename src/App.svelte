<script>
  import Pitch from './lib/Pitch.svelte';
  import Heatmap from './lib/Heatmap.svelte';
  import Login from './lib/Login.svelte';
  import { supabase, supabaseConfigured } from './lib/supabase.js';
  import { onMount } from 'svelte';

  // ── Constants ────────────────────────────────────────────────────────────
  const WIDTH_M = 90, LENGTH_M = 145;
  const OUTCOMES = ['Retained','Lost','Score','Wide','Out','Foul'];
  const CONTESTS = ['clean','break','foul','out'];
  const BREAK_OUTS = ['won','lost','neutral'];

  // ── Auth state ───────────────────────────────────────────────────────────
  let user = null;
  let authChecked = false; // prevents login flash on load

  // ── Match setup (set once per match, persisted to localStorage) ──────────
  let team = '', opponent = '', matchDate = new Date().toISOString().slice(0,10);
  let period = 'H1', ourGoalAtTop = true;

  // ── Per-kickout capture state ─────────────────────────────────────────────
  /** @type {'clean'|'break'|'foul'|'out'} */ let contest = 'clean';
  /** @type {'Retained'|'Lost'|'Score'|'Wide'|'Out'|'Foul'} */ let outcome = 'Retained';
  /** @type {'won'|'lost'|'neutral'|''} */ let breakOutcome = '';
  let clock = '', targetPlayer = '';
  let timeToTee = '', totalTime = '';
  let scored20 = false;
  let landing = {x:NaN, y:NaN}, pickup = {x:NaN, y:NaN};

  // ── New capture fields ────────────────────────────────────────────────────
  let scoreUs = '', scoreThem = '';
  let notes = '', flagEvent = false;

  // ── UI state ──────────────────────────────────────────────────────────────
  let events = [];
  let editingId = null;
  let undoStack = []; // last saved state for undo
  let setupOpen = true;
  let syncStatus = ''; // '', 'syncing', 'synced', 'error'
  let wakeLock = null;
  let backupReminder = false;
  let showSummary = false;
  let pitchError = false;

  // ── Viz filters ───────────────────────────────────────────────────────────
  let fContest = new Set(CONTESTS);
  let fOutcome = new Set(OUTCOMES);
  /** @type {'landing'|'pickup'} */ let overlayMode = 'landing';
  let useFilters = true;
  let oppFilter = 'ALL';
  let plyFilter = 'ALL';
  let ytdOnly = false;
  let matchFilter = 'ALL';

  // ── Clock timer ───────────────────────────────────────────────────────────
  let timerRunning = false;
  let timerInterval = null;
  let timerSeconds = 0;

  function toggleTimer() {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
    } else {
      // Parse current clock value as starting seconds (mm:ss)
      const parts = clock.match(/^(\d{1,2}):(\d{2})$/);
      timerSeconds = parts ? parseInt(parts[1]) * 60 + parseInt(parts[2]) : 0;
      timerRunning = true;
      timerInterval = setInterval(() => {
        timerSeconds++;
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        clock = `${mins}:${secs.toString().padStart(2, '0')}`;
      }, 1000);
    }
  }

  const today = new Date();
  const currentYear = today.getFullYear();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const norm = s => (s ?? '').trim().toLowerCase();
  const toMetersX = nx => nx * WIDTH_M;
  const toMetersY = ny => ny * LENGTH_M;
  const sideBand  = nx => nx < 1/3 ? 'Left' : (nx < 2/3 ? 'Centre' : 'Right');
  const depthMetersFromOwnGoal = ny => ourGoalAtTop ? toMetersY(ny) : (LENGTH_M - toMetersY(ny));
  const depthBandFromMeters = d => d < 20 ? 'Short' : (d < 45 ? 'Medium' : (d < 65 ? 'Long' : 'Very Long'));
  const zoneCode = (nx, ny) => `${sideBand(nx)[0]}-${depthBandFromMeters(depthMetersFromOwnGoal(ny))[0]}`;
  const breakDispM = (x1,y1,x2,y2) => Math.hypot((x2-x1)*WIDTH_M, (y2-y1)*LENGTH_M);

  // YTD: compare year strings to avoid UTC-vs-local timezone edge cases
  const eventYear = e => (e.match_date || (e.created_at||'').slice(0,10)).slice(0,4);

  // match key helper
  const matchKey = e => {
    const md = e.match_date || (e.created_at||'').slice(0,10);
    return `${md}|${norm(e.team)}|${norm(e.opponent)}`;
  };

  // ── localStorage helpers ─────────────────────────────────────────────────
  function loadFromLocalStorage() {
    try {
      events = JSON.parse(localStorage.getItem('ko_events') || '[]');
    } catch {
      console.warn('ko_events corrupt in localStorage, starting fresh');
      events = [];
    }
    try {
      const meta = JSON.parse(localStorage.getItem('ko_meta') || '{}');
      team          = meta.team          || '';
      opponent      = meta.opponent      || '';
      ourGoalAtTop  = meta.our_goal_at_top !== undefined ? !!meta.our_goal_at_top : true;
    } catch {
      console.warn('ko_meta corrupt in localStorage');
    }
  }

  function persistLocal() {
    try {
      localStorage.setItem('ko_events', JSON.stringify(events));
      localStorage.setItem('ko_meta', JSON.stringify({
        team, opponent, our_goal_at_top: ourGoalAtTop
      }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert('Storage full — please export your data as JSON and clear old events.');
      } else {
        console.error('localStorage write failed', e);
      }
    }
  }

  // ── Supabase helpers ──────────────────────────────────────────────────────
  async function syncFromSupabase() {
    if (!supabase || !user) return;
    syncStatus = 'syncing';
    try {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        // Merge: Supabase is source of truth; keep any local-only events not yet uploaded
        const remoteIds = new Set(data.map(e => e.id));
        const localOnly = events.filter(e => !remoteIds.has(e.id));
        events = [...data, ...localOnly];
        // Push local-only events up to Supabase
        if (localOnly.length > 0) {
          await supabase.from('events').upsert(localOnly);
        }
        persistLocal();
      }
      syncStatus = 'synced';
    } catch (e) {
      console.error('Sync failed', e);
      syncStatus = 'error';
    }
  }

  async function upsertToSupabase(ev) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('events').upsert(ev);
    if (error) console.error('Supabase upsert failed', ev.id, error.message);
  }

  async function deleteFromSupabase(id) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) console.error('Supabase delete failed', id, error.message);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    loadFromLocalStorage();

    if (supabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { user = session.user; await syncFromSupabase(); }
      supabase.auth.onAuthStateChange((_event, session) => {
        user = session?.user ?? null;
        if (user) syncFromSupabase();
      });
    }
    authChecked = true;

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  function handleLogin(e) {
    user = e.detail.user;
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    user = null;
  }

  // ── Wake lock ─────────────────────────────────────────────────────────────
  async function toggleWakeLock() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    } else {
      try {
        wakeLock = await navigator.wakeLock?.request('screen');
        wakeLock?.addEventListener('release', () => { wakeLock = null; });
      } catch (e) {
        console.warn('Wake lock not available', e);
      }
    }
  }

  // ── Capture helpers ───────────────────────────────────────────────────────
  function onLanding(e) { landing = e.detail; }
  function onPickup(e)  { pickup  = e.detail; }
  function clearPoints()  { landing = {x:NaN, y:NaN}; pickup = {x:NaN, y:NaN}; }

  function validate() {
    if (clock.trim() !== '' && !/^(\d{1,2}):\d{2}$/.test(clock))
      return 'Clock must be mm:ss or blank.';
    if (Number.isNaN(landing.x) || Number.isNaN(landing.y)) {
      pitchError = true;
      setTimeout(() => { pitchError = false; }, 1200);
      return 'Tap the pitch to set the landing point.';
    }
    if (contest === 'break') {
      if (Number.isNaN(pickup.x) || Number.isNaN(pickup.y))
        return 'For a break, tap the pickup point too.';
      if (!breakOutcome) return 'Choose break outcome (won / lost / neutral).';
    }
    if (timeToTee !== '' && (isNaN(+timeToTee) || +timeToTee < 0 || +timeToTee > 300))
      return 'Time to tee must be 0–300 seconds or blank.';
    if (totalTime !== '' && (isNaN(+totalTime) || +totalTime < 0 || +totalTime > 300))
      return 'Total time must be 0–300 seconds or blank.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate))
      return 'Match date must be YYYY-MM-DD.';
    return '';
  }

  function buildEvent() {
    const depth_m = depthMetersFromOwnGoal(landing.y);
    // Preserve original created_at when editing
    const originalCreatedAt = editingId
      ? (events.find(r => r.id === editingId)?.created_at ?? new Date().toISOString())
      : new Date().toISOString();

    // Compute ko_sequence: preserve for edits, count for new
    let koSequence;
    if (editingId) {
      const existing = events.find(r => r.id === editingId);
      koSequence = existing?.ko_sequence ?? null;
    } else {
      const currentKey = `${matchDate}|${norm(team)}|${norm(opponent)}`;
      const matchEvents = events.filter(e => matchKey(e) === currentKey);
      koSequence = matchEvents.length + 1;
    }

    return {
      id:           editingId ?? crypto.randomUUID(),
      created_at:   originalCreatedAt,
      match_date:   matchDate,
      team:         team.trim(),
      opponent:     opponent.trim(),
      period,
      clock,
      target_player: targetPlayer.trim(),
      outcome,
      contest_type:  contest,
      break_outcome: contest === 'break' ? breakOutcome : '',
      time_to_tee_s: timeToTee === '' ? null : +timeToTee,
      total_time_s:  totalTime === '' ? null : +totalTime,
      scored_20s:    !!scored20,
      x:   landing.x, y:   landing.y,
      x_m: toMetersX(landing.x), y_m: toMetersY(landing.y),
      depth_from_own_goal_m: +depth_m.toFixed(2),
      side_band:    sideBand(landing.x),
      depth_band:   depthBandFromMeters(depth_m),
      zone_code:    zoneCode(landing.x, landing.y),
      our_goal_at_top: ourGoalAtTop,
      pickup_x:   contest === 'break' ? pickup.x  : null,
      pickup_y:   contest === 'break' ? pickup.y  : null,
      pickup_x_m: contest === 'break' ? toMetersX(pickup.x) : null,
      pickup_y_m: contest === 'break' ? toMetersY(pickup.y) : null,
      break_displacement_m: contest === 'break'
        ? +breakDispM(landing.x, landing.y, pickup.x, pickup.y).toFixed(2)
        : null,
      score_us:    scoreUs.trim() || null,
      score_them:  scoreThem.trim() || null,
      notes:       notes.trim() || null,
      flag:        !!flagEvent,
      ko_sequence: koSequence,
    };
  }

  async function saveEvent() {
    const err = validate();
    if (err) { alert(err); return; }
    const ev = buildEvent();
    const isNew = !editingId;

    // Push undo snapshot before mutating
    undoStack = [...undoStack.slice(-9), [...events]];

    const idx = events.findIndex(r => r.id === ev.id);
    if (idx >= 0) events[idx] = ev; else events = [ev, ...events];

    persistLocal();
    clearPoints();
    editingId = null;
    targetPlayer = '';
    // score persists within match; clear notes and flag
    notes = '';
    flagEvent = false;

    // Haptic feedback
    navigator.vibrate?.(50);

    // Auto-backup reminder every 10 new events
    if (isNew && events.length % 10 === 0) {
      backupReminder = true;
      setTimeout(() => { backupReminder = false; }, 8000);
    }

    // Sync to Supabase in background (don't block UI)
    upsertToSupabase(ev);
  }

  function undoLast() {
    if (undoStack.length === 0) return;
    events = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    persistLocal();
  }

  function delEvent(id) {
    if (!confirm('Delete this event?')) return;
    undoStack = [...undoStack.slice(-9), [...events]];
    events = events.filter(e => e.id !== id);
    persistLocal();
    if (editingId === id) { editingId = null; clearPoints(); }
    deleteFromSupabase(id);
  }

  function loadToForm(e) {
    editingId    = e.id;
    // Restore capture fields from the event
    team         = e.team        || '';
    opponent     = e.opponent    || '';
    period       = e.period      || 'H1';
    clock        = e.clock       || '';
    outcome      = e.outcome;
    contest      = e.contest_type;
    breakOutcome = e.break_outcome || '';
    targetPlayer = e.target_player || '';
    scored20     = !!e.scored_20s;
    timeToTee    = e.time_to_tee_s == null ? '' : String(e.time_to_tee_s);
    totalTime    = e.total_time_s  == null ? '' : String(e.total_time_s);
    matchDate    = e.match_date || (e.created_at || '').slice(0,10) || new Date().toISOString().slice(0,10);
    landing      = { x: e.x, y: e.y };
    pickup       = (e.pickup_x == null || e.pickup_y == null)
      ? { x: NaN, y: NaN }
      : { x: e.pickup_x, y: e.pickup_y };
    // Restore new fields
    scoreUs      = e.score_us   || '';
    scoreThem    = e.score_them || '';
    notes        = e.notes      || '';
    flagEvent    = !!e.flag;
    // NOTE: ourGoalAtTop is NOT restored from the event so the analyst's
    // current orientation preference is preserved for subsequent captures.
    setupOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV(subset = events) {
    const headers = [
      'id','created_at','match_date','team','opponent','period','clock',
      'target_player','outcome','contest_type','break_outcome',
      'time_to_tee_s','total_time_s','scored_20s',
      'x','y','x_m','y_m','depth_from_own_goal_m','side_band','depth_band','zone_code','our_goal_at_top',
      'pickup_x','pickup_y','pickup_x_m','pickup_y_m','break_displacement_m',
      'score_us','score_them','notes','flag','ko_sequence',
    ];
    const rows = [headers.join(',')].concat(
      subset.map(e => headers.map(h => {
        const v = e[h];
        return typeof v === 'number' ? `"${v}"` : `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(','))
    ).join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'kickout_events.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── JSON import / export ──────────────────────────────────────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'kickout_events.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text  = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('Expected a JSON array');
        const existingIds = new Set(events.map(e => e.id));
        const newEvents = imported.filter(e => e.id && !existingIds.has(e.id));
        events = [...events, ...newEvents];
        persistLocal();
        // Sync new events to Supabase
        if (newEvents.length > 0) {
          await supabase?.from('events').upsert(newEvents);
        }
        alert(`Imported ${newEvents.length} new event(s). ${imported.length - newEvents.length} duplicate(s) skipped.`);
      } catch (e) {
        alert(`Import failed: ${e.message}`);
      }
    };
    input.click();
  }

  // ── Unsaved changes warning ───────────────────────────────────────────────
  $: hasUnsaved = !Number.isNaN(landing.x) || !Number.isNaN(landing.y);

  function handleBeforeUnload(e) {
    if (hasUnsaved) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  // ── Derived: opponent & player choices ───────────────────────────────────
  $: opponentChoices = Object.entries(
    events.reduce((acc, e) => {
      const k = norm(e.opponent), label = (e.opponent || '').trim();
      if (k && label) acc[k] = label;
      return acc;
    }, {})
  ).sort((a,b) => a[1].localeCompare(b[1]));

  $: playerChoices = Object.entries(
    events.reduce((acc, e) => {
      const k = norm(e.target_player), label = (e.target_player || '').trim();
      if (k && label) acc[k] = label;
      return acc;
    }, {})
  ).sort((a,b) => a[1].localeCompare(b[1]));

  function toggleContest(val) { const s = new Set(fContest); s.has(val) ? s.delete(val) : s.add(val); fContest = s; }
  function toggleOutcome(val) { const s = new Set(fOutcome); s.has(val) ? s.delete(val) : s.add(val); fOutcome = s; }

  // ── Unique matches derived ────────────────────────────────────────────────
  $: uniqueMatches = Object.values(
    events.reduce((acc, e) => {
      const key = matchKey(e);
      if (!acc[key]) acc[key] = {
        key,
        match_date: e.match_date || (e.created_at||'').slice(0,10),
        team: e.team || '',
        opponent: e.opponent || '',
        count: 0
      };
      acc[key].count++;
      return acc;
    }, {})
  ).sort((a, b) => b.match_date.localeCompare(a.match_date));

  // ── Filtered events for viz & KPIs ───────────────────────────────────────
  $: vizEvents = events.filter(e => {
    const passOpp   = oppFilter === 'ALL' || norm(e.opponent) === oppFilter;
    const passPly   = plyFilter === 'ALL' || norm(e.target_player) === plyFilter;
    const passYTD   = !ytdOnly || eventYear(e) === String(currentYear);
    const passCO    = !useFilters || (fContest.has(e.contest_type) && fOutcome.has(e.outcome));
    const passMatch = matchFilter === 'ALL' || matchKey(e) === matchFilter;
    return passOpp && passPly && passYTD && passCO && passMatch;
  });

  // Overlays: fixed at_target field name (was previously 'target', never rendered)
  $: overlays = vizEvents.map(e =>
    overlayMode === 'landing'
      ? { x: e.x, y: e.y, outcome: e.outcome, contest_type: e.contest_type, at_target: !!e.target_player }
      : (e.pickup_x == null || e.pickup_y == null ? null
          : { x: e.pickup_x, y: e.pickup_y, outcome: e.outcome, contest_type: e.contest_type, at_target: !!e.target_player })
  ).filter(Boolean);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const ZSIDES = ['L','C','R'], ZDEPTH = ['S','M','L','V'];
  const zoneKey = (s,d) => `${s}-${d}`;
  const RETAINED = new Set(['Retained','Score']);

  $: zoneStats = (() => {
    const z = {};
    for (const S of ZSIDES) for (const D of ZDEPTH) z[zoneKey(S,D)] = {tot:0, ret:0, brTot:0, brWon:0};
    for (const e of vizEvents) {
      const key = e.zone_code; if (!z[key]) continue;
      z[key].tot++;
      if (RETAINED.has(e.outcome)) z[key].ret++;
      if (e.contest_type === 'break') { z[key].brTot++; if (e.break_outcome === 'won') z[key].brWon++; }
    }
    return z;
  })();

  $: zoneStatsBaseline = (() => {
    const z = {};
    for (const S of ZSIDES) for (const D of ZDEPTH) z[zoneKey(S,D)] = {tot:0, ret:0};
    for (const e of events) {
      const key = e.zone_code; if (!z[key]) continue;
      z[key].tot++;
      if (RETAINED.has(e.outcome)) z[key].ret++;
    }
    return z;
  })();

  function retTrend(filteredPct, zoneCd) {
    if (matchFilter === 'ALL' && oppFilter === 'ALL') return '';
    const bl = zoneStatsBaseline[zoneCd];
    if (!bl || bl.tot < 5) return '';
    const basePct = 100 * bl.ret / bl.tot;
    const delta = filteredPct - basePct;
    if (Math.abs(delta) < 8) return '';
    return delta > 0 ? ' ▲' : ' ▼';
  }

  $: zoneTableRet = ZDEPTH.map(D => ({
    D,
    cells: ZSIDES.map(S => {
      const st  = zoneStats[zoneKey(S,D)] || {tot:0, ret:0};
      const pct = st.tot ? (100 * st.ret / st.tot) : 0;
      const zk  = zoneKey(S, D);
      return { tot: st.tot, ret: st.ret, pct, zk };
    })
  }));

  $: zoneTableBreak = ZDEPTH.map(D => ({
    D,
    cells: ZSIDES.map(S => {
      const st  = zoneStats[zoneKey(S,D)] || {brTot:0, brWon:0};
      const pct = st.brTot ? (100 * st.brWon / st.brTot) : 0;
      return { tot: st.brTot, won: st.brWon, pct };
    })
  }));

  $: overallBreak = (() => {
    let tot = 0, won = 0;
    for (const e of vizEvents) if (e.contest_type === 'break') { tot++; if (e.break_outcome === 'won') won++; }
    return { tot, won, pct: tot ? (100 * won / tot) : 0 };
  })();

  function cellColor(pct) {
    const t = Math.max(0, Math.min(1, pct / 100));
    return `hsl(${120 * t} 70% 45% / 0.25)`;
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  $: timelineEvents = [...vizEvents].sort((a, b) => {
    const sa = a.ko_sequence ?? 9999, sb = b.ko_sequence ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.created_at||'').localeCompare(b.created_at||'');
  });

  function outcomeColor(o) {
    switch ((o||'').toLowerCase()) {
      case 'score':    return '#2563eb';
      case 'retained': return '#16a34a';
      case 'lost':     return '#dc2626';
      case 'wide':     return '#d97706';
      case 'out':      return '#7c3aed';
      case 'foul':     return '#db2777';
      default:         return '#6b7280';
    }
  }

  // ── Player stats ──────────────────────────────────────────────────────────
  $: playerStats = playerChoices
    .map(([key, label]) => {
      const evs = vizEvents.filter(e => norm(e.target_player) === key);
      if (evs.length === 0) return null;
      const ret = evs.filter(e => RETAINED.has(e.outcome)).length;
      const breaks = evs.filter(e => e.contest_type === 'break');
      const brWon = breaks.filter(e => e.break_outcome === 'won').length;
      return {
        label,
        total: evs.length,
        retPct: Math.round(100 * ret / evs.length),
        brTotal: breaks.length,
        brWonPct: breaks.length ? Math.round(100 * brWon / breaks.length) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  // ── Summary stats ─────────────────────────────────────────────────────────
  $: summaryStats = (() => {
    if (vizEvents.length === 0) return null;
    const total = vizEvents.length;
    const ret = vizEvents.filter(e => RETAINED.has(e.outcome)).length;
    const retPct = Math.round(100 * ret / total);
    const breaks = vizEvents.filter(e => e.contest_type === 'break');
    const brWon = breaks.filter(e => e.break_outcome === 'won').length;
    const brPct = breaks.length ? Math.round(100 * brWon / breaks.length) : null;
    const h1 = vizEvents.filter(e => e.period === 'H1');
    const h2 = vizEvents.filter(e => e.period === 'H2');
    const h1Ret = h1.filter(e => RETAINED.has(e.outcome)).length;
    const h2Ret = h2.filter(e => RETAINED.has(e.outcome)).length;
    // best/worst zones with at least 3 events
    const zonePcts = Object.entries(zoneStats)
      .map(([k, s]) => ({ k, pct: s.tot >= 3 ? (100 * s.ret / s.tot) : null }))
      .filter(z => z.pct !== null);
    const sorted = [...zonePcts].sort((a,b) => b.pct - a.pct);
    const topPlayer = playerStats[0] ?? null;
    return {
      total, retPct,
      brPct, brTotal: breaks.length,
      best: sorted[0] ? `${sorted[0].k} (${Math.round(sorted[0].pct)}%)` : null,
      worst: sorted[sorted.length-1] ? `${sorted[sorted.length-1].k} (${Math.round(sorted[sorted.length-1].pct)}%)` : null,
      h1: { total: h1.length, retPct: h1.length ? Math.round(100 * h1Ret / h1.length) : null },
      h2: { total: h2.length, retPct: h2.length ? Math.round(100 * h2Ret / h2.length) : null },
      topPlayer,
    };
  })();
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

<!-- ── Show nothing until auth is checked (prevents login flash) ── -->
{#if !authChecked}
  <div class="loading">Loading…</div>

<!-- ── Login screen when Supabase is configured but no session ── -->
{:else if supabaseConfigured && !user}
  <Login on:login={handleLogin} />

<!-- ── Main app ── -->
{:else}
<div class="container">

  <!-- Header -->
  <div class="header">
    <h1>KickOut</h1>
    <div class="header-actions">
      {#if syncStatus === 'syncing'}<span class="chip syncing">↻ Syncing</span>{/if}
      {#if syncStatus === 'synced'}<span class="chip synced">✓ Synced</span>{/if}
      {#if syncStatus === 'error'}<span class="chip error">⚠ Sync error</span>{/if}
      <button class="icon-btn" title="{wakeLock ? 'Screen locked on' : 'Keep screen on'}"
        on:click={toggleWakeLock}>{wakeLock ? '🔆' : '🔅'}</button>
      {#if supabaseConfigured && user}
        <span class="user-email">{user.email}</span>
        <button on:click={signOut}>Sign out</button>
      {/if}
    </div>
  </div>

  <!-- ══ CAPTURE SECTION ══════════════════════════════════════════════════ -->
  <section class="card">
    <div class="section-title">
      Capture
      {#if editingId}<span class="editing-badge">Editing event</span>{/if}
    </div>

    <!-- Contest type — large tap buttons -->
    <div class="field-label">Contest</div>
    <div class="btn-group">
      {#each CONTESTS as c}
        <button
          class="seg-btn {contest === c ? 'active' : ''}"
          on:click={() => { contest = c; if (c !== 'break') breakOutcome = ''; }}
        >{c}</button>
      {/each}
    </div>

    <!-- Outcome — large tap buttons -->
    <div class="field-label">Outcome</div>
    <div class="btn-group outcome-grid">
      {#each OUTCOMES as o}
        <button
          class="seg-btn {outcome === o ? 'active outcome-'+o.toLowerCase() : ''}"
          on:click={() => outcome = o}
        >{o}</button>
      {/each}
    </div>

    <!-- Break outcome (conditional) -->
    {#if contest === 'break'}
      <div class="field-label">Break outcome</div>
      <div class="btn-group">
        {#each BREAK_OUTS as b}
          <button
            class="seg-btn {breakOutcome === b ? 'active' : ''}"
            on:click={() => breakOutcome = b}
          >{b}</button>
        {/each}
      </div>
    {/if}

    <!-- Target player & clock (high-frequency fields, always visible) -->
    <div class="inline-fields">
      <label>
        Target
        <input list="players" bind:value={targetPlayer} placeholder="e.g. Leo" autocomplete="off"/>
        <datalist id="players">
          {#each playerChoices as [,label]}<option value={label}></option>{/each}
        </datalist>
      </label>
      <label>Clock <input bind:value={clock} placeholder="12:34" inputmode="numeric"/></label>
      <button class="small timer-btn" on:click={toggleTimer}
        style="font-size:12px;padding:4px 8px;">{timerRunning ? '⏹ Stop' : '▶ Start'}</button>
    </div>

    <!-- Score fields -->
    <div class="inline-fields">
      <label>Score
        <input bind:value={scoreUs} placeholder="2-14" style="width:70px;"/>
        <span style="margin:0 4px;">–</span>
        <input bind:value={scoreThem} placeholder="0-8" style="width:70px;"/>
      </label>
    </div>

    <!-- Pitch -->
    <div class="pitch-wrap {pitchError ? 'pitch-error' : ''}">
      <Pitch
        contestType={contest}
        landing={landing}
        pickup={pickup}
        overlays={[]}
        on:landed={onLanding}
        on:picked={onPickup}
      />
    </div>

    <p class="coords">
      Landing: {Number.isNaN(landing.x) ? '—' : landing.x.toFixed(3)}, {Number.isNaN(landing.y) ? '—' : landing.y.toFixed(3)}
      {#if contest === 'break'}
        &nbsp;|&nbsp; Pickup: {Number.isNaN(pickup.x) ? '—' : pickup.x.toFixed(3)}, {Number.isNaN(pickup.y) ? '—' : pickup.y.toFixed(3)}
      {/if}
    </p>

    <!-- Notes and flag -->
    <div class="notes-row">
      <textarea bind:value={notes} placeholder="Optional note…" rows="2"></textarea>
      <label><input type="checkbox" bind:checked={flagEvent}/> Flag for review</label>
    </div>

    <!-- Primary actions -->
    <div class="action-row">
      <button class="primary large" on:click={saveEvent}>
        {editingId ? '✓ Update event' : '+ Save event'}
      </button>
      <button on:click={clearPoints}>Clear points</button>
      {#if editingId}
        <button on:click={() => { editingId = null; clearPoints(); targetPlayer = ''; }}>Cancel edit</button>
      {/if}
      <button on:click={undoLast} disabled={undoStack.length === 0} title="Undo last save">
        ↩ Undo
      </button>
    </div>

    <!-- Match setup — collapsible ─────────────────────────────────────── -->
    <details bind:open={setupOpen} class="setup-details">
      <summary>Match setup <span class="setup-summary">{team || '?'} vs {opponent || '?'} · {matchDate} · {period}</span></summary>
      <div class="setup-grid">
        <label>Team    <input bind:value={team}     placeholder="Clontarf" /></label>
        <label>Opponent<input bind:value={opponent} placeholder="Crokes"
          on:change={() => persistLocal()}
          list="opps"/>
          <datalist id="opps">
            {#each opponentChoices as [,label]}<option value={label}></option>{/each}
          </datalist>
        </label>
        <label>Date    <input type="date" bind:value={matchDate} /></label>
        <label>Period
          <select bind:value={period}><option>H1</option><option>H2</option></select>
        </label>
        <label class="full-row">
          <input type="checkbox" bind:checked={ourGoalAtTop}/> Our goal at top of pitch
        </label>
        <label>Time to tee (s) <input inputmode="decimal" bind:value={timeToTee} placeholder="e.g. 4.2"/></label>
        <label>Total time (s)  <input inputmode="decimal" bind:value={totalTime} placeholder="e.g. 11.0"/></label>
        <label class="full-row"><input type="checkbox" bind:checked={scored20}/> Scored ≤20s</label>
      </div>
    </details>
  </section>

  <!-- ══ ANALYTICS SECTION ═════════════════════════════════════════════════ -->
  <section class="card">
    <div class="section-title">
      Analytics <span class="count">({vizEvents.length} of {events.length} events)</span>
      <button class="small" on:click={() => showSummary = true}>Summary</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <!-- Match selector -->
      <div class="filter-row">
        <label>Match
          <select bind:value={matchFilter}>
            <option value="ALL">All matches</option>
            {#each uniqueMatches as m}
              <option value={m.key}>{m.match_date} · {m.opponent || 'Unknown'} ({m.count})</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="filter-row">
        <label><input type="checkbox" bind:checked={useFilters}/> Contest / outcome filters</label>
        <label><input type="checkbox" bind:checked={ytdOnly}/> YTD ({currentYear})</label>
        <button class="small" on:click={() => { oppFilter='ALL'; plyFilter='ALL'; ytdOnly=false; fContest=new Set(CONTESTS); fOutcome=new Set(OUTCOMES); matchFilter='ALL'; }}>
          Reset all
        </button>
      </div>
      {#if useFilters}
        <div class="filter-row">
          Contest:
          {#each CONTESTS as c}
            <label><input type="checkbox" checked={fContest.has(c)} on:change={() => toggleContest(c)}/> {c}</label>
          {/each}
        </div>
        <div class="filter-row">
          Outcome:
          {#each OUTCOMES as o}
            <label><input type="checkbox" checked={fOutcome.has(o)} on:change={() => toggleOutcome(o)}/> {o}</label>
          {/each}
        </div>
      {/if}
      <div class="filter-row">
        <label>Opponent
          <select bind:value={oppFilter}>
            <option value="ALL">All</option>
            {#each opponentChoices as [key,label]}<option value={key}>{label}</option>{/each}
          </select>
        </label>
        <label>Player
          <select bind:value={plyFilter}>
            <option value="ALL">All</option>
            {#each playerChoices as [key,label]}<option value={key}>{label}</option>{/each}
          </select>
        </label>
        <label>View
          <select bind:value={overlayMode}>
            <option value="landing">Landing</option>
            <option value="pickup">Pickup</option>
          </select>
        </label>
      </div>
    </div>

    <!-- Timeline -->
    {#if timelineEvents.length > 0}
      <h3>Timeline ({timelineEvents.length} kickouts)</h3>
      <div class="timeline-wrap">
        {#each timelineEvents as e, i}
          <div
            class="tl-dot {e.flag ? 'tl-flagged' : ''}"
            style="background:{outcomeColor(e.outcome)}"
            title="#{e.ko_sequence ?? i+1} · {e.outcome} · {e.contest_type} · {e.period} {e.clock}{e.target_player ? ' → ' + e.target_player : ''}{e.notes ? ' — ' + e.notes : ''}"
          >{e.ko_sequence ?? i+1}</div>
        {/each}
      </div>
    {/if}

    <!-- Pitch overlay (filtered) -->
    <Pitch
      contestType="clean"
      landing={{x:NaN,y:NaN}}
      pickup={{x:NaN,y:NaN}}
      overlays={overlays}
      showZoneLabels={true}
    />

    <!-- Heatmap -->
    <h3>Heatmap</h3>
    <Heatmap points={overlays} cols={140} radius={3} smooth={2} />

    <!-- KPI tables -->
    <h3>KPIs</h3>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-title">Retention by Zone (S/M/L/V × L/C/R)</div>
        <table class="kpi-table">
          <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
          <tbody>
            {#each zoneTableRet as row}
              <tr>
                <th>{row.D}</th>
                {#each row.cells as c}
                  <td style="background:{cellColor(c.pct)}" title="{c.ret}/{c.tot}">
                    {c.tot ? `${Math.round(c.pct)}%${retTrend(c.pct, c.zk)}` : '—'}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="kpi">
        <div class="kpi-title">
          Break Win-Rate — {overallBreak.tot ? Math.round(overallBreak.pct)+'%' : '—'}
          ({overallBreak.won}/{overallBreak.tot})
        </div>
        <table class="kpi-table">
          <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
          <tbody>
            {#each zoneTableBreak as row}
              <tr>
                <th>{row.D}</th>
                {#each row.cells as c}
                  <td style="background:{cellColor(c.pct)}" title="{c.won}/{c.tot}">
                    {c.tot ? `${Math.round(c.pct)}%` : '—'}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Player breakdown table -->
    {#if playerStats.length > 0}
      <h3>By target player</h3>
      <table class="kpi-table player-table">
        <thead><tr><th>Player</th><th>Targeted</th><th>Retention</th><th>Breaks</th><th>Break win%</th></tr></thead>
        <tbody>
          {#each playerStats as p}
            <tr>
              <td style="text-align:left">{p.label}</td>
              <td>{p.total}</td>
              <td style="background:{cellColor(p.retPct)}">{p.retPct}%</td>
              <td>{p.brTotal}</td>
              <td>{p.brWonPct != null ? p.brWonPct + '%' : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <!-- ══ EVENTS TABLE ══════════════════════════════════════════════════════ -->
  <section class="card">
    <div class="section-title">
      Saved events ({events.length})
      <div class="export-btns">
        <button class="small" on:click={() => exportCSV()}>CSV</button>
        <button class="small" on:click={exportJSON}>JSON ↓</button>
        <button class="small" on:click={importJSON}>JSON ↑</button>
      </div>
    </div>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Time</th><th>Target</th><th>Outcome</th><th>Contest</th><th>Break</th>
            <th>Tee(s)</th><th>Total(s)</th><th>≤20s</th>
            <th>Side</th><th>Depth</th><th>Depth(m)</th>
            <th>x,y</th><th>pickup x,y</th><th>Δbreak(m)</th>
            <th>Team</th><th>Opp</th><th>#KO</th><th>Score</th><th>Flag</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each events as e (e.id)}
            <tr class={editingId === e.id ? 'editing-row' : ''}>
              <td>{e.match_date || (e.created_at||'').slice(0,10)}</td>
              <td>{e.period} {e.clock}</td>
              <td>{e.target_player || '—'}</td>
              <td>{e.outcome}</td>
              <td>{e.contest_type}</td>
              <td>{e.break_outcome || '—'}</td>
              <td>{e.time_to_tee_s ?? '—'}</td>
              <td>{e.total_time_s  ?? '—'}</td>
              <td>{e.scored_20s ? '✓' : '—'}</td>
              <td>{e.side_band}</td>
              <td>{e.depth_band}</td>
              <td>{e.depth_from_own_goal_m?.toFixed?.(1) ?? '—'}</td>
              <td>{e.x?.toFixed?.(2) ?? '—'}, {e.y?.toFixed?.(2) ?? '—'}</td>
              <td>{e.pickup_x == null ? '—' : `${e.pickup_x?.toFixed?.(2)}, ${e.pickup_y?.toFixed?.(2)}`}</td>
              <td>{e.break_displacement_m == null ? '—' : e.break_displacement_m?.toFixed?.(1)}</td>
              <td>{e.team}</td>
              <td>{e.opponent}</td>
              <td>{e.ko_sequence ?? '—'}</td>
              <td>{e.score_us ? `${e.score_us}–${e.score_them ?? '?'}` : '—'}</td>
              <td>{e.flag ? '🚩' : '—'}</td>
              <td class="actions">
                <button on:click={() => loadToForm(e)}>Load</button>
                <button class="danger" on:click={() => delEvent(e.id)}>Del</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Backup reminder toast -->
  {#if backupReminder}
    <div class="toast">
      💾 {events.length} events — back up your data
      <button class="small" on:click={exportJSON}>Export JSON</button>
      <button class="small" on:click={() => backupReminder = false}>✕</button>
    </div>
  {/if}

  <!-- Summary modal -->
  {#if showSummary && summaryStats}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
    <div class="modal-backdrop" role="dialog" aria-modal="true" tabindex="-1" on:click={() => showSummary = false}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <span>Match Summary</span>
          <button on:click={() => showSummary = false}>✕</button>
        </div>
        <div class="summary-grid">
          <div class="s-stat"><div class="s-val">{summaryStats.total}</div><div class="s-lbl">Kickouts</div></div>
          <div class="s-stat"><div class="s-val">{summaryStats.retPct}%</div><div class="s-lbl">Retention</div></div>
          {#if summaryStats.brTotal > 0}
            <div class="s-stat"><div class="s-val">{summaryStats.brPct ?? '—'}%</div><div class="s-lbl">Break win rate ({summaryStats.brTotal} breaks)</div></div>
          {/if}
          {#if summaryStats.best}
            <div class="s-stat"><div class="s-val">{summaryStats.best}</div><div class="s-lbl">Best zone</div></div>
          {/if}
          {#if summaryStats.worst}
            <div class="s-stat"><div class="s-val">{summaryStats.worst}</div><div class="s-lbl">Worst zone</div></div>
          {/if}
          <div class="s-stat"><div class="s-val">{summaryStats.h1.total} · {summaryStats.h1.retPct ?? '—'}%</div><div class="s-lbl">H1 kickouts · retention</div></div>
          <div class="s-stat"><div class="s-val">{summaryStats.h2.total} · {summaryStats.h2.retPct ?? '—'}%</div><div class="s-lbl">H2 kickouts · retention</div></div>
          {#if summaryStats.topPlayer}
            <div class="s-stat full"><div class="s-val">{summaryStats.topPlayer.label}</div><div class="s-lbl">Most targeted — {summaryStats.topPlayer.total}× · {summaryStats.topPlayer.retPct}% retention</div></div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

</div>
{/if}

<style>
  /* ── Base ── */
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #f4f7f4; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #222; }

  .loading { display: flex; align-items: center; justify-content: center; height: 100svh; font-size: 16px; color: #666; }

  .container { max-width: 680px; margin: 0 auto; padding: 8px 12px 32px; }

  /* ── Header ── */
  .header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 6px; }
  h1 { font-size: 20px; font-weight: 700; margin: 0; color: #0a5; }
  .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .user-email { font-size: 12px; color: #666; }
  .icon-btn { background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; }
  .chip { font-size: 12px; padding: 2px 8px; border-radius: 99px; }
  .chip.syncing { background: #fef3c7; color: #92400e; }
  .chip.synced  { background: #d1fae5; color: #065f46; }
  .chip.error   { background: #fee2e2; color: #991b1b; }

  /* ── Cards ── */
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 4px #0001; }
  .section-title { font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .count { font-weight: 400; font-size: 13px; color: #888; }
  .editing-badge { background: #fef3c7; color: #92400e; font-size: 12px; padding: 2px 8px; border-radius: 99px; font-weight: 400; }

  /* ── Segmented buttons (contest / outcome) ── */
  .field-label { font-size: 13px; font-weight: 600; color: #555; margin: 10px 0 4px; }
  .btn-group { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
  .outcome-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .seg-btn {
    flex: 1; min-width: 72px; padding: 10px 8px;
    border: 1.5px solid #d1d5db; border-radius: 8px;
    background: #f9fafb; cursor: pointer; font-size: 14px; font-weight: 500;
    transition: background 0.1s, border-color 0.1s;
  }
  .seg-btn:active { transform: scale(0.97); }
  .seg-btn.active { background: #0a5; color: #fff; border-color: #0a5; }
  .seg-btn.active.outcome-lost  { background: #dc2626; border-color: #dc2626; }
  .seg-btn.active.outcome-score { background: #2563eb; border-color: #2563eb; }

  /* ── Inline fields ── */
  .inline-fields { display: flex; gap: 12px; flex-wrap: wrap; margin: 10px 0 8px; align-items: center; }
  label { display: flex; gap: 6px; align-items: center; font-size: 14px; }
  input, select {
    padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 15px; background: #fff;
  }
  input:focus, select:focus { outline: none; border-color: #0a5; box-shadow: 0 0 0 2px #0a52; }
  input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }

  /* ── Notes row ── */
  .notes-row { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
  .notes-row textarea {
    width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 14px; font-family: inherit; resize: vertical;
  }
  .notes-row textarea:focus { outline: none; border-color: #0a5; box-shadow: 0 0 0 2px #0a52; }

  /* ── Pitch wrap / error flash ── */
  .pitch-wrap { border-radius: 8px; transition: box-shadow 0.15s; }
  .pitch-error { box-shadow: 0 0 0 3px #dc2626; animation: pitchFlash 0.4s ease 2; }
  @keyframes pitchFlash {
    0%,100% { box-shadow: 0 0 0 3px #dc2626; }
    50% { box-shadow: 0 0 0 6px #fca5a5; }
  }

  /* ── Buttons ── */
  button {
    padding: 8px 14px; border: 1px solid #d1d5db; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 14px; font-weight: 500;
  }
  button:hover { background: #f3f4f6; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .primary { background: #0a5; color: #fff; border-color: #0a5; }
  .primary:hover { background: #085; }
  .large { padding: 12px 20px; font-size: 16px; }
  .small { padding: 5px 10px; font-size: 13px; }
  .danger { border-color: #fca5a5; color: #dc2626; }
  .danger:hover { background: #fef2f2; }

  /* ── Action row ── */
  .action-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 0; }

  /* ── Coords ── */
  .coords { font-size: 13px; color: #888; margin: 6px 0 0; }

  /* ── Match setup ── */
  .setup-details { margin-top: 12px; }
  .setup-details summary {
    cursor: pointer; font-size: 14px; font-weight: 600; color: #555;
    list-style: none; display: flex; align-items: center; gap: 8px;
    padding: 8px 0;
  }
  .setup-details summary::before { content: '▶'; font-size: 10px; transition: transform 0.2s; }
  .setup-details[open] summary::before { transform: rotate(90deg); }
  .setup-summary { font-weight: 400; color: #888; font-size: 13px; }
  .setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 8px; }
  .full-row { grid-column: 1 / -1; }

  /* ── Filters ── */
  .filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; }

  /* ── Timeline ── */
  .timeline-wrap { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0; }
  .tl-dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff;
    cursor: default; flex-shrink: 0;
  }
  .tl-flagged { outline: 2px solid #f59e0b; outline-offset: 2px; }

  /* ── KPIs ── */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  h3 { font-size: 14px; font-weight: 700; margin: 16px 0 6px; }
  .kpi-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .kpi-table { border-collapse: collapse; font-size: 13px; width: 100%; }
  .kpi-table th, .kpi-table td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: center; }
  .kpi-table thead th { background: #f9fafb; }
  .player-table { width: 100%; margin-top: 4px; }

  /* ── Events table ── */
  .export-btns { margin-left: auto; display: flex; gap: 6px; }
  .tablewrap { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 6px 8px; border-top: 1px solid #f3f4f6; text-align: left; white-space: nowrap; }
  thead th { background: #f9fafb; position: sticky; top: 0; font-weight: 600; }
  .editing-row { background: #fefce8; }
  .actions { display: flex; gap: 4px; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #1f2937; color: #fff; padding: 10px 16px;
    border-radius: 99px; font-size: 13px; display: flex; align-items: center;
    gap: 10px; box-shadow: 0 4px 16px #0004; z-index: 50; white-space: nowrap;
  }
  .toast button { color: #fff; border-color: #4b5563; }

  /* ── Summary modal ── */
  .modal-backdrop {
    position: fixed; inset: 0; background: #0006; z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal {
    background: #fff; border-radius: 16px; padding: 20px;
    width: 100%; max-width: 400px; box-shadow: 0 8px 32px #0003;
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 700; font-size: 16px; margin-bottom: 16px;
  }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .s-stat { background: #f9fafb; border-radius: 8px; padding: 12px; }
  .s-stat.full { grid-column: 1 / -1; }
  .s-val { font-size: 20px; font-weight: 700; color: #111; }
  .s-lbl { font-size: 12px; color: #666; margin-top: 2px; }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .setup-grid { grid-template-columns: 1fr; }
    .outcome-grid { grid-template-columns: repeat(2, 1fr); }
    .container { padding: 6px 8px 24px; }
  }
</style>
