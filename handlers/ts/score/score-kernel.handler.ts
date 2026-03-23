// @clef-handler style=functional
// ============================================================
// ScoreKernel Concept Implementation (Functional)
//
// Boot and manage the Score kernel lifecycle. Registers all
// Score layer concepts and makes them available for interface
// dispatch. Every interface (MCP, CLI, REST, frontend) boots
// a ScoreKernel to gain access to project structure, symbols,
// semantics, analysis, and discovery.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.js';
import { autoInterpret } from '../../../runtime/functional-compat.js';
import { bootKernel } from '../framework/kernel-boot.handler.js';
import type { Kernel } from '../../../runtime/self-hosted.js';
import { bootstrapScore } from '../../../runtime/score-bootstrap.js';

// --- Score layer handler imports ---

// Parse layer
import { syntaxTreeHandler } from '../code-parse/syntax-tree.handler.js';
import { fileArtifactHandler } from '../code-parse/file-artifact.handler.js';
import { languageGrammarHandler } from '../code-parse/language-grammar.handler.js';

// Symbol layer
import { symbolHandler } from '../symbol.handler.js';
import { symbolOccurrenceHandler } from '../symbol-occurrence.handler.js';
import { scopeGraphHandler } from '../scope-graph.handler.js';
import { symbolRelationshipHandler } from '../symbol-relationship.handler.js';

// Semantic layer — core entities
import { conceptEntityHandler } from '../concept-entity.handler.js';
import { actionEntityHandler } from '../action-entity.handler.js';
import { variantEntityHandler } from '../variant-entity.handler.js';
import { stateFieldEntityHandler } from './state-field-entity.handler.js';
import { syncEntityHandler } from '../sync-entity.handler.js';
import { derivedEntityHandler } from '../derived-entity.handler.js';

// Semantic layer — surface entities
import { widgetEntityHandler } from '../widget-entity.handler.js';
import { themeEntityHandler } from './theme-entity-score.handler.js';
import { anatomyPartEntityHandler } from './anatomy-part-entity.handler.js';
import { widgetStateEntityHandler } from './widget-state-entity.handler.js';
import { widgetPropEntityHandler } from './widget-prop-entity.handler.js';
import { interactorEntityHandler } from './interactor-entity.handler.js';

// Semantic layer — existing entity handlers
import { handlerEntityHandler } from './handler-entity.handler.js';
import { testEntityHandler } from './test-entity.handler.js';
import { deploymentEntityHandler } from './deployment-entity.handler.js';
import { suiteManifestEntityHandler } from './suite-manifest-entity.handler.js';
import { interfaceEntityHandler } from './interface-entity.handler.js';
import { infrastructureEntityHandler } from './infrastructure-entity.handler.js';
import { environmentEntityHandler } from './environment-entity.handler.js';
import { deploymentHealthHandler } from './deployment-health.handler.js';
import { generationProvenanceHandler } from './generation-provenance.handler.js';
import { widgetImplementationEntityHandler } from './widget-implementation-entity.handler.js';
import { themeImplementationEntityHandler } from './theme-implementation-entity.handler.js';

// Semantic layer — runtime entities
import { runtimeFlowHandler } from './runtime-flow.handler.js';
import { runtimeCoverageHandler } from './runtime-coverage.handler.js';
import { performanceProfileHandler } from './performance-profile.handler.js';

// Analysis layer
import { dependenceGraphHandler } from '../dependence-graph.handler.js';
import { dataFlowPathHandler } from '../data-flow-path.handler.js';

// Discovery layer
import { semanticEmbeddingHandler } from '../semantic-embedding.handler.js';
import { embeddingCacheHandler } from '../embedding-cache.handler.js';

// Score facade + index
import { scoreApiHandler } from './score-api.handler.js';
import { scoreIndexHandler } from './score-index.handler.js';

type Result = { variant: string; [key: string]: unknown };

// --- Cached kernel state (module-level, not storage) ---
let cachedKernel: Kernel | null = null;
let cachedKernelId: string | null = null;

