// @migrated dsl-constructs 2026-03-18
// Profile Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _profileHandler: FunctionalConceptHandler = {
  update(input: Record<string, unknown>) {
    const user = input.user as string;
    const bio = input.bio as string;
    const image = input.image as string;

    let p = createProgram();
    p = put(p, 'profile', user, { user, bio, image });
    return complete(p, 'ok', { user, bio, image }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = spGet(p, 'profile', user, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { user, bio: record.bio as string, image: record.image as string };
      }),
      (b) => complete(b, 'notfound', { message: 'No profile found for user' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const profileHandler = autoInterpret(_profileHandler);

