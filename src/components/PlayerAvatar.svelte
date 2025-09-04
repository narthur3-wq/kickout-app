<script>
  export let player = 0;      // jersey number
  export let name = '';       // optional name for initials
  // label uses initials if provided, else jersey number or '?'
  $: label = name
    ? name.split(/\s+/).map(n => n[0]).join('').slice(0,2).toUpperCase()
    : (player ? String(player) : '?');
</script>

<div class="avatar">{label}</div>

<style>
  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: #e5e7eb;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 12px;
    color: #111827;
  }
</style>