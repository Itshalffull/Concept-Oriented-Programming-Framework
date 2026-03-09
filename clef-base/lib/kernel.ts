import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';

import { componentMappingHandler } from '../../handlers/ts/component-mapping.handler';
import { conceptBrowserHandler } from '../../handlers/ts/concept-browser.handler';
import { slotSourceHandler } from '../../handlers/ts/slot-source.handler';
import { blockEmbedSourceHandler } from '../../handlers/ts/block-embed-source.handler';
import { entityFieldSourceHandler } from '../../handlers/ts/entity-field-source.handler';
import { entityReferenceDisplaySourceHandler } from '../../handlers/ts/entity-reference-display-source.handler';
import { formulaSourceHandler } from '../../handlers/ts/formula-source.handler';
import { menuSourceHandler } from '../../handlers/ts/menu-source.handler';
import { staticValueSourceHandler } from '../../handlers/ts/static-value-source.handler';
import { viewEmbedSourceHandler } from '../../handlers/ts/view-embed-source.handler';
import { widgetEmbedSourceHandler } from '../../handlers/ts/widget-embed-source.handler';
import { hubProxyHandler } from '../handlers/ts/hub-proxy.handler';

let _kernel: Kernel | null = null;

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createInMemoryStorage();
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/ComponentMapping', componentMappingHandler, makeStorage('mapping'));
  kernel.registerConcept('urn:clef/ConceptBrowser', conceptBrowserHandler, makeStorage('browser'));
  kernel.registerConcept('urn:clef/SlotSource', slotSourceHandler);
  kernel.registerConcept('urn:clef/BlockEmbedSource', blockEmbedSourceHandler);
  kernel.registerConcept('urn:clef/EntityFieldSource', entityFieldSourceHandler);
  kernel.registerConcept('urn:clef/EntityReferenceDisplaySource', entityReferenceDisplaySourceHandler);
  kernel.registerConcept('urn:clef/FormulaSource', formulaSourceHandler);
  kernel.registerConcept('urn:clef/MenuSource', menuSourceHandler);
  kernel.registerConcept('urn:clef/StaticValueSource', staticValueSourceHandler);
  kernel.registerConcept('urn:clef/ViewEmbedSource', viewEmbedSourceHandler);
  kernel.registerConcept('urn:clef/WidgetEmbedSource', widgetEmbedSourceHandler);
  kernel.registerConcept('urn:clef/HubProxy', hubProxyHandler);

  _kernel = kernel;
  return kernel;
}
