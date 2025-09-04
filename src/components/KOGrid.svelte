<script>
  export let matrix = {}; // key => {att, pct}
  const Ls = ['short','medium','long'];
  const Rs = ['left','centre','right'];

  function key(L,R){ return `${L}-${R}`; }
  function heat(p){ if (!p) return 0; if (p>=60) return 3; if (p>=45) return 2; if (p>0) return 1; return 0; }
</script>

<div class="grid">
  <div></div><div class="hdr">Left</div><div class="hdr">Centre</div><div class="hdr">Right</div>
  {#each Ls as L}
    <div class="hdr">{L === 'short' ? 'Short' : L === 'medium' ? 'Medium' : 'Long'}</div>
    {#each Rs as R}
      {#key `${L}-${R}`}
        {#await Promise.resolve(matrix[key(L,R)] || {att:0,pct:0}) then cell}
          <div class="cell" data-h={heat(cell.pct)}>
            <div class="a">{cell.att} att</div>
            <div class="p">{cell.pct || 0}%</div>
          </div>
        {/await}
      {/key}
    {/each}
  {/each}
</div>

<style>
  .grid{display:grid;grid-template-columns:80px repeat(3,1fr);gap:8px}
  .hdr{font-weight:800;text-align:center}
  .cell{
    border:1px solid var(--border); border-radius:10px; padding:8px; display:grid; gap:4px;
    background:#fff;
  }
  .cell[data-h="1"]{ background:rgba(37,99,235,.06) }
  .cell[data-h="2"]{ background:rgba(37,99,235,.12) }
  .cell[data-h="3"]{ background:rgba(37,99,235,.18) }
  .a{font-size:12px; color:var(--neutral); font-weight:700}
  .p{font-weight:900}
</style>
