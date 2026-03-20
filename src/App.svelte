<script>
  import Pitch from './lib/Pitch.svelte';
  import Heatmap from './lib/Heatmap.svelte';
  import Login from './lib/Login.svelte';
  import SummaryModal from './lib/SummaryModal.svelte';
  import EventsTable from './lib/EventsTable.svelte';
  import AnalyticsPanel from './lib/AnalyticsPanel.svelte';
  import DigestPanel from './lib/DigestPanel.svelte';
  import CaptureForm from './lib/CaptureForm.svelte';
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
  let landing = {x:NaN, y:NaN}, pickup = {x:NaN, y:NaN};
  let eventType = 'kickout';
  let direction = 'ours';

  let flagEvent = false;
  let restartReason = '';

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
  let activeTab = 'capture';
  let savedFlash = false;
  let pendingSync = new Set(); // IDs awaiting upload to Supabase
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ── Viz filters ───────────────────────────────────────────────────────────
  let fContest = new Set(CONTESTS);
  let fOutcome = new Set(OUTCOMES);
  /** @type {'landing'|'pickup'} */ let overlayMode = 'landing';
  let useFilters = true;
  let oppFilter = 'ALL';
  let plyFilter = 'ALL';
  let ytdOnly = false;
  let matchFilter = 'ALL';
  let periodFilter = 'ALL';
  let flaggedOnly = false;
  let analyticsEventType = 'ALL';
  let directionFilter    = 'ALL';

  // Drive analyticsEventType from the active tab
  $: {
    if      (activeTab === 'kickouts')  analyticsEventType = 'kickout';
    else if (activeTab === 'shots')     analyticsEventType = 'shot';
    else if (activeTab === 'turnovers') analyticsEventType = 'turnover';
    else                                analyticsEventType = 'ALL';
  }

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

  // ── Sync queue ───────────────────────────────────────────────────────────
  function loadPendingSync() {
    try { pendingSync = new Set(JSON.parse(localStorage.getItem('ko_sync_queue') || '[]')); }
    catch { pendingSync = new Set(); }
  }
  function savePendingSync() {
    try { localStorage.setItem('ko_sync_queue', JSON.stringify([...pendingSync])); } catch {}
  }
  async function flushSyncQueue() {
    if (!supabase || !user || pendingSync.size === 0 || !isOnline) return;
    for (const id of [...pendingSync]) {
      const ev = events.find(e => e.id === id);
      if (!ev) { pendingSync.delete(id); continue; }
      const { error } = await supabase.from('events').upsert(ev);
      if (!error) { pendingSync.delete(id); savePendingSync(); }
    }
    if (pendingSync.size === 0) syncStatus = 'synced';
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
      flushSyncQueue();
    } catch (e) {
      console.error('Sync failed', e);
      syncStatus = 'error';
    }
  }

  async function upsertToSupabase(ev) {
    if (!supabase || !user) {
      if (user) { pendingSync.add(ev.id); savePendingSync(); }
      return;
    }
    const { error } = await supabase.from('events').upsert(ev);
    if (error) {
      console.error('Supabase upsert failed', ev.id, error.message);
      pendingSync.add(ev.id); savePendingSync();
    } else {
      pendingSync.delete(ev.id); savePendingSync();
    }
  }

  async function deleteFromSupabase(id) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) console.error('Supabase delete failed', id, error.message);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    loadFromLocalStorage();
    loadPendingSync();
    window.addEventListener('online',  () => { isOnline = true;  flushSyncQueue(); });
    window.addEventListener('offline', () => { isOnline = false; });

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
    if (eventType === 'kickout' && contest === 'break') {
      if (Number.isNaN(pickup.x) || Number.isNaN(pickup.y))
        return 'For a break, tap the pickup point too.';
      if (!breakOutcome) return 'Choose break outcome (won / lost / neutral).';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate))
      return 'Match date must be YYYY-MM-DD.';
    return '';
  }

  function buildEvent() {
    const depth_m = depthMetersFromOwnGoal(landing.y);
    // Normalise stored coords so y=0 always = own goal end regardless of match orientation.
    // This keeps analytics dots consistent across home and away matches.
    const normY    = ourGoalAtTop ? landing.y : 1 - landing.y;
    const normPickY = ourGoalAtTop ? pickup.y  : 1 - pickup.y;
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
      x:   landing.x, y:   normY,
      x_m: toMetersX(landing.x), y_m: toMetersY(normY),
      depth_from_own_goal_m: +depth_m.toFixed(2),
      side_band:    sideBand(landing.x),
      depth_band:   depthBandFromMeters(depth_m),
      zone_code:    zoneCode(landing.x, landing.y),
      our_goal_at_top: ourGoalAtTop,
      event_type:      eventType,
      direction,
      pickup_x:   contest === 'break' ? pickup.x    : null,
      pickup_y:   contest === 'break' ? normPickY   : null,
      pickup_x_m: contest === 'break' ? toMetersX(pickup.x)    : null,
      pickup_y_m: contest === 'break' ? toMetersY(normPickY)   : null,
      break_displacement_m: contest === 'break'
        ? +breakDispM(landing.x, landing.y, pickup.x, pickup.y).toFixed(2)
        : null,
      score_us:    currentMatchScore.us.str,
      score_them:  currentMatchScore.them.str,
      flag:        !!flagEvent,
      restart_reason: eventType === 'kickout' ? (restartReason || null) : null,
      ko_sequence: koSequence,
      schema_version: 1,
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
    flagEvent = false;
    restartReason = '';

    // Haptic + visual feedback
    navigator.vibrate?.(50);
    savedFlash = true;
    setTimeout(() => { savedFlash = false; }, 1500);

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
    if (!confirm('Remove the last saved event?')) return;
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
    matchDate    = e.match_date || (e.created_at || '').slice(0,10) || new Date().toISOString().slice(0,10);
    landing      = { x: e.x, y: e.y };
    pickup       = (e.pickup_x == null || e.pickup_y == null)
      ? { x: NaN, y: NaN }
      : { x: e.pickup_x, y: e.pickup_y };
    // Restore new fields
    flagEvent      = !!e.flag;
    restartReason  = e.restart_reason || '';
    eventType      = e.event_type  || 'kickout';
    direction    = e.direction   || 'ours';
    // NOTE: ourGoalAtTop is NOT restored from the event so the analyst's
    // current orientation preference is preserved for subsequent captures.
    // Don't force-expand match setup — only open if team/opponent differ from current session
    setupOpen = false;
    activeTab = 'capture';
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV(subset = events) {
    const headers = [
      'id','created_at','match_date','team','opponent','period','clock',
      'target_player','outcome','contest_type','break_outcome',
      'x','y','x_m','y_m','depth_from_own_goal_m','side_band','depth_band','zone_code','our_goal_at_top',
      'pickup_x','pickup_y','pickup_x_m','pickup_y_m','break_displacement_m',
      'score_us','score_them','flag','ko_sequence','event_type','direction',
      'restart_reason','schema_version',
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
    a.href = url; a.download = 'pairc_events.json'; a.click();
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
        // Validate shape — each item must have the minimum required fields
        const REQUIRED = ['id', 'outcome', 'contest_type', 'x', 'y'];
        const invalid = imported.filter(e =>
          typeof e !== 'object' || e === null || REQUIRED.some(f => e[f] == null)
        );
        if (invalid.length > 0) throw new Error(`${invalid.length} record(s) are missing required fields (id, outcome, contest_type, x, y). Import aborted.`);
        // Warn about unknown schema versions
        const unknownVer = imported.filter(e => e.schema_version != null && e.schema_version > 1);
        if (unknownVer.length > 0) {
          const ok = confirm(`${unknownVer.length} record(s) have a newer schema_version than this app supports. They may contain fields this version doesn't understand. Continue anyway?`);
          if (!ok) return;
        }
        const existingIds = new Set(events.map(e => e.id));
        const newEvents = imported.filter(e => !existingIds.has(e.id));
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

  // ── Derived match score from tracked shots ────────────────────────────────
  $: currentMatchScore = (() => {
    const currentKey = `${matchDate}|${norm(team)}|${norm(opponent)}`;
    const shots = events.filter(e => matchKey(e) === currentKey && e.event_type === 'shot');
    const calc = (dir) => {
      const s = shots.filter(e => (e.direction || 'ours') === dir);
      const goals  = s.filter(e => e.outcome === 'Goal').length;
      const points = s.filter(e => e.outcome === 'Point').length;
      return { goals, points, str: `${goals}-${points}` };
    };
    return { us: calc('ours'), them: calc('theirs'), hasShots: shots.length > 0 };
  })();

  // ── Filtered events for viz & KPIs ───────────────────────────────────────
  $: vizEvents = events.filter(e => {
    const evType = e.event_type || 'kickout';
    const evDir  = e.direction  || 'ours';
    const passOpp    = oppFilter === 'ALL' || norm(e.opponent) === oppFilter;
    const passPly    = plyFilter === 'ALL' || norm(e.target_player) === plyFilter;
    const passYTD    = !ytdOnly || eventYear(e) === String(currentYear);
    const passCO     = !useFilters || evType !== 'kickout' || (fContest.has(e.contest_type) && fOutcome.has(e.outcome));
    const passMatch  = matchFilter === 'ALL' || matchKey(e) === matchFilter;
    const passPeriod = periodFilter === 'ALL' || e.period === periodFilter;
    const passFlag   = !flaggedOnly || !!e.flag;
    const passEvType = analyticsEventType === 'ALL' || evType === analyticsEventType;
    const passDir    = directionFilter === 'ALL' || evDir === directionFilter;
    return passOpp && passPly && passYTD && passCO && passMatch && passPeriod && passFlag && passEvType && passDir;
  });

  // Overlays with outcome weight for heatmap density
  $: overlays = vizEvents.map(e =>
    overlayMode === 'landing'
      ? { x: e.x, y: e.y, outcome: e.outcome, contest_type: e.contest_type, at_target: !!e.target_player, weight: outcomeWeight(e.outcome) }
      : (e.pickup_x == null || e.pickup_y == null ? null
          : { x: e.pickup_x, y: e.pickup_y, outcome: e.outcome, contest_type: e.contest_type, at_target: !!e.target_player, weight: outcomeWeight(e.outcome) })
  ).filter(Boolean);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const ZSIDES = ['L','C','R'], ZDEPTH = ['S','M','L','V'];
  const zoneKey = (s,d) => `${s}-${d}`;
  const RETAINED = new Set(['Retained','Score','Won']);

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

  // Returns 'up'|'down'|null — null means no filter active or delta too small
  function retTrend(filteredPct, zoneCd) {
    if (matchFilter === 'ALL' && oppFilter === 'ALL' && periodFilter === 'ALL') return null;
    const bl = zoneStatsBaseline[zoneCd];
    if (!bl || bl.tot < 5) return null;
    const basePct = 100 * bl.ret / bl.tot;
    const delta = filteredPct - basePct;
    if (Math.abs(delta) < 8) return null;
    return delta > 0 ? 'up' : 'down';
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

  // ── Timeline ──────────────────────────────────────────────────────────────
  $: timelineEvents = [...vizEvents].sort((a, b) => {
    const sa = a.ko_sequence ?? 9999, sb = b.ko_sequence ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.created_at||'').localeCompare(b.created_at||'');
  });

  // Weight for heatmap: emphasise retained/scored events, de-emphasise losses
  function outcomeWeight(o) {
    switch ((o||'').toLowerCase()) {
      case 'score':    return 3;
      case 'retained': return 2;
      case 'lost':     return 0.5;
      default:         return 0.3; // wide / out / foul
    }
  }

  // Score parsing — supports "G-P" (GAA) or raw total
  function parseScore(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d+)-(\d+)$/);
    if (m) return parseInt(m[1]) * 3 + parseInt(m[2]);
    const n = parseInt(s);
    return isNaN(n) ? null : n;
  }

  const SCORE_BUCKETS = ['Win 8+','Win 4–7','Win 1–3','Level','Lose 1–3','Lose 4–7','Lose 8+'];
  function scoreBucket(margin) {
    if (margin >= 8)  return 'Win 8+';
    if (margin >= 4)  return 'Win 4–7';
    if (margin >= 1)  return 'Win 1–3';
    if (margin === 0) return 'Level';
    if (margin >= -3) return 'Lose 1–3';
    if (margin >= -7) return 'Lose 4–7';
    return 'Lose 8+';
  }

  // ── Score-state analytics ────────────────────────────────────────────────
  $: scoreStateStats = (() => {
    const buckets = {};
    for (const b of SCORE_BUCKETS) buckets[b] = { tot: 0, ret: 0 };
    for (const e of vizEvents) {
      const us   = parseScore(e.score_us);
      const them = parseScore(e.score_them);
      if (us === null || them === null) continue;
      const b = scoreBucket(us - them);
      buckets[b].tot++;
      if (RETAINED.has(e.outcome)) buckets[b].ret++;
    }
    return SCORE_BUCKETS
      .map(b => ({ bucket: b, ...buckets[b], pct: buckets[b].tot >= 3 ? Math.round(100 * buckets[b].ret / buckets[b].tot) : null }))
      .filter(b => b.tot > 0);
  })();

  // ── Player stats ──────────────────────────────────────────────────────────
  $: playerStats = playerChoices
    .map(([key, label]) => {
      const evs = vizEvents.filter(e => norm(e.target_player) === key);
      if (evs.length === 0) return null;
      const ret = evs.filter(e => RETAINED.has(e.outcome)).length;
      const breaks = evs.filter(e => e.contest_type === 'break');
      const brWon = breaks.filter(e => e.break_outcome === 'won').length;
      return {
        key,
        label,
        total: evs.length,
        retPct: Math.round(100 * ret / evs.length),
        brTotal: breaks.length,
        brWonPct: breaks.length ? Math.round(100 * brWon / breaks.length) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  // ── Clock trend (retention by 10-min window) ─────────────────────────────
  $: clockTrend = (() => {
    const WINDOWS = [[0,10,'0-10'],[10,20,'10-20'],[20,30,'20-30'],[30,40,'30-40'],[40,60,'40+']];
    const buckets = WINDOWS.map(([lo, hi, label]) => ({ label, lo, hi, tot: 0, ret: 0 }));
    for (const e of vizEvents) {
      if (!e.clock) continue;
      const m = e.clock.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) continue;
      const mins = parseInt(m[1]) + parseInt(m[2]) / 60;
      const b = buckets.find(bk => mins >= bk.lo && mins < bk.hi);
      if (b) { b.tot++; if (RETAINED.has(e.outcome)) b.ret++; }
    }
    return buckets
      .filter(b => b.tot >= 2)
      .map(b => ({ label: b.label, tot: b.tot, pct: Math.round(100 * b.ret / b.tot) }));
  })();

  // ── Restart-context stats ─────────────────────────────────────────────────
  $: restartStats = (() => {
    const REASONS = ['Score','Wide','Foul','Out'];
    return REASONS.map(r => {
      const evs = vizEvents.filter(e => e.restart_reason === r);
      if (evs.length < 3) return null;
      const ret = evs.filter(e => RETAINED.has(e.outcome)).length;
      return { reason: r, tot: evs.length, pct: Math.round(100 * ret / evs.length) };
    }).filter(Boolean);
  })();

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
    // best/worst zones with at least 8 events (below this, %s are unreliable)
    const zonePcts = Object.entries(zoneStats)
      .map(([k, s]) => ({ k, pct: s.tot >= 8 ? (100 * s.ret / s.tot) : null }))
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

{#if !authChecked}
  <div class="loading">Loading…</div>
{:else if supabaseConfigured && !user}
  <Login on:login={handleLogin} />
{:else}
<div class="app-shell">

  <!-- Header -->
  <header class="header">
    <div class="logo-wrap">
      <img src="/crest.png" class="logo-crest" alt="Clontarf GAA" />
      <h1>Páirc</h1>
    </div>

    <div class="header-center">
      <div class="match-ctx-wrap">
          {#if team}<span class="match-ctx">{team}{opponent ? ' v ' + opponent : ''}</span>{/if}
        {#if currentMatchScore?.hasShots}<span class="match-score">{currentMatchScore.us.str} – {currentMatchScore.them.str}</span>{/if}
      </div>
      <div class="period-pills">
        <span class="pills-label" title="Filter analytics by period">View:</span>
        {#each ['H1','H2','ET'] as p}
          <button class="period-pill {periodFilter === p ? 'active' : ''}" on:click={() => periodFilter = p} title="Show {p} events only">{p}</button>
        {/each}
        <button class="period-pill {periodFilter === 'ALL' ? 'active' : ''}" on:click={() => periodFilter = 'ALL'} title="Show all periods">All</button>
      </div>
    </div>

    <div class="header-actions">
      {#if !isOnline}
        <span class="chip offline">● Offline</span>
      {:else if pendingSync.size > 0}
        <span class="chip pending">⚠ {pendingSync.size}</span>
      {:else if syncStatus === 'syncing'}
        <span class="chip syncing">↻</span>
      {:else if syncStatus === 'synced'}
        <span class="chip synced">✓</span>
      {:else if syncStatus === 'error'}
        <span class="chip error">!</span>
      {/if}
      <button class="flip-pill" on:click={() => ourGoalAtTop = !ourGoalAtTop} title="Swap which goal end is ours on the pitch (use at half-time if not auto-detected)">End ⇄</button>
      <button class="icon-btn" title="{wakeLock ? 'Screen locked on' : 'Keep screen on'}"
        on:click={toggleWakeLock}>{wakeLock ? '🔆' : '🔅'}</button>
      {#if supabaseConfigured && user}
        <span class="user-email">{user.email}</span>
        <button class="hdr-sm" on:click={signOut}>Sign out</button>
      {/if}
    </div>
  </header>

  <!-- Tab bar -->
  <nav class="tab-bar">
    <button class="tab-btn {activeTab === 'capture' ? 'active' : ''}" on:click={() => activeTab = 'capture'}>
      Capture{#if editingId}&nbsp;<span class="edit-dot">●</span>{/if}
    </button>
    <button class="tab-btn {activeTab === 'digest' ? 'active' : ''}" on:click={() => activeTab = 'digest'}>
      Digest
    </button>
    <button class="tab-btn {activeTab === 'kickouts' ? 'active' : ''}" on:click={() => activeTab = 'kickouts'}>
      Kickouts
    </button>
    <button class="tab-btn {activeTab === 'shots' ? 'active' : ''}" on:click={() => activeTab = 'shots'}>
      Shots
    </button>
    <button class="tab-btn {activeTab === 'turnovers' ? 'active' : ''}" on:click={() => activeTab = 'turnovers'}>
      Turnovers
    </button>
    <button class="tab-btn {activeTab === 'events' ? 'active' : ''}" on:click={() => activeTab = 'events'}>
      Events <span class="tab-count">{events.length}</span>
    </button>
  </nav>

  <!-- ══ CAPTURE TAB ══ -->
  {#if activeTab === 'capture'}
  <div class="capture-layout">

    <!-- Left: form controls -->
    <div class="form-panel">
      <CaptureForm
        bind:eventType
        bind:direction
        bind:contest
        bind:outcome
        bind:breakOutcome
        bind:targetPlayer
        bind:flagEvent
        bind:setupOpen
        bind:team
        bind:opponent
        bind:matchDate
        bind:period
        bind:ourGoalAtTop
        bind:restartReason
        {CONTESTS}
        {BREAK_OUTS}
        {opponentChoices}
        {editingId}
        {undoStack}
        {savedFlash}
        onSave={saveEvent}
        onClearPoints={clearPoints}
        onUndoLast={undoLast}
        onPersist={persistLocal}
        on:periodChange={(e) => {
          const p = e.detail;
          const wasH2 = period === 'H2';
          const goingH2 = p === 'H2';
          period = p;
          if (goingH2 && !wasH2) ourGoalAtTop = !ourGoalAtTop;
          else if (wasH2 && !goingH2) ourGoalAtTop = !ourGoalAtTop;
        }}
        on:cancelEdit={() => { editingId = null; clearPoints(); targetPlayer = ''; }}
      />
    </div><!-- /form-panel -->

    <!-- Right: pitch panel -->
    <div class="pitch-panel {pitchError ? 'pitch-error' : ''}">
      <!-- Timer strip -->
      <div class="timer-strip">
        <button class="timer-btn" on:click={toggleTimer}>
          {timerRunning ? '⏹' : '▶'}
        </button>
        <span class="timer-clock">{clock || '0:00'}</span>
        <span class="timer-period">{period}</span>
      </div>
      <div class="pitch-card">
        <div class="goal-indicator">
          {ourGoalAtTop ? '◀ Your goal — left end' : 'Your goal — right end ▶'}
        </div>
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
        {#if !Number.isNaN(landing.x)}
          {sideBand(landing.x)} · {Math.round(depthMetersFromOwnGoal(landing.y))}m
          {#if contest === 'break'}
            {#if !Number.isNaN(pickup.x)}
              &nbsp;→&nbsp; Pick: {sideBand(pickup.x)} · {Math.round(depthMetersFromOwnGoal(pickup.y))}m
            {:else}
              <span class="coords-hint">Now tap pickup point</span>
            {/if}
          {/if}
        {:else}
          <span class="coords-hint">
            {contest === 'break' ? 'Step 1 of 2 — tap pitch to set landing' : 'Tap pitch to place landing point'}
          </span>
        {/if}
      </p>
    </div><!-- /pitch-panel -->

  </div><!-- /capture-layout -->

  <!-- ══ DIGEST TAB ══ -->
  {:else if activeTab === 'digest'}
  <div class="full-panel">
    <DigestPanel {events} {periodFilter} />
  </div>

  <!-- ══ ANALYTICS TABS (Kickouts / Shots / Turnovers) ══ -->
  {:else if activeTab === 'kickouts' || activeTab === 'shots' || activeTab === 'turnovers'}
  <div class="full-panel">
    <AnalyticsPanel
      {vizEvents}
      {overlays}
      {zoneTableRet}
      {zoneTableBreak}
      {overallBreak}
      {scoreStateStats}
      {playerStats}
      {timelineEvents}
      {uniqueMatches}
      {opponentChoices}
      {playerChoices}
      {currentYear}
      {CONTESTS}
      {OUTCOMES}
      {retTrend}
      bind:matchFilter
      bind:oppFilter
      bind:plyFilter
      bind:periodFilter
      bind:ytdOnly
      bind:useFilters
      bind:fContest
      bind:fOutcome
      bind:overlayMode
      bind:flaggedOnly
      analyticsEventType={analyticsEventType}
      bind:directionFilter
      {clockTrend}
      {restartStats}
      on:showSummary={() => showSummary = true}
      on:filterPlayer={(e) => { plyFilter = e.detail; }}
    />
  </div>

  <!-- ══ EVENTS TAB ══ -->
  {:else}
  <div class="full-panel">
    <EventsTable
      {events}
      {editingId}
      onExportCSV={() => exportCSV()}
      onExportView={(subset) => exportCSV(subset)}
      onExportJSON={exportJSON}
      onImportJSON={importJSON}
      on:load={(e) => loadToForm(e.detail)}
      on:delete={(e) => delEvent(e.detail)}
    />
  </div>
  {/if}

  <!-- Backup reminder toast -->
  {#if backupReminder}
    <div class="toast">
      💾 {events.length} events — back up your data
      <button class="small" on:click={exportJSON}>Export JSON</button>
      <button class="small" on:click={() => backupReminder = false}>✕</button>
    </div>
  {/if}

  <!-- Summary modal -->
  {#if showSummary}
    <SummaryModal summaryStats={summaryStats} on:close={() => showSummary = false} />
  {/if}

</div>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0; overflow: hidden;
    background: #f0f4f0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #111827;
  }

  .loading { display: flex; align-items: center; justify-content: center; height: 100svh; font-size: 15px; color: #6b7280; }

  /* ── App shell ── */
  .app-shell { display: flex; flex-direction: column; height: 100svh; overflow: hidden; }

  /* ── Header — dark ── */
  .header {
    flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; background: #0f1923; min-height: 54px; gap: 12px;
    border-bottom: 2px solid #c41230;
  }
  .logo-wrap { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
  .logo-crest { width: 38px; height: 38px; object-fit: contain; flex-shrink: 0; }
  h1 { font-size: 18px; font-weight: 900; margin: 0; color: #fff; letter-spacing: -0.04em; }
  .header-center {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 0;
  }
  .match-ctx {
    font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;
  }

  /* Period segmented control — on dark header */
  .period-pills {
    display: flex; align-items: center; gap: 1px; background: rgba(255,255,255,0.08);
    border-radius: 8px; padding: 3px; flex-shrink: 0;
  }
  .pills-label {
    font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.38);
    padding: 0 5px 0 2px; letter-spacing: 0.04em; text-transform: uppercase;
    cursor: default;
  }
  .period-pill {
    padding: 4px 11px; border-radius: 6px; font-size: 12px; font-weight: 700;
    border: none; background: transparent; cursor: pointer;
    color: rgba(255,255,255,0.45); font-family: inherit; transition: all 0.15s; line-height: 1.3;
  }
  .period-pill.active { background: #1c3f8a; color: #fff; }
  .period-pill:hover:not(.active) { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.1); }

  .header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .user-email { font-size: 11px; color: rgba(255,255,255,0.38); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon-btn {
    background: none; border: none; cursor: pointer; font-size: 17px;
    padding: 5px 6px; border-radius: 6px; color: rgba(255,255,255,0.55); transition: all 0.15s;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }

  .chip { font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
  .chip.syncing { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .chip.synced  { background: rgba(74,222,128,0.15);  color: #4ade80; }
  .chip.error   { background: rgba(248,113,113,0.15); color: #f87171; }
  .chip.offline { background: rgba(156,163,175,0.15); color: #9ca3af; }
  .chip.pending { background: rgba(245,158,11,0.15);  color: #f59e0b; }

  .match-ctx-wrap { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; }
  .match-score { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.04em; }

  /* Flip button — dark header */
  .flip-pill {
    padding: 5px 9px; border-radius: 7px; font-size: 12px; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08);
    cursor: pointer; color: rgba(255,255,255,0.75); font-family: inherit; transition: all 0.15s; line-height: 1;
    letter-spacing: 0.01em;
  }
  .flip-pill:hover { background: rgba(255,255,255,0.15); color: #fff; }

  /* Sign-out — dark header */
  .hdr-sm {
    padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 600;
    border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08);
    cursor: pointer; color: rgba(255,255,255,0.72); font-family: inherit; transition: all 0.15s;
  }
  .hdr-sm:hover { background: rgba(255,255,255,0.15); color: #fff; }

  /* ── Tab bar ── */
  .tab-bar {
    flex-shrink: 0; display: flex; background: #fff; border-bottom: 1px solid #e5e7eb;
    overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 4px;
  }
  .tab-bar::-webkit-scrollbar { display: none; }
  .tab-btn {
    flex: none; padding: 0 16px; height: 44px; font-size: 13px; font-weight: 600;
    border: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
    background: none; cursor: pointer; color: #9ca3af;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    white-space: nowrap; transition: color 0.15s; letter-spacing: 0;
  }
  .tab-btn.active { color: #1c3f8a; border-bottom-color: #1c3f8a; font-weight: 700; }
  .tab-btn:hover:not(.active) { color: #374151; }
  .tab-count { background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 99px; }
  .tab-btn.active .tab-count { background: #dbeafe; color: #1e40af; }
  .edit-dot { color: #f59e0b; font-size: 10px; }

  /* ── Capture layout ── */
  .capture-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .form-panel {
    overflow-y: auto; padding: 0; background: #fff; flex-shrink: 0; border-bottom: 1px solid #e5e7eb;
  }
  .pitch-panel {
    flex: 1; padding: 14px; background: #eaf2ea;
    display: flex; flex-direction: column; min-height: 0; overflow: hidden; gap: 8px;
  }
  .full-panel { flex: 1; overflow-y: auto; padding: 14px; min-height: 0; }

  @media (min-width: 768px) {
    .capture-layout { flex-direction: row; }
    .form-panel { width: 300px; flex-shrink: 0; border-bottom: none; border-right: 1px solid #e5e7eb; overflow-y: auto; }
    .pitch-panel { flex: 1; padding: 24px; justify-content: center; }
  }

  /* ── Timer strip ── */
  .timer-strip {
    display: flex; align-items: center; gap: 12px;
    background: #2d5a33; padding: 8px 14px; flex-shrink: 0; border-radius: 10px;
  }
  .timer-btn {
    padding: 6px 16px; border-radius: 7px; font-size: 15px; font-weight: 800;
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
    color: #fff; cursor: pointer; font-family: inherit; transition: all 0.12s; line-height: 1;
  }
  .timer-btn:hover { background: rgba(255,255,255,0.25); }
  .timer-clock {
    font-size: 26px; font-weight: 900; color: #fff;
    font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1;
  }
  .timer-period {
    font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.55);
    text-transform: uppercase; letter-spacing: 0.08em; margin-left: auto;
  }

  /* ── Pitch card ── */
  .goal-indicator {
    font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.9); background: #2d5a33;
    padding: 5px 12px; text-align: center; letter-spacing: 0.05em;
    flex-shrink: 0; text-transform: uppercase; border-radius: 0;
  }
  .pitch-card {
    border: none; border-radius: 10px;
    box-shadow: 0 6px 28px rgba(0,50,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
    overflow: hidden; flex-shrink: 0;
  }
  .pitch-panel.pitch-error { outline: 3px solid #dc2626; outline-offset: 2px; animation: pitchFlash 0.4s ease 2; }
  @keyframes pitchFlash { 0%,100% { outline-color: #dc2626; } 50% { outline-color: #fca5a5; } }
  .coords {
    font-size: 11px; color: #374151; margin: 0; text-align: center;
    font-variant-numeric: tabular-nums; letter-spacing: 0.01em; font-weight: 600;
  }
  .coords-hint { color: #9ca3af; font-weight: 400; }

  /* ── Generic shell buttons (toast etc.) ── */
  button {
    padding: 8px 16px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 14px; font-weight: 600;
    font-family: inherit; color: #374151; transition: background 0.12s, border-color 0.12s;
  }
  button:hover { background: #f9fafb; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .small { padding: 5px 12px; font-size: 12px; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #1f2937; color: #fff; padding: 10px 16px; border-radius: 12px;
    font-size: 13px; display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 100; white-space: nowrap;
  }
  .toast button { color: #fff; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); font-size: 12px; }
  .toast button:hover { background: rgba(255,255,255,0.18); }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .header { padding: 0 10px; min-height: 50px; }
    .tab-btn { padding: 0 11px; font-size: 12px; }
    .pitch-panel { padding: 10px; }
    h1 { font-size: 16px; }
  }
</style>
