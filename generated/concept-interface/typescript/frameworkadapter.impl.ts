// ============================================================
// FrameworkAdapter Concept Implementation
//
// Framework adapter registry. Manages registration of rendering
// framework adapters (React, Solid, Vue, etc.), normalizes props
// through framework-specific normalizers, and handles mount/unmount
// lifecycle for render targets.
// Relation: 'adapter' keyed by renderer (R).
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'adapter';

const VALID_FRAMEWORKS = [
  'react',
  'solid',
  'vue',
  'svelte',
  'ink',
  'vanilla',
  'react-native',
  'angular',
];

export const frameworkadapterHandler: ConceptHandler = {
  /**
   * register(renderer, framework, version, normalizer, mountFn)
   *   -> ok(renderer) | duplicate(message)
   *
   * Registers a framework adapter for the given renderer. Checks
   * that no other adapter with the same framework is already registered.
   */
  async register(input, storage) {
    const renderer = input.renderer as string;
    const framework = input.framework as string;
    const version = input.version as string;
    const normalizer = input.normalizer as string;
    const mountFn = input.mountFn as string;

    if (!VALID_FRAMEWORKS.includes(framework)) {
      return {
        variant: 'duplicate',
        message: `Framework "${framework}" is not a valid framework`,
      };
    }

    // Check framework uniqueness across all registered adapters
    const existingByFramework = await storage.find(RELATION, { framework });
    if (existingByFramework.length > 0) {
      return {
        variant: 'duplicate',
        message: `An adapter for framework "${framework}" is already registered`,
      };
    }

    await storage.put(RELATION, renderer, {
      renderer,
      framework,
      version,
      normalizer,
      mountFn,
      status: 'registered',
      mounts: '{}',
    });

    return { variant: 'ok', renderer };
  },

  /**
   * normalize(renderer, props) -> ok(normalized) | notfound(message)
   *
   * Applies the registered normalizer to the given props. Performs a
   * simple pass-through transform wrapping the input with the
   * framework-specific normalizer reference.
   */
  async normalize(input, storage) {
    const renderer = input.renderer as string;
    const props = input.props as string;

    const record = await storage.get(RELATION, renderer);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Adapter for renderer "${renderer}" not found`,
      };
    }

    const framework = record.framework as string;
    const normalizer = record.normalizer as string;

    // Framework-specific normalization: wrap props with normalizer metadata
    let parsedProps: Record<string, unknown>;
    try {
      parsedProps = JSON.parse(props) as Record<string, unknown>;
    } catch {
      parsedProps = { raw: props };
    }

    const normalized = JSON.stringify({
      normalizer,
      framework,
      props: parsedProps,
    });

    return { variant: 'ok', normalized };
  },

  /**
   * mount(renderer, machine, target) -> ok(renderer) | error(message)
   *
   * Stores a mount binding associating a machine instance with a render
   * target through the adapter.
   */
  async mount(input, storage) {
    const renderer = input.renderer as string;
    const machine = input.machine as string;
    const target = input.target as string;

    const record = await storage.get(RELATION, renderer);
    if (!record) {
      return {
        variant: 'error',
        message: `Adapter for renderer "${renderer}" not found`,
      };
    }

    // Parse existing mounts, add the new one
    let mounts: Record<string, string>;
    try {
      mounts = JSON.parse(record.mounts as string) as Record<string, string>;
    } catch {
      mounts = {};
    }

    mounts[target] = machine;

    await storage.put(RELATION, renderer, {
      ...record,
      status: 'mounted',
      mounts: JSON.stringify(mounts),
    });

    return { variant: 'ok', renderer };
  },

  /**
   * unmount(renderer, target) -> ok(renderer) | notfound(message)
   *
   * Removes a mount binding for the given target from the adapter.
   */
  async unmount(input, storage) {
    const renderer = input.renderer as string;
    const target = input.target as string;

    const record = await storage.get(RELATION, renderer);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Adapter for renderer "${renderer}" not found`,
      };
    }

    let mounts: Record<string, string>;
    try {
      mounts = JSON.parse(record.mounts as string) as Record<string, string>;
    } catch {
      mounts = {};
    }

    if (!(target in mounts)) {
      return {
        variant: 'notfound',
        message: `Target "${target}" is not mounted on renderer "${renderer}"`,
      };
    }

    delete mounts[target];

    const hasActiveMounts = Object.keys(mounts).length > 0;

    await storage.put(RELATION, renderer, {
      ...record,
      status: hasActiveMounts ? 'mounted' : 'registered',
      mounts: JSON.stringify(mounts),
    });

    return { variant: 'ok', renderer };
  },
};
