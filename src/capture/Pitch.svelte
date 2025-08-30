<!-- src/capture/Pitch.svelte -->
<script>
  export let overlays = [];         // optional: array of markers, e.g. [{x:0.5,y:0.5,color:'red'}]
  export let landing = null;        // optional: { x, y }
  export let dark = false;          // optional: invert line colors if needed
  export let orientation_left = false; // optional: just a display flag for your label, no transform applied here
</script>

<style>
  .pitch {
    position: relative;
    width: 100%;
    aspect-ratio: 2.1 / 1;          /* responsive rectangle */
    background: #cfe7cf;
    border: 2px solid #6fae7a;
    border-radius: 10px;
    overflow: hidden;
  }
  .lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .mark {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(0,0,0,0.06);
    transform: translate(-50%, -50%);
  }
  .landing {
    border: 3px solid #0ea5e9;
    background: transparent;
    width: 18px;
    height: 18px;
  }
</style>

<div class="pitch">
  <!-- Your white lines SVG (simplified) -->
  <svg class="lines" viewBox="0 0 210 100" preserveAspectRatio="none">
    <rect x="0" y="0" width="210" height="100" fill="none" stroke="white" stroke-width="0.7"/>
    <line x1="105" y1="0" x2="105" y2="100" stroke="white" stroke-width="0.7"/>
    <!-- boxes (simplified) -->
    <rect x="8" y="32" width="30" height="36" fill="none" stroke="white" stroke-width="0.7"/>
    <rect x="172" y="32" width="30" height="36" fill="none" stroke="white" stroke-width="0.7"/>
    <!-- arcs (very rough placeholders) -->
    <circle cx="105" cy="50" r="21" fill="none" stroke="white" stroke-width="0.7" />
  </svg>

  {#if Array.isArray(overlays)}
    {#each overlays as m, i}
      <div
        class="mark"
        style="
          left: {Math.max(0, Math.min(100, m.x * 100))}%;
          top:  {Math.max(0, Math.min(100, m.y * 100))}%;
          background: {m.color || '#ef4444'};
        ">
      </div>
    {/each}
  {/if}

  {#if landing}
    <div class="mark landing"
      style="
        left: {Math.max(0, Math.min(100, landing.x * 100))}%;
        top:  {Math.max(0, Math.min(100, landing.y * 100))}%;
      ">
    </div>
  {/if}
</div>
