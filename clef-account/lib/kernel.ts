import { createConceptRegistry } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../framework-handlers/sync-engine.handler';
import type { Kernel } from '../runtime/self-hosted';
import { authenticationHandler } from '../handlers/ts/authentication.handler';
import { authorizationHandler } from '../handlers/ts/authorization.handler';
import { accessControlHandler } from '../handlers/ts/access-control.handler';
import { sessionHandler } from '../handlers/ts/session.handler';

let _kernel: Kernel | null = null;

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/Authentication', authenticationHandler);
  kernel.registerConcept('urn:clef/Authorization', authorizationHandler);
  kernel.registerConcept('urn:clef/AccessControl', accessControlHandler);
  kernel.registerConcept('urn:clef/Session', sessionHandler);

  _kernel = kernel;
  return kernel;
}
