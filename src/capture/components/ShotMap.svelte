<script>
  import Pitch from '../Pitch.svelte';
  import { meta } from '../../stores.js';
  import { toScreen, clamp01 } from '../../lib/space.js';
  import { normalizeOutcome } from '../../lib/outcomes.js';

  export let shots = [];
  export let title = 'Shot map';

  $: viewingLeft =
    $meta && $meta['orientation_left'] != null
      ? Boolean($meta['orientation_left'])
      : true;

  function color(out) {
    if (out === 'goal')       return '#1B5E20';
    if (out === 'two_points') return '#1e88e5';
    if (out === 'point')      return '#16a34a';
    if (out === 'wide')       return '#e11d48';
    if (out === 'short')      return '#9ca3af';
    if (out === 'blocked')    return '#f59e0b';
    return '#111';
  }

  function toMarker(s) {
    const rawx = s?.location?.x_c ?? s?.landing?.x_c ?? s?.location?.nx ?? s?.landing?.nx;
    const rawy = s?.location?.y_c ?? s?.landing?.y_c ?? s?.location?.ny ?? s?.landing?.ny;
    const x_c = clamp01(rawx), y_c = clamp01(rawy);
    const { x, y } = toScreen({ x_c, y_c }, viewingLeft);
    const sx = x * 1000, sy = y * 600;
    const out = normalizeOutcome(s?.shot_outcome || s?.outcome);
    const team = String(s?.shot_team || s?.team || 'us');
    const ctx  = String(s?.shot_context || 'play');
    return { key: s?.id ?? `${sx}-${sy}-${out}-${team}`, x: sx, y: sy, out, team, ctx, c: color(out) };
  }

  $: markers = (shots || []).map(toMarker);
  const keyline = 5; const stroke = 3;
</script>

<div class="tile" style="position:relative">
  <div class="k" style="margin-bottom:.5rem">{title}</div>
  <div class="field">
    <Pitch />
    <svg class="overlay" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      {#each markers as m (m.key)}
        {#if m.out === 'wide'}
          <g transform="translate({m.x},{m.y})">
            <g stroke="#fff" stroke-width="{keyline}">
              <line x1="-8" y1="-8" x2="8" y2="8" />
              <line x1="-8" y1="8" x2="8" y2="-8" />
            </g>
            <g stroke={m.c} stroke-width="{stroke}" stroke-dasharray={m.team==='opp'?'5,4':null}>
              <line x1="-8" y1="-8" x2="8" y2="8" />
              <line x1="-8" y1="8" x2="8" y2="-8" />
            </g>
          </g>
        {:else if m.out === 'short'}
          <g transform="translate({m.x},{m.y})">
            <polygon points="0,-10 9,8 -9,8"
              fill={m.ctx==='play' ? m.c : 'transparent'}
              stroke="#fff" stroke-width="{keyline}"/>
            <polygon points="0,-10 9,8 -9,8"
              fill={m.ctx==='play' ? m.c : 'transparent'}
              stroke={m.c} stroke-width="{stroke}"
              stroke-dasharray={m.team==='opp'?'5,4':null}/>
          </g>
        {:else if m.out === 'blocked'}
          <g>
            <rect x={m.x-9} y={m.y-9} width="18" height="18" fill="none" stroke="#fff" stroke-width="{keyline}" />
            <rect x={m.x-9} y={m.y-9} width="18" height="18"
              fill={m.ctx==='play' ? m.c : 'transparent'}
              stroke={m.c} stroke-width="{stroke}"
              stroke-dasharray={m.team==='opp'?'5,4':null}/>
          </g>
        {:else if m.out === 'two_points'}
          <g transform="translate({m.x},{m.y})">
            <circle r="13" fill="none" stroke="#fff" stroke-width="{keyline}" />
            <circle r="9" fill="none" stroke="#fff" stroke-width="{keyline}" />
            <circle r="13" fill="none" stroke={m.c} stroke-width="{stroke}" stroke-dasharray={m.team==='opp'?'5,4':null}/>
            <circle r="9"  fill="none" stroke={m.c} stroke-width="{stroke}" stroke-dasharray={m.team==='opp'?'5,4':null}/>
          </g>
        {:else if m.out === 'goal'}
          <g>
            <circle cx={m.x} cy={m.y} r="11" fill={m.ctx==='play' ? m.c : 'transparent'} stroke="#fff" stroke-width="{keyline}" />
            <circle cx={m.x} cy={m.y} r="11" fill={m.ctx==='play' ? m.c : 'transparent'} stroke={m.c} stroke-width="{stroke}" stroke-dasharray={m.team==='opp'?'5,4':null}/>
          </g>
        {:else}
          <g>
            <circle cx={m.x} cy={m.y} r="11" fill="transparent" stroke="#fff" stroke-width="{keyline}" />
            <circle cx={m.x} cy={m.y} r="11" fill="transparent" stroke={m.c} stroke-width="{stroke}" stroke-dasharray={m.team==='opp'?'5,4':null}/>
          </g>
        {/if}
      {/each}
    </svg>

    <div class="legend">
      <span class="lg lg-win"></span><span>Goal/Point</span>
      <span class="lg lg-two"></span><span>Two points</span>
      <span class="lg lg-wide"></span><span>Wide</span>
      <span class="lg lg-short"></span><span>Short</span>
      <span class="lg lg-block"></span><span>Blocked</span>
      <span class="lg lg-us"></span><span>Us (solid)</span>
      <span class="lg lg-opp"></span><span>Opp (dashed)</span>
      <span class="lg lg-play"></span><span>From play (filled)</span>
      <span class="lg lg-free"></span><span>Free (hollow)</span>
    </div>
  </div>
</div>
