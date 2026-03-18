// @migrated dsl-constructs 2026-03-18
// Motion Concept Implementation [O]
// Animation durations, easings, and transition definitions with reduced-motion awareness.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _motionHandler: FunctionalConceptHandler = {
  defineDuration(input: Record<string, unknown>) {
    const motion = input.motion as string;
    const name = input.name as string;
    const ms = input.ms as number;

    let p = createProgram();

    if (typeof ms !== 'number' || ms < 0) {
      return complete(p, 'invalid', { message: 'Duration must be a non-negative number in milliseconds' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = motion || nextId('O');

    p = put(p, 'motion', id, {
      name,
      kind: 'duration',
      value: String(ms),
      reducedMotion: ms > 0 ? '0' : String(ms),
    });

    return complete(p, 'ok', { motion: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineEasing(input: Record<string, unknown>) {
    const motion = input.motion as string;
    const name = input.name as string;
    const value = input.value as string;

    let p = createProgram();

    if (!value) {
      return complete(p, 'invalid', { message: 'Easing value is required (e.g., "ease-in-out", "cubic-bezier(0.4, 0, 0.2, 1)")' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = motion || nextId('O');

    p = put(p, 'motion', id, {
      name,
      kind: 'easing',
      value,
      reducedMotion: 'linear',
    });

    return complete(p, 'ok', { motion: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineTransition(input: Record<string, unknown>) {
    const motion = input.motion as string;
    const name = input.name as string;
    const config = input.config as string;

    let p = createProgram();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      return complete(p, 'invalid', { message: 'Transition config must be valid JSON with property, duration, easing, and delay fields' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    if (!parsed.property || !parsed.duration) {
      return complete(p, 'invalid', { message: 'Transition config must include at least "property" and "duration"' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = motion || nextId('O');

    const transitionValue = `${parsed.property} ${parsed.duration}ms ${parsed.easing || 'ease'} ${parsed.delay || 0}ms`;

    p = put(p, 'motion', id, {
      name,
      kind: 'transition',
      value: transitionValue,
      reducedMotion: `${parsed.property} 0ms linear 0ms`,
    });

    return complete(p, 'ok', { motion: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const motionHandler = autoInterpret(_motionHandler);

