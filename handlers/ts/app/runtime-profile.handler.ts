// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const runtimeProfileHandler: FunctionalConceptHandler = {
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

    return complete(p, 'ok', { profile: '', name }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'profile', {}, 'profiles');

    return complete(p, 'ok', { profiles: [] }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export default runtimeProfileHandler;