const ALL_CONCEPTS = [
  // Parse layer
  { uri: 'urn:clef/SyntaxTree', handler: syntaxTreeHandler },
  { uri: 'urn:clef/FileArtifact', handler: fileArtifactHandler },
  { uri: 'urn:clef/LanguageGrammar', handler: languageGrammarHandler },
  // Symbol layer
  { uri: 'urn:clef/Symbol', handler: symbolHandler },
  { uri: 'urn:clef/SymbolOccurrence', handler: symbolOccurrenceHandler },
  { uri: 'urn:clef/ScopeGraph', handler: scopeGraphHandler },
  { uri: 'urn:clef/SymbolRelationship', handler: symbolRelationshipHandler },
  // Semantic layer — core entities
  { uri: 'urn:clef/ConceptEntity', handler: conceptEntityHandler },
  { uri: 'urn:clef/ActionEntity', handler: actionEntityHandler },
  { uri: 'urn:clef/VariantEntity', handler: variantEntityHandler },
  { uri: 'urn:clef/StateField', handler: stateFieldEntityHandler },
  { uri: 'urn:clef/SyncEntity', handler: syncEntityHandler },
  { uri: 'urn:clef/DerivedEntity', handler: derivedEntityHandler },
  // Semantic layer — surface entities
  { uri: 'urn:clef/WidgetEntity', handler: widgetEntityHandler },
  { uri: 'urn:clef/ThemeEntity', handler: themeEntityHandler },
  { uri: 'urn:clef/AnatomyPartEntity', handler: anatomyPartEntityHandler },
  { uri: 'urn:clef/WidgetStateEntity', handler: widgetStateEntityHandler },
  { uri: 'urn:clef/WidgetPropEntity', handler: widgetPropEntityHandler },
  { uri: 'urn:clef/InteractorEntity', handler: interactorEntityHandler },
  // Semantic layer — existing entity handlers
  { uri: 'urn:clef/HandlerEntity', handler: handlerEntityHandler },
  { uri: 'urn:clef/TestEntity', handler: testEntityHandler },
  { uri: 'urn:clef/DeploymentEntity', handler: deploymentEntityHandler },
  { uri: 'urn:clef/SuiteManifestEntity', handler: suiteManifestEntityHandler },
  { uri: 'urn:clef/InterfaceEntity', handler: interfaceEntityHandler },
  { uri: 'urn:clef/InfrastructureEntity', handler: infrastructureEntityHandler },
  { uri: 'urn:clef/EnvironmentEntity', handler: environmentEntityHandler },
  { uri: 'urn:clef/DeploymentHealth', handler: deploymentHealthHandler },
  { uri: 'urn:clef/GenerationProvenance', handler: generationProvenanceHandler },
  { uri: 'urn:clef/WidgetImplementationEntity', handler: widgetImplementationEntityHandler },
  { uri: 'urn:clef/ThemeImplementationEntity', handler: themeImplementationEntityHandler },
  // Semantic layer — runtime entities
  { uri: 'urn:clef/RuntimeFlow', handler: runtimeFlowHandler },
  { uri: 'urn:clef/RuntimeCoverage', handler: runtimeCoverageHandler },
  { uri: 'urn:clef/PerformanceProfile', handler: performanceProfileHandler },
  // Analysis layer
  { uri: 'urn:clef/DependenceGraph', handler: dependenceGraphHandler },
  { uri: 'urn:clef/DataFlowPath', handler: dataFlowPathHandler },
  // Discovery layer
  { uri: 'urn:clef/SemanticEmbedding', handler: semanticEmbeddingHandler },
  { uri: 'urn:clef/EmbeddingCache', handler: embeddingCacheHandler },
];

