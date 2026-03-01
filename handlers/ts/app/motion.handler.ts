// Motion Concept Implementation [O]
// Animation durations, easings, and transition definitions with reduced-motion awareness.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const motionHandler: ConceptHandler = {
  async defineDuration(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const ms = input.ms as number;

    if (typeof ms !== 'number' || ms < 0) {
      return { variant: 'invalid', message: 'Duration must be a non-negative number in milliseconds' };
    }

    const id = motion || nextId('O');

    await storage.put('motion', id, {
      name,
      kind: 'duration',
      value: String(ms),
      reducedMotion: ms > 0 ? '0' : String(ms),
    });

    return { variant: 'ok', motion: id };
  },

  async defineEasing(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const value = input.value as string;

    if (!value) {
      return { variant: 'invalid', message: 'Easing value is required (e.g., "ease-in-out", "cubic-bezier(0.4, 0, 0.2, 1)")' };
    }

    const id = motion || nextId('O');

    await storage.put('motion', id, {
      name,
      kind: 'easing',
      value,
      reducedMotion: 'linear',
    });

    return { variant: 'ok', motion: id };
  },

  async defineTransition(input, storage) {
    const motion = input.motion as string;
    const name = input.name as string;
    const config = input.config as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      return { variant: 'invalid', message: 'Transition config must be valid JSON with property, duration, easing, and delay fields' };
    }

    if (!parsed.property || !parsed.duration) {
      return { variant: 'invalid', message: 'Transition config must include at least "property" and "duration"' };
    }

    const id = motion || nextId('O');

    const transitionValue = `${parsed.property} ${parsed.duration}ms ${parsed.easing || 'ease'} ${parsed.delay || 0}ms`;

    await storage.put('motion', id, {
      name,
      kind: 'transition',
      value: transitionValue,
      reducedMotion: `${parsed.property} 0ms linear 0ms`,
    });

    return { variant: 'ok', motion: id };
  },
};
