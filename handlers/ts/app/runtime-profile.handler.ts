// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _runtimeProfileHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const profile = String(input.profile ?? '');

    let p = createProgram();
    p = put(p, 'profile', profile, {
      id: profile,
      name: String(input.name ?? ''),
      shellId: String(input.shellId ?? ''),
      navigatorId: String(input.navigatorId ?? ''),
      transportId: String(input.transportId ?? ''),
      platformAdapterId: String(input.platformAdapterId ?? ''),
      platform: String(input.platform ?? ''),
      router: String(input.router ?? ''),
      baseUrl: String(input.baseUrl ?? ''),
      retryPolicy: String(input.retryPolicy ?? ''),
      authMode: typeof input.authMode === 'string' ? input.authMode : '',
    });

    return complete(p, 'ok', { profile }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = String(input.name ?? '');

    let p = createProgram();
    p = find(p, 'profile', { name }, 'matches');

    return completeFrom(p, 'ok', (bindings) => {
      const matches = (bindings.matches as Array<Record<string, unknown>>) || [];
      if (matches.length === 0) return { profile: '', name };
      const match = matches[0];
      return { ...match, profile: match.id as string, name: match.name as string };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'profile', {}, 'profiles');

    return completeFrom(p, 'ok', (bindings) => {
      const profiles = (bindings.profiles as Array<Record<string, unknown>>) || [];
      return { profiles };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const runtimeProfileHandler = autoInterpret(_runtimeProfileHandler);


export default runtimeProfileHandler;