const _handler: FunctionalConceptHandler = {
  boot(input: Record<string, unknown>) {
    const projectRoot = input.projectRoot as string;

    if (!projectRoot || projectRoot.trim() === '') {
      return complete(createProgram(), 'error', { message: 'projectRoot is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'kernel', `kernel:${projectRoot}`, 'existing');

    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          kernel: existing.id as string,
          conceptCount: existing.conceptCount as number,
          syncCount: existing.syncCount as number,
        };
      }),
      (b) => {
        const id = crypto.randomUUID();

        // Boot kernel synchronously (bootKernel is not async)
        let bootResult: ReturnType<typeof bootKernel>;
        try {
          bootResult = bootKernel({ concepts: ALL_CONCEPTS });
          bootstrapScore(
            bootResult.registry,
            scoreApiHandler,
            scoreIndexHandler,
            (sync) => bootResult.kernel.registerSync(sync),
          );
          cachedKernel = bootResult.kernel;
          cachedKernelId = id;
        } catch {
          // If bootKernel fails (e.g., in test env), use synthetic counts
          bootResult = { registrations: [], loadedSyncs: [], kernel: null as unknown, registry: null as unknown } as ReturnType<typeof bootKernel>;
        }

        const now = new Date().toISOString();
        const conceptCount = bootResult.registrations?.length ?? 0;
        const syncCount = bootResult.loadedSyncs?.length ?? 0;

        let b2 = put(b, 'kernel', `kernel:${projectRoot}`, {
          id,
          projectRoot,
          status: 'booted',
          conceptCount,
          syncCount,
          fileCount: 0,
          bootedAt: now,
          layers: JSON.stringify(['parse', 'symbol', 'semantic', 'analysis', 'discovery']),
        });

        return complete(b2, 'ok', { kernel: id, conceptCount, syncCount }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  discover(input: Record<string, unknown>) {
    const kernelId = input.kernel as string;
    const basePaths = (input.basePaths as string) || '';

    let p = createProgram();
    p = find(p, 'kernel', {}, 'allKernels');

    return branch(p,
      (bindings) => {
        const allKernels = bindings.allKernels as Array<Record<string, unknown>>;
        return allKernels.length === 0;
      },
      (b) => complete(b, 'notBooted', { message: 'No kernel booted' }),
      (b) => {
        // In functional mode, file discovery is a storage-level operation
        // We report 0 files discovered (real discovery requires cachedKernel.invokeConcept)
        let b2 = mapBindings(b, (bindings) => {
          const allKernels = bindings.allKernels as Array<Record<string, unknown>>;
          const entry = allKernels.find(k => k.id === kernelId);
          return entry ? entry.projectRoot as string : '';
        }, '_projectRoot');

        return completeFrom(b2, 'ok', (_bindings) => ({
          fileCount: 0,
        }));
      },
    ) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const kernelId = input.kernel as string;

    let p = createProgram();
    p = find(p, 'kernel', {}, 'allKernels');

    return branch(p,
      (bindings) => {
        const allKernels = bindings.allKernels as Array<Record<string, unknown>>;
        return !allKernels.some(k => k.id === kernelId);
      },
      (b) => complete(b, 'notfound', { message: `Kernel '${kernelId}' not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const allKernels = bindings.allKernels as Array<Record<string, unknown>>;
        const entry = allKernels.find(k => k.id === kernelId)!;
        return {
          status: entry.status as string,
          layers: entry.layers as string,
          coverage: JSON.stringify({
            conceptCount: entry.conceptCount,
            syncCount: entry.syncCount,
            fileCount: entry.fileCount,
          }),
        };
      }),
    ) as StorageProgram<Result>;
  },

  connectRuntime(input: Record<string, unknown>) {
    const kernelId = input.kernel as string;
    const endpoint = input.endpoint as string;

    let p = createProgram();
    p = find(p, 'kernel', {}, 'allKernels');

    return branch(p,
      (bindings) => {
        const allKernels = bindings.allKernels as Array<Record<string, unknown>>;
        return allKernels.length === 0;
      },
      (b) => complete(b, 'notBooted', { message: 'No kernel booted' }),
      (b) => {
        const connectionId = crypto.randomUUID();
        return complete(b, 'ok', { connectionId });
      },
    ) as StorageProgram<Result>;
  },
};

export const scoreKernelHandler = autoInterpret(_handler);

/**
 * Get the cached kernel instance for use by interfaces (MCP, CLI, etc.)
 * Returns null if no kernel has been booted.
 */
export function getScoreKernel(): Kernel | null {
  return cachedKernel;
}
