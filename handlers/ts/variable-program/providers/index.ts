/**
 * Built-in VariableSourceProvider implementations.
 *
 * All 8 providers are exported as an array for convenient batch registration
 * by the boot sync. Registration via PluginRegistry is intentionally NOT done
 * here — that happens in the dedicated register-variable-source-providers.sync.
 *
 * Provider kinds and their canonical expression prefixes:
 *   page     → $page             (current page ContentNode)
 *   url      → $url              (URL path/query parameter)
 *   content  → $content          (arbitrary ContentNode by ID)
 *   query    → $query            (named view query result)
 *   step     → $step             (process step output)
 *   session  → $session          (current user session)
 *   literal  → '                 (single-quoted literal string)
 *   context  → $ctx              (ambient context value)
 */

export type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

export { pageProvider }         from './page-provider.ts';
export { urlProvider }          from './url-provider.ts';
export { contentProvider }      from './content-provider.ts';
export { viewQueryProvider }    from './view-query-provider.ts';
export { processStepProvider }  from './process-step-provider.ts';
export { sessionProvider }      from './session-provider.ts';
export { literalProvider }      from './literal-provider.ts';
export { contextProvider }      from './context-provider.ts';

import { pageProvider }        from './page-provider.ts';
import { urlProvider }         from './url-provider.ts';
import { contentProvider }     from './content-provider.ts';
import { viewQueryProvider }   from './view-query-provider.ts';
import { processStepProvider } from './process-step-provider.ts';
import { sessionProvider }     from './session-provider.ts';
import { literalProvider }     from './literal-provider.ts';
import { contextProvider }     from './context-provider.ts';

import type { VariableSourceProvider } from './source-provider.interface.ts';

/**
 * All 8 built-in source providers as an ordered array.
 *
 * The boot sync iterates this array and calls PluginRegistry/register for
 * each provider under the key "variable-source:<provider.kind>".
 */
export const ALL_SOURCE_PROVIDERS: VariableSourceProvider[] = [
  pageProvider,
  urlProvider,
  contentProvider,
  viewQueryProvider,
  processStepProvider,
  sessionProvider,
  literalProvider,
  contextProvider,
];
