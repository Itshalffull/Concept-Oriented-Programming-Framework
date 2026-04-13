// Dev-mode file watcher for ProviderManifest.
//
// Subscribes to every file path any registered ManifestReader declared
// interest in (collected from ManifestReader/listReaders output + each
// reader's declared formats). On a change event the watcher debounces and
// dispatches ProviderManifest/reload through the provided kernel invoke
// function, letting the reload handler diff and emit PluginRegistry deltas.
//
// See docs/plans/virtual-provider-registry-prd.md §4.6 (VPR-19).

import { existsSync, watch, type FSWatcher } from 'node:fs';
import { dirname } from 'node:path';

import { listManifestReaderPatterns } from '../app/provider-manifest.handler.ts';

/**
 * Minimal shape of a kernel invoke function: `(concept, action, input) => Promise<result>`.
 * Matches the signature used by existing Connection / kernel-boot integrations.
 */
export type KernelInvokeFn = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<unknown> | unknown;

export interface FileWatcherOptions {
  /**
   * Explicit file paths to watch. If omitted or empty, the watcher consults
   * the ProviderManifest module-level reader dispatch table and watches every
   * format pattern every registered reader declared.
   */
  paths?: string[];
  /** Debounce window in ms (default 250). */
  debounceMs?: number;
}

export interface FileWatcherHandle {
  stop(): void;
  /** Paths currently under watch (resolved on start). */
  watchedPaths: string[];
}

/**
 * Collect the union of file-pattern strings declared by every registered
 * ManifestReader dispatch entry. Globs are reduced to a concrete file path
 * for node:fs.watch by taking the portion up to the first '*' (and falling
 * back to the containing directory when that collapses to empty).
 */
function collectRegisteredPaths(): string[] {
  return listManifestReaderPatterns();
}

function patternToWatchPath(pattern: string): string {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern;
  const prefix = pattern.slice(0, star);
  if (!prefix) return '.';
  // node:fs.watch on a non-existent path throws — fall back to directory
  if (!existsSync(prefix)) {
    const dir = dirname(prefix);
    return dir || '.';
  }
  return prefix;
}

/**
 * Start a dev-mode file watcher. Returns a handle whose `stop()` tears down
 * every subscription. Safe to call even when some declared paths do not yet
 * exist — those subscriptions are silently skipped and can be re-established
 * by stopping and starting the watcher after config is written.
 */
export function startFileWatcher(
  invoke: KernelInvokeFn,
  options: FileWatcherOptions = {},
): FileWatcherHandle {
  const debounceMs = options.debounceMs ?? 250;
  const requested =
    options.paths && options.paths.length > 0
      ? options.paths
      : collectRegisteredPaths();

  const resolved = new Set<string>();
  for (const pat of requested) {
    const target = patternToWatchPath(pat);
    if (existsSync(target)) resolved.add(target);
  }

  const watchers: FSWatcher[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    if (debounceTimer != null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      try {
        const result = invoke('ProviderManifest', 'reload', {});
        if (result != null && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<unknown>).catch(() => {
            /* swallow — dev-mode best-effort */
          });
        }
      } catch {
        /* swallow — dev-mode best-effort */
      }
    }, debounceMs);
  };

  for (const target of resolved) {
    try {
      const w = watch(target, { persistent: false }, () => schedule());
      w.on('error', () => {
        /* swallow — a disappearing file is normal in dev */
      });
      watchers.push(w);
    } catch {
      /* path not watchable — skip */
    }
  }

  return {
    watchedPaths: [...resolved],
    stop() {
      stopped = true;
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          /* ignore */
        }
      }
      watchers.length = 0;
    },
  };
}
