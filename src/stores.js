import { writable } from "svelte/store";

export const isModalOpen = writable(false);
// add any others you had before, e.g.:
export const players = writable([]);
export const selectedPlayer = writable(null);
