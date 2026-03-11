import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { appInstallationHandler } from '../../handlers/ts/app/app-installation.handler.js';

describe('appInstallationHandler', () => {
  it('registers and lists installed application units', async () => {
    const storage = createInMemoryStorage();

    await appInstallationHandler.register({
      installation: 'installation:ui-app',
      name: 'ui-app',
      version: '0.5.0',
      status: 'installed',
      registry: 'local',
      description: 'Navigation and shell runtime.',
      concepts: 9,
      syncs: 13,
    }, storage);

    await appInstallationHandler.register({
      installation: 'installation:identity',
      name: 'identity',
      version: '1.0.0',
      status: 'available',
      registry: 'local',
      description: 'Identity concepts.',
      concepts: 6,
      syncs: 4,
    }, storage);

    const installed = await appInstallationHandler.list({
      status: 'installed',
    }, storage);

    expect(installed.installations).toEqual([
      expect.objectContaining({
        installation: 'installation:ui-app',
        name: 'ui-app',
        status: 'installed',
      }),
    ]);
  });
});
