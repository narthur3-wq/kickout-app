<script>
  import { events } from '../stores.js';
  const fmtTime = (ts)=> new Date(ts).toLocaleString();
</script>

<section class="card p-4">
  <h2 class="text-lg font-semibold mb-3">Review</h2>
  <table class="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
    <thead class="bg-gray-50">
      <tr>
        <th class="text-left p-2 border-b">Time</th>
        <th class="text-left p-2 border-b">Side</th>
        <th class="text-left p-2 border-b">Result</th>
        <th class="text-left p-2 border-b">Contest</th>
        <th class="text-left p-2 border-b">Target</th>
        <th class="text-left p-2 border-b">Zone</th>
      </tr>
    </thead>
    <tbody>
      {#each $events as e}
        <tr class="border-b">
          <td class="p-2">{fmtTime(e.ts)}</td>
          <td class="p-2">{e.side==='us'?'Our team':'Opposition'}</td>
          <td class="p-2">{e.win?'Win':'Loss'}</td>
          <td class="p-2">{e.contest_type}</td>
          <td class="p-2">{e.target || '—'}</td>
          <td class="p-2">{e.zone || '—'}</td>
        </tr>
      {/each}
      {#if $events.length===0}
        <tr><td class="p-3 text-gray-600" colspan="6">No events yet.</td></tr>
      {/if}
    </tbody>
  </table>
</section>
