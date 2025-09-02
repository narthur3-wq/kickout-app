<script>
  import { pending } from '$lib/stores.js';

  // Helpers
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

  // We present turnovers from Us perspective:
  // gain = we win the ball, loss = we lose the ball.
  // cause = forced/unforced (only relevant to losses).
  function tally(list) {
    const gain = list.filter((e) => e.outcome === 'gain').length;
    const loss = list.filter((e) => e.outcome === 'loss').length;
    const forced = list.filter((e) => e.outcome === 'loss' && e.cause === 'forced').length;
    const unforced = list.filter((e) => e.outcome === 'loss' && e.cause === 'unforced').length;
    return { gain, loss, forced, unforced, rate: pct(gain, gain + loss) };
  }

  $: all = ($pending || []).filter((e) => e.type === 'turnover' && e.side === 'us');

  $: h1 = tally(all.filter((e) => e.half === 'H1'));
  $: h2 = tally(all.filter((e) => e.half === 'H2'));
  $: total = tally(all);
</script>

<div class="card">
  <h2 class="card-title">Turnovers — H1 / H2 / Total <span class="muted">(Us)</span></h2>

  <div class="table-wrap">
    <table class="t numcol">
      <thead>
        <tr>
          <th></th>
          <th>Gain</th>
          <th>Loss</th>
          <th>%</th>
          <th>F</th>
          <th>U</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>H1</th>
          <td>{h1.gain}</td>
          <td>{h1.loss}</td>
          <td>{h1.rate}%</td>
          <td>{h1.forced}</td>
          <td>{h1.unforced}</td>
        </tr>
        <tr>
          <th>H2</th>
          <td>{h2.gain}</td>
          <td>{h2.loss}</td>
          <td>{h2.rate}%</td>
          <td>{h2.forced}</td>
          <td>{h2.unforced}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th>Total</th>
          <td><strong>{total.gain}</strong></td>
          <td><strong>{total.loss}</strong></td>
          <td><strong>{total.rate}%</strong></td>
          <td><strong>{total.forced}</strong></td>
          <td><strong>{total.unforced}</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <p class="note">Us perspective only (Opp is the mirror: Opp gain ≅ Us loss)</p>
</div>

<style>
  .card { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
  .card-title { margin: 0 0 12px; }
  .muted { color: #6b7280; font-weight: 500; }

  .table-wrap { overflow-x: auto; }
  table.t { width: 100%; border-collapse: collapse; }
  table.t th, table.t td { padding: 10px 12px; border-bottom: 1px solid #eef1f4; }
  table.t thead th { font-weight: 600; color: #374151; background: #f7f8fb; }
  table.t tfoot th, table.t tfoot td { background: #f5f7fb; }

  /* Center all numeric columns, keep the first col left-aligned. */
  table.t.numcol th, table.t.numcol td { text-align: center; }
  table.t.numcol th:first-child, table.t.numcol td:first-child { text-align: left; }

  .note { margin-top: 10px; color: #6b7280; }
</style>
