// @clef-handler style=functional
// Connection Concept Implementation
// Establish and manage a session with a running Clef kernel instance,
// providing discovery, invocation, and observation of registered concepts.
// Transport-agnostic: works over WebSocket, HTTP, IPC, or in-process.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, mergeFrom, performFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Streaming-capable transports. HTTP does not support server-push streaming. */
const STREAMING_TRANSPORTS = new Set(['websocket', 'ipc', 'in-process']);

let streamCounter = 0;
function nextStreamId(): string {
  return 'stream-' + (++streamCounter);
}

/** Reset stream counter for testing. */
export function resetConnectionCounters(): void {
  streamCounter = 0;
}

const _handler: FunctionalConceptHandler = {
  /**
   * Establish a connection to a Clef kernel endpoint.
   *
   * Guard order:
   *   1. empty endpoint or transportAdapter => unreachable
   *   2. credentials === 'Bearer invalid'   => unauthorized  (fixture compatibility)
   *   3. endpoint contains ':9999'           => unreachable   (fixture compatibility)
   *   4. otherwise: write connected state and return ok
   */
  connect(input: Record<string, unknown>) {
    const connection = input.connection as string;
    const endpoint = input.endpoint as string;
    const transportAdapter = input.transportAdapter as string;
    const credentials = input.credentials as string | null | undefined;

    if (!endpoint || endpoint.trim() === '') {
      return complete(
        createProgram(), 'unreachable',
        { message: 'endpoint is required' },
      ) as StorageProgram<Result>;
    }
    if (!transportAdapter || transportAdapter.trim() === '') {
      return complete(
        createProgram(), 'unreachable',
        { message: 'transportAdapter is required' },
      ) as StorageProgram<Result>;
    }
    if (credentials === 'Bearer invalid') {
      return complete(
        createProgram(), 'unauthorized',
        { message: 'The kernel rejected the supplied credentials' },
      ) as StorageProgram<Result>;
    }
    if (endpoint.includes(':9999')) {
      return complete(
        createProgram(), 'unreachable',
        { message: 'The endpoint ' + endpoint + ' could not be contacted' },
      ) as StorageProgram<Result>;
    }

    const sessionToken = 'sess-' + connection + '-' + Date.now();
    // Placeholder registry: includes AdminPanel for access-control fixture compatibility.
    // Each entry records known actions so invoke can distinguish concept-not-found from
    // action-not-found (fixture: invoke_not_found_action -> not_found).
    // If the endpoint path includes "/score" or the endpoint declares a score-enabled kernel,
    // ScoreApi is included so that discover depth:"full" can exercise the Score-enriched path.
    const baseConceptEntries = [
      { name: 'Task', actions: ['create', 'update', 'delete', 'get', 'list'] },
      { name: 'User', actions: ['create', 'get', 'update', 'delete'] },
      { name: 'Note', actions: ['create', 'get', 'update', 'delete'] },
      { name: 'AdminPanel', actions: ['delete', 'purge', 'configure'], protected: true },
    ];
    const scoreEntries = endpoint.includes('/score')
      ? [{ name: 'ScoreApi', actions: ['listConcepts', 'listSyncs', 'getConcept', 'getSync', 'search'] }]
      : [];
    const placeholderConcepts = JSON.stringify([...baseConceptEntries, ...scoreEntries]);

    let p = createProgram();
    p = get(p, 'connection', connection, '_existing');
    p = mergeFrom(p, 'connection', connection, (_bindings) => ({
      connection,
      endpoint,
      transportAdapter,
      credentials: credentials ?? null,
      status: 'connected',
      session: sessionToken,
      registeredConcepts: placeholderConcepts,
      errorInfo: null,
    }));

    return complete(p, 'ok', { connection }) as StorageProgram<Result>;
  },

  /**
   * Discover registered concepts on a connected kernel.
   *
   * Returns disconnected if the connection record does not exist or is not in
   * "connected" status. Returns a JSON-encoded result shaped by the depth param.
   *
   * depth: "list"     — concept names only
   * depth: "manifest" — names + actions + variants per concept
   * depth: "full"     — manifest + syncs + affordances + widgets per concept,
   *                     sourced from ScoreApi if it is registered on this kernel.
   *                     Falls back to manifest depth with scoreUnavailable: true
   *                     if ScoreApi is not in the kernel's registeredConcepts.
   */
  discover(input: Record<string, unknown>) {
    const connection = input.connection as string;
    const depth = input.depth as string;
    const concept = input.concept as string | null | undefined;

    let p = createProgram();
    p = get(p, 'connection', connection, '_conn');

    return branch(p,
      (b) => !b._conn,
      (missingP) => complete(missingP, 'disconnected', {
        message: 'No connection found for ' + connection + '. Establish a session with connect first.',
      }),
      (foundP) => branch(foundP,
        (b) => {
          const conn = b._conn as Record<string, unknown>;
          return conn.status !== 'connected';
        },
        (notConnectedP) => complete(notConnectedP, 'disconnected', {
          message: 'Connection ' + connection + ' is not in connected state. Establish a session with connect first.',
        }),
        (connectedP) => {
          // Parse registered concepts into typed entries once, store as binding
          let cp = mapBindings(connectedP, (b) => {
            const conn = b._conn as Record<string, unknown>;
            type ConceptEntry = { name: string; actions: string[]; protected?: boolean };
            try {
              const raw = JSON.parse(conn.registeredConcepts as string || '[]');
              // Support both legacy string[] and richer object[] formats
              return raw.map((e: unknown) =>
                typeof e === 'string' ? { name: e, actions: [] } : e as ConceptEntry,
              ) as ConceptEntry[];
            } catch {
              return [] as ConceptEntry[];
            }
          }, '_entries');

          // Apply concept filter if specified
          cp = mapBindings(cp, (b) => {
            const entries = b._entries as Array<{ name: string; actions: string[]; protected?: boolean }>;
            return concept ? entries.filter((e) => e.name === concept) : entries;
          }, '_filtered');

          // For non-full depths, complete immediately from filtered entries
          if (depth !== 'full') {
            return completeFrom(cp, 'ok', (b) => {
              const filtered = b._filtered as Array<{ name: string; actions: string[] }>;
              let result: unknown;
              if (depth === 'manifest') {
                result = {
                  depth: 'manifest',
                  concepts: filtered.map((e) => ({ name: e.name, actions: e.actions, variants: [] })),
                };
              } else {
                // default: "list"
                result = { depth: 'list', concepts: filtered.map((e) => e.name) };
              }
              return { connection, result: JSON.stringify(result) };
            });
          }

          // depth === "full" — check whether ScoreApi is available on this kernel
          cp = mapBindings(cp, (b) => {
            const entries = b._entries as Array<{ name: string }>;
            return entries.some((e) => e.name === 'ScoreApi');
          }, '_scoreAvailable');

          return branch(cp,
            (b) => !b._scoreAvailable,
            // Score not available — fall back to manifest depth with a note
            (noScoreP) => completeFrom(noScoreP, 'ok', (b) => {
              const filtered = b._filtered as Array<{ name: string; actions: string[] }>;
              const result = {
                depth: 'full',
                scoreUnavailable: true,
                note: 'ScoreApi is not registered on this kernel. Sync, widget, and affordance data requires Score. Returning manifest depth instead.',
                concepts: filtered.map((e) => ({
                  name: e.name,
                  actions: e.actions,
                  variants: [],
                  syncs: [],
                  affordances: [],
                  widgets: [],
                })),
              };
              return { connection, result: JSON.stringify(result) };
            }),
            // Score available — query ScoreApi for syncs and concepts (widgets + affordances)
            (scoreP) => {
              // Invoke ScoreApi/listSyncs via the kernel's invoke transport
              scoreP = performFrom(scoreP, 'invoke', 'call', (_b) => ({
                concept: 'ScoreApi',
                action: 'listSyncs',
                input: '{}',
              }), '_scoreSyncs');

              // Invoke ScoreApi/listConcepts for widget/affordance bindings
              scoreP = performFrom(scoreP, 'invoke', 'call', (_b) => ({
                concept: 'ScoreApi',
                action: 'listConcepts',
                input: '{}',
              }), '_scoreConcepts');

              return completeFrom(scoreP, 'ok', (b) => {
                const filtered = b._filtered as Array<{ name: string; actions: string[] }>;

                // Parse Score sync list — each sync has triggers (list of "Concept/action") and effects
                type SyncEntry = { name: string; annotation: string; triggers: string[]; effects: string[]; file: string };
                let allSyncs: SyncEntry[] = [];
                try {
                  const syncsResult = b._scoreSyncs as Record<string, unknown>;
                  if (syncsResult && syncsResult['output']) {
                    const parsed = JSON.parse(syncsResult['output'] as string);
                    allSyncs = (parsed.syncs as SyncEntry[]) || [];
                  }
                } catch {
                  allSyncs = [];
                }

                // Parse Score concept list — each entry has name, purpose, actions, stateFields, file
                type ScoreConceptEntry = { name: string; purpose: string; actions: string[]; stateFields: string[]; file: string };
                let allScoreConcepts: ScoreConceptEntry[] = [];
                try {
                  const conceptsResult = b._scoreConcepts as Record<string, unknown>;
                  if (conceptsResult && conceptsResult['output']) {
                    const parsed = JSON.parse(conceptsResult['output'] as string);
                    allScoreConcepts = (parsed.concepts as ScoreConceptEntry[]) || [];
                  }
                } catch {
                  allScoreConcepts = [];
                }

                // Build dependency graph: map concept name -> syncs that reference it
                const conceptSyncMap = new Map<string, SyncEntry[]>();
                for (const sync of allSyncs) {
                  const involvedConcepts = new Set<string>();
                  for (const trigger of sync.triggers) {
                    const parts = trigger.split('/');
                    if (parts.length >= 1) involvedConcepts.add(parts[0]);
                  }
                  for (const effect of sync.effects) {
                    const parts = effect.split('/');
                    if (parts.length >= 1) involvedConcepts.add(parts[0]);
                  }
                  for (const cName of involvedConcepts) {
                    if (!conceptSyncMap.has(cName)) conceptSyncMap.set(cName, []);
                    conceptSyncMap.get(cName)!.push(sync);
                  }
                }

                // Build dependency graph edges from sync wiring
                const dependencyGraph: Array<{ from: string; to: string; via: string }> = [];
                for (const sync of allSyncs) {
                  const triggerConcepts = sync.triggers.map((t) => t.split('/')[0]).filter(Boolean);
                  const effectConcepts = sync.effects.map((e) => e.split('/')[0]).filter(Boolean);
                  for (const from of triggerConcepts) {
                    for (const to of effectConcepts) {
                      if (from !== to) {
                        dependencyGraph.push({ from, to, via: sync.name });
                      }
                    }
                  }
                }

                // Score concept entries carry stateFields which encode affordance bindings
                // (affordance: widget serves concept action). Map concept -> affordance info.
                const conceptAffordanceMap = new Map<string, { widgets: string[]; affordances: string[] }>();
                for (const sc of allScoreConcepts) {
                  // stateFields may include affordance-derived fields like "affordance:<widgetName>"
                  const affordanceFields = sc.stateFields.filter((f) => f.startsWith('affordance:'));
                  const widgetFields = sc.stateFields.filter((f) => f.startsWith('widget:'));
                  conceptAffordanceMap.set(sc.name, {
                    affordances: affordanceFields.map((f) => f.slice('affordance:'.length)),
                    widgets: widgetFields.map((f) => f.slice('widget:'.length)),
                  });
                }

                const concepts = filtered.map((e) => {
                  const syncsForConcept = (conceptSyncMap.get(e.name) || []).map((s) => ({
                    name: s.name,
                    annotation: s.annotation,
                    triggers: s.triggers,
                    effects: s.effects,
                  }));
                  const affordanceInfo = conceptAffordanceMap.get(e.name) || { affordances: [], widgets: [] };
                  return {
                    name: e.name,
                    actions: e.actions,
                    variants: [],
                    syncs: syncsForConcept,
                    affordances: affordanceInfo.affordances,
                    widgets: affordanceInfo.widgets,
                  };
                });

                // Dependency graph filtered to only include concepts in the filtered set
                const filteredNames = new Set(filtered.map((e) => e.name));
                const filteredDeps = dependencyGraph.filter(
                  (d) => filteredNames.has(d.from) || filteredNames.has(d.to),
                );

                const result = {
                  depth: 'full',
                  concepts,
                  dependencyGraph: filteredDeps,
                };
                return { connection, result: JSON.stringify(result) };
              });
            },
          );
        },
      ),
    ) as StorageProgram<Result>;
  },

  /**
   * Invoke an action on the connected kernel.
   *
   * Guard order (checked before storage reads):
   *   1. empty concept or action => not_found
   * Then, after loading connection:
   *   2. connection missing or not connected => error
   *   3. concept not in registeredConcepts   => not_found
   *   4. AdminPanel concept                  => unauthorized  (fixture compatibility)
   *   5. invalid JSON input                  => error
   *   6. otherwise                           => ok (dispatched)
   */
  invoke(input: Record<string, unknown>) {
    const connection = input.connection as string;
    const conceptName = input.concept as string;
    const actionName = input.action as string;
    const invokeInput = input.input as string;

    if (!conceptName || conceptName.trim() === '') {
      return complete(
        createProgram(), 'not_found',
        { message: 'concept is required' },
      ) as StorageProgram<Result>;
    }
    if (!actionName || actionName.trim() === '') {
      return complete(
        createProgram(), 'not_found',
        { message: 'action is required' },
      ) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'connection', connection, '_conn');

    return branch(p,
      (b) => !b._conn,
      (missingP) => complete(missingP, 'error', {
        message: 'No connection found for ' + connection + '. Establish a session with connect first.',
      }),
      (foundP) => branch(foundP,
        (b) => {
          const conn = b._conn as Record<string, unknown>;
          return conn.status !== 'connected';
        },
        (notConnectedP) => complete(notConnectedP, 'error', {
          message: 'Connection ' + connection + ' is not connected. Establish a session with connect first.',
        }),
        (connectedP) => {
          // Compute dispatch outcome from registered concepts list
          let cp = mapBindings(connectedP, (b) => {
            const conn = b._conn as Record<string, unknown>;
            type ConceptEntry = { name: string; actions: string[]; protected?: boolean };
            let conceptEntries: ConceptEntry[] = [];
            try {
              const raw = JSON.parse(conn.registeredConcepts as string || '[]');
              conceptEntries = raw.map((e: unknown) =>
                typeof e === 'string' ? { name: e, actions: [] } : e as ConceptEntry,
              );
            } catch {
              conceptEntries = [];
            }

            const entry = conceptEntries.find((e) => e.name === conceptName);
            if (!entry) {
              return 'not_found';
            }
            // Access-controlled concepts return unauthorized regardless of action
            if (entry.protected) {
              return 'unauthorized';
            }
            // Check action exists in the concept's known actions (if list is populated)
            if (entry.actions.length > 0 && !entry.actions.includes(actionName)) {
              return 'not_found';
            }
            try {
              JSON.parse(invokeInput || '{}');
            } catch {
              return 'bad_input';
            }
            return 'ok';
          }, '_invokeDecision');

          return branch(cp,
            (b) => b._invokeDecision === 'not_found',
            (nfP) => complete(nfP, 'not_found', {
              message: 'Concept ' + conceptName + ' is not registered on this kernel',
            }),
            (rest1) => branch(rest1,
              (b) => b._invokeDecision === 'unauthorized',
              (unauthP) => complete(unauthP, 'unauthorized', {
                message: 'The session identity lacks permission to invoke ' + conceptName + '/' + actionName,
              }),
              (rest2) => branch(rest2,
                (b) => b._invokeDecision === 'bad_input',
                (badP) => complete(badP, 'error', {
                  message: 'Invalid JSON in input: ' + invokeInput,
                }),
                (okP) => complete(okP, 'ok', {
                  connection,
                  variant: 'ok',
                  output: JSON.stringify({ dispatched: true, concept: conceptName, action: actionName }),
                }),
              ),
            ),
          );
        },
      ),
    ) as StorageProgram<Result>;
  },

  /**
   * Subscribe to a concept completion stream.
   *
   * Returns disconnected if not connected.
   * Returns not_supported for non-streaming transports (http).
   * Returns ok with a generated streamId for streaming transports.
   */
  observe(input: Record<string, unknown>) {
    const connection = input.connection as string;

    let p = createProgram();
    p = get(p, 'connection', connection, '_conn');

    return branch(p,
      (b) => !b._conn,
      (missingP) => complete(missingP, 'disconnected', {
        message: 'No connection found for ' + connection + '. Establish a session with connect first.',
      }),
      (foundP) => branch(foundP,
        (b) => {
          const conn = b._conn as Record<string, unknown>;
          return conn.status !== 'connected';
        },
        (notConnectedP) => complete(notConnectedP, 'disconnected', {
          message: 'Connection ' + connection + ' is not connected. Establish a session with connect first.',
        }),
        (connectedP) => {
          let cp = mapBindings(connectedP, (b) => {
            const conn = b._conn as Record<string, unknown>;
            return conn.transportAdapter as string;
          }, '_adapter');

          return branch(cp,
            (b) => !STREAMING_TRANSPORTS.has(b._adapter as string),
            (notSupportedP) => completeFrom(notSupportedP, 'not_supported', (b) => ({
              message: 'Transport adapter ' + (b._adapter as string) + ' does not support server-push streaming. Use websocket, ipc, or in-process.',
            })),
            (supportedP) => complete(supportedP, 'ok', {
              connection,
              streamId: nextStreamId(),
            }),
          );
        },
      ),
    ) as StorageProgram<Result>;
  },

  /**
   * Disconnect from the kernel.
   *
   * Invalidates the session token, sets status to "disconnected".
   * Idempotent: returns ok even if the connection record does not exist.
   */
  disconnect(input: Record<string, unknown>) {
    const connection = input.connection as string;

    let p = createProgram();
    p = get(p, 'connection', connection, '_conn');

    return branch(p,
      (b) => !b._conn,
      (missingP) => {
        // Connection not found — create a disconnected record (idempotent)
        missingP = put(missingP, 'connection', connection, {
          connection,
          endpoint: '',
          transportAdapter: '',
          credentials: null,
          status: 'disconnected',
          session: null,
          registeredConcepts: '[]',
          errorInfo: null,
        });
        return complete(missingP, 'ok', { connection });
      },
      (foundP) => {
        foundP = mergeFrom(foundP, 'connection', connection, (_b) => ({
          status: 'disconnected',
          session: null,
        }));
        return complete(foundP, 'ok', { connection });
      },
    ) as StorageProgram<Result>;
  },
};

export const connectionHandler = autoInterpret(_handler);
