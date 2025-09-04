<script>
  export let leftLabel = 'Us';
  export let leftPct = 0;
  export let leftDetail = '';  // e.g. "W13/L8"
  export let rightLabel = 'Opp';
  export let rightPct = 0;
  export let rightDetail = ''; // e.g. "W10/L11"
</script>

<div class="wrap">
  <div class="row">
    <div class="tag us">{leftLabel}</div>
    <div class="statbar"><span style="width:{leftPct}%;"></span></div>
    <div class="val us">{leftPct}%</div>
  </div>
  <div class="sub us">{leftDetail}</div>

  <div class="row">
    <div class="tag opp">{rightLabel}</div>
    <div class="statbar"><span class="opp" style="width:{rightPct}%;"></span></div>
    <div class="val opp">{rightPct}%</div>
  </div>
  <div class="sub opp">{rightDetail}</div>
</div>

<style>
  .wrap{display:grid; gap:6px}
  .row{display:grid; grid-template-columns:42px 1fr auto; gap:8px; align-items:center}
  .tag{font-weight:800}
  .us{color:var(--us)} .opp{color:var(--opp)}
  .val{font-weight:900}
  .sub{font-size:12px; color:var(--neutral); font-weight:700}
</style>
