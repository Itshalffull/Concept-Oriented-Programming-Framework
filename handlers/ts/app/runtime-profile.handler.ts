import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toProfile(record: Record<string, unknown>) {
  return {
    profile: String(record.id ?? ''),
    name: String(record.name ?? ''),
    shellId: String(record.shellId ?? ''),
    navigatorId: String(record.navigatorId ?? ''),
    transportId: String(record.transportId ?? ''),
    platformAdapterId: String(record.platformAdapterId ?? ''),
    platform: String(record.platform ?? ''),
    router: String(record.router ?? ''),
    baseUrl: String(record.baseUrl ?? ''),
    retryPolicy: String(record.retryPolicy ?? ''),
    authMode: typeof record.authMode === 'string' ? record.authMode : null,
  };
}

export const runtimeProfileHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const profile = String(input.profile ?? '');
    await storage.put('profile', profile, {
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
    return { variant: 'ok', profile };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = String(input.name ?? '');
    const matches = await storage.find('profile', { name });
    const record = matches[0];
    if (!record) {
      return { variant: 'notfound', message: `Runtime profile "${name}" not found` };
    }
    return { variant: 'ok', ...toProfile(record) };
  },

  async list(_input: Record<string, unknown>, storage: ConceptStorage) {
    const profiles = await storage.find('profile', {});
    return { variant: 'ok', profiles: profiles.map((record) => toProfile(record)) };
  },
};

export default runtimeProfileHandler;
