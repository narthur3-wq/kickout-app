<script>
  import { events } from '../stores.js';

  const SIDES = ['us','opp'];
  const CONTESTS = ['clean','break','foul','out'];

  let side = 'us';
  let text = '';
  let contest = '';
  let result = ''; // '', 'win', 'loss'

  const norm = s => (s||'').toLowerCase();

  $: filtered = $events.filter(e => {
    if (side && e.side !== side) return false;
    if (contest && e.contest_type !== contest) return false;
    if (result) { if (result==='win' && !e.win) return false; if (result==='loss' && e.win) return false; }
    if (text) {
      const t = norm(text);
      const pool = [e.target_player, e.presser_player, e.opponent_receiver].map(v=>norm(v||''));
      if (!pool.some(p => p.includes(t))) return false;
    }
    return true;
  });

  function updateField(e, key, value){
    events.update(list => list.map(row => row.id===e.id ? { ...row, [key]: value } : row));
  }
  function delEvent(id){ if(!confirm('Delete this event?')) return; events.update(list => list.filter(e=>e.id!==id)); }
</script>

<!-- (template + styles exactly as provided in previous message) -->

