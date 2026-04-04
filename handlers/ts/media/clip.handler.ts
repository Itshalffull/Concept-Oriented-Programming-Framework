// @clef-handler style=functional concept=Clip
// Clip Concept Implementation — Functional (StorageProgram) style
//
// Manages temporal segment clips extracted from audio or video sources.
// Supports create (with duplicate and empty-field guards), resolve (staleness
// check via stored status), get (full metadata retrieval), list (optionally
// filtered by sourceEntity), setLabel (label update), and delete.
// See repertoire/concepts/media/clip.concept for the full spec.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Handler ─────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'Clip' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const clip = input.clip as string;
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const startTime = (input.startTime as string) ?? '';
    const endTime = (input.endTime as string) ?? '';
    const transcript = (input.transcript as string | null) ?? null;
    const transcriptText = (input.transcriptText as string | null) ?? null;
    const label = (input.label as string | null) ?? null;
    const kind = (input.kind as string | null) ?? null;

    if (!sourceEntity || sourceEntity.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceEntity is required' }) as StorageProgram<Result>;
    }
    if (!startTime || startTime.trim() === '') {
      return complete(createProgram(), 'error', { message: 'startTime is required' }) as StorageProgram<Result>;
    }
    if (!endTime || endTime.trim() === '') {
      return complete(createProgram(), 'error', { message: 'endTime is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'clip', clip, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'error', { message: `A clip with id "${clip}" already exists` }),
      (b) => {
        const b2 = put(b, 'clip', clip, {
          clip,
          sourceEntity,
          startTime,
          endTime,
          transcript,
          transcriptText,
          label,
          kind,
          status: 'active',
        });
        return complete(b2, 'ok', { clip });
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const clip = input.clip as string;

    let p = createProgram();
    p = get(p, 'clip', clip, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No clip found with id "${clip}"` }),
      (b) => {
        // Placeholder resolution: return ok or stale based on stored status.
        // Full source-entity verification requires an external MediaAsset lookup
        // which would be wired via perform(). Here the status field drives the outcome.
        return branch(b,
          (bindings) => (bindings.existing as Record<string, unknown>).status === 'stale',
          (bb) => completeFrom(bb, 'stale', (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return { clip: rec.clip as string };
          }),
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return {
              clip: rec.clip as string,
              sourceEntity: rec.sourceEntity as string,
              startTime: rec.startTime as string,
              endTime: rec.endTime as string,
              transcriptText: (rec.transcriptText as string) ?? '',
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const clip = input.clip as string;

    let p = createProgram();
    p = get(p, 'clip', clip, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No clip found with id "${clip}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          clip: rec.clip as string,
          sourceEntity: rec.sourceEntity as string,
          startTime: rec.startTime as string,
          endTime: rec.endTime as string,
          transcript: (rec.transcript as string) ?? '',
          transcriptText: (rec.transcriptText as string) ?? '',
          label: (rec.label as string) ?? '',
          kind: (rec.kind as string) ?? '',
          status: rec.status as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string | null) ?? null;

    let p = createProgram();

    if (sourceEntity && sourceEntity.trim() !== '') {
      p = find(p, 'clip', { sourceEntity }, 'allClips');
    } else {
      p = find(p, 'clip', {}, 'allClips');
    }

    return completeFrom(p, 'ok', (bindings) => {
      const clips = (bindings.allClips ?? []) as Array<Record<string, unknown>>;
      return { clips: JSON.stringify(clips) };
    }) as StorageProgram<Result>;
  },

  setLabel(input: Record<string, unknown>) {
    const clip = input.clip as string;
    const label = (input.label as string) ?? '';

    let p = createProgram();
    p = get(p, 'clip', clip, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No clip found with id "${clip}"` }),
      (b) => {
        const b2 = mergeFrom(b, 'clip', clip, () => ({ label }));
        return complete(b2, 'ok', { clip });
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const clip = input.clip as string;

    let p = createProgram();
    p = get(p, 'clip', clip, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No clip found with id "${clip}"` }),
      (b) => {
        const b2 = del(b, 'clip', clip);
        return complete(b2, 'ok', { clip });
      },
    ) as StorageProgram<Result>;
  },

};

export const clipHandler = autoInterpret(_handler);
