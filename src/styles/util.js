// /src/styles/util.js

/**
 * Returns the class list for a “pill” button.
 * Usage in Svelte:
 *   class={pill(isActive)}
 *   // or
 *   class={`btn ${pill(isActive)}`}
 */
export function pill(isActive) {
  return `pill${isActive ? ' active' : ''}`;
}
