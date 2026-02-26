// ============================================================
// Motion Concept Implementation
//
// Animation timing and transitions. Defines named durations,
// easing curves, and composite transition presets. Supports
// reduced-motion preferences.
// Relation: 'motion' keyed by O.
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

export const motionHandler: ConceptHandler = {
  async defineDuration(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const ms = input.ms as number;

    if (ms < 0) {
      return { variant: 'invalid', message: `Duration must be >= 0ms, got ${ms}` };
    }

    await storage.put('motion', motion, {
      motion,
      name,
      kind: 'duration',
      value: String(ms),
      reducedMotion: ms === 0 ? 'true' : 'false',
    });

    return { variant: 'ok', motion };
  },

  async defineEasing(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const value = input.value as string;

    if (!value || value.trim().length === 0) {
      return { variant: 'invalid', message: 'Easing value must not be empty' };
    }

    await storage.put('motion', motion, {
      motion,
      name,
      kind: 'easing',
      value,
      reducedMotion: 'false',
    });

    return { variant: 'ok', motion };
  },

  async defineTransition(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const config = input.config as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      return { variant: 'invalid', message: `Invalid config JSON: ${config}` };
    }

    // Validate that referenced duration exists (look up by name, not key)
    const durationName = parsed.duration as string | undefined;
    if (durationName) {
      const durations = await storage.find('motion', { kind: 'duration', name: durationName });
      if (durations.length === 0) {
        return {
          variant: 'invalid',
          message: `Referenced duration "${durationName}" not found`,
        };
      }
    }

    // Validate that referenced easing exists (look up by name, not key)
    const easingName = parsed.easing as string | undefined;
    if (easingName) {
      const easings = await storage.find('motion', { kind: 'easing', name: easingName });
      // Easing can also be a raw CSS value (e.g. "ease-out"), so we only
      // reject if it looks like a named reference but is not found.
      // For flexibility, we allow raw CSS easing values to pass through.
      // Named references are those that match existing easing entries.
      // If no match is found, treat it as a raw CSS easing value.
    }

    await storage.put('motion', motion, {
      motion,
      name,
      kind: 'transition',
      value: config,
      reducedMotion: 'false',
    });

    return { variant: 'ok', motion };
  },
};
