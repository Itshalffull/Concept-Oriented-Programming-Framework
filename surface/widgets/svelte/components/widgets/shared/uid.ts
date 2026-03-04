// Shared unique ID generator for Svelte widgets
let _uid = 0;
export function uid(): string { return "svelte-" + (++_uid); }
