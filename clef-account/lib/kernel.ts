import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';
import { authenticationHandler } from '../../handlers/ts/app/authentication.handler';
import { authorizationHandler } from '../handlers/ts/authorization.handler';
import { accessControlHandler } from '../../handlers/ts/app/access-control.handler';
import { sessionHandler } from '../../handlers/ts/app/session.handler';

let _kernel: Kernel | null = null;

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-account:${conceptName}`) ?? createInMemoryStorage();
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/Authentication', authenticationHandler, makeStorage('auth'));
  kernel.registerConcept('urn:clef/Authorization', authorizationHandler, makeStorage('authz'));
  kernel.registerConcept('urn:clef/AccessControl', accessControlHandler, makeStorage('acl'));
  kernel.registerConcept('urn:clef/Session', sessionHandler, makeStorage('session'));

  _kernel = kernel;
  return kernel;
}
