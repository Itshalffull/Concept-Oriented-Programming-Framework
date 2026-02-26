// ============================================================
// FrameworkAdapter Concept Implementation
//
// Framework adapter registry and lifecycle management. Tracks
// which framework adapters are available, their status, and
// mount targets. Each registered framework has a corresponding
// adapter concept (ReactAdapter, SolidAdapter, etc.) that
// handles prop normalization via the adapter pipeline sync.
// Relation: 'adapter' keyed by renderer (R).
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'adapter';

const VALID_FRAMEWORKS = [
  // Web
  'react',
  'solid',
  'vue',
  'svelte',
  'ink',
  'vanilla',
  // JS-runtime native
  'react-native',
  'nativescript',
  // Apple
  'swiftui',
  'watchkit',
  // Android
  'compose',
  'wear-compose',
  // Desktop
  'winui',
  'appkit',
  'gtk',
];

export const frameworkadapterHandler: ConceptHandler = {
  /**
   * register(renderer, framework, version, normalizer, mountFn)
   *   -> ok(renderer) | duplicate(message)
   *
   * Registers a framework adapter. Sets status to "active".
   * Stores normalizer and mount function references.
   */
  async register(input, storage) {
    const renderer = input.renderer as string;
    const framework = input.framework as string;
    const version = input.version as string;
    const normalizer = (input.normalizer as string) ?? '';
    const mountFn = (input.mountFn as string) ?? '';

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
      status: 'active',
      mounts: '{}',
    });

    return { variant: 'ok', renderer };
  },

  /**
   * normalize(renderer, props) -> ok(normalized) | notfound(message)
   *
   * Transform generic Clef Surface props to framework-specific bindings
   * using the adapter's registered normalizer.
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

    // In a real runtime, this would invoke the registered normalizer function.
    // For the concept implementation, we return the props with framework metadata.
    const normalized = JSON.stringify({
      framework: record.framework,
      props: typeof props === 'string' ? JSON.parse(props) : props,
      normalizer: record.normalizer,
    });

    return { variant: 'ok', normalized };
  },

  /**
   * render(renderer, tree, target) -> ok(renderer) | error(message)
   *
   * Render a complete component tree to a target. Composes machine props
   * into a framework-specific hierarchy and calls the root mount function.
   */
  async render(input, storage) {
    const renderer = input.renderer as string;
    const tree = input.tree as string;
    const target = input.target as string;

    const record = await storage.get(RELATION, renderer);
    if (!record) {
      return {
        variant: 'error',
        message: `Adapter for renderer "${renderer}" not found`,
      };
    }

    // Track renders like mounts
    let mounts: Record<string, string>;
    try {
      mounts = JSON.parse(record.mounts as string) as Record<string, string>;
    } catch {
      mounts = {};
    }

    mounts[target] = `tree:${tree}`;

    await storage.put(RELATION, renderer, {
      ...record,
      status: 'mounted',
      mounts: JSON.stringify(mounts),
    });

    return { variant: 'ok', renderer };
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
      status: hasActiveMounts ? 'mounted' : 'active',
      mounts: JSON.stringify(mounts),
    });

    return { variant: 'ok', renderer };
  },

  /**
   * unregister(renderer) -> ok(renderer) | notfound(message)
   *
   * Removes the adapter from the registry.
   */
  async unregister(input, storage) {
    const renderer = input.renderer as string;

    const record = await storage.get(RELATION, renderer);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Adapter for renderer "${renderer}" not found`,
      };
    }

    await storage.del(RELATION, renderer);

    return { variant: 'ok', renderer };
  },
};
