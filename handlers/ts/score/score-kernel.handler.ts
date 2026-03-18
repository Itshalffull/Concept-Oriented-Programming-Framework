// ============================================================
// ScoreKernel Concept Implementation (Imperative)
//
// Boot and manage the Score kernel lifecycle. Registers all
// Score layer concepts and makes them available for interface
// dispatch. Every interface (MCP, CLI, REST, frontend) boots
// a ScoreKernel to gain access to the project's structure.
//
// Uses imperative style because kernel bootstrapping requires
// direct system calls (filesystem, imports, process state)
// incompatible with the StorageProgram monad.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';
import { bootKernel } from '../../framework/kernel-boot.handler.js';
import type { Kernel } from '../../../../runtime/self-hosted.js';
import { bootstrapScore } from '../../../../runtime/score-bootstrap.js';

// --- Score layer handler imports ---

// Parse layer
import { syntaxTreeHandler } from '../../code-parse/syntax-tree.handler.js';
import { fileArtifactHandler } from '../../code-parse/file-artifact.handler.js';
import { languageGrammarHandler } from '../../code-parse/language-grammar.handler.js';

// Symbol layer
import { symbolHandler } from '../../symbol.handler.js';
import { symbolOccurrenceHandler } from '../../symbol-occurrence.handler.js';
import { scopeGraphHandler } from '../../scope-graph.handler.js';
import { symbolRelationshipHandler } from '../../symbol-relationship.handler.js';

// Semantic layer — core entities
import { conceptEntityHandler } from '../concept-entity.handler.js';
import { actionEntityHandler } from '../action-entity.handler.js';
import { variantEntityHandler } from '../variant-entity.handler.js';
import { stateFieldEntityHandler } from '../state-field-entity.handler.js';
import { syncEntityHandler } from '../sync-entity.handler.js';
import { derivedEntityHandler } from '../derived-entity.handler.js';

// Semantic layer — surface entities
import { widgetEntityHandler } from '../widget-entity.handler.js';
import { themeEntityHandler } from '../theme-entity-score.handler.js';
import { anatomyPartEntityHandler } from '../anatomy-part-entity.handler.js';
import { widgetStateEntityHandler } from '../widget-state-entity.handler.js';
import { widgetPropEntityHandler } from '../widget-prop-entity.handler.js';
import { interactorEntityHandler } from '../interactor-entity.handler.js';

// Semantic layer — existing entity handlers
import { handlerEntityHandler } from '../handler-entity.handler.js';
import { testEntityHandler } from '../test-entity.handler.js';
import { deploymentEntityHandler } from '../deployment-entity.handler.js';
import { suiteManifestEntityHandler } from '../suite-manifest-entity.handler.js';
import { interfaceEntityHandler } from '../interface-entity.handler.js';
import { infrastructureEntityHandler } from '../infrastructure-entity.handler.js';
import { environmentEntityHandler } from '../environment-entity.handler.js';
import { deploymentHealthHandler } from '../deployment-health.handler.js';
import { generationProvenanceHandler } from '../generation-provenance.handler.js';
import { widgetImplementationEntityHandler } from '../widget-implementation-entity.handler.js';
import { themeImplementationEntityHandler } from '../theme-implementation-entity.handler.js';

// Semantic layer — runtime entities
import { runtimeFlowHandler } from '../runtime-flow.handler.js';
import { runtimeCoverageHandler } from '../runtime-coverage.handler.js';
import { performanceProfileHandler } from '../performance-profile.handler.js';

// Analysis layer
import { dependenceGraphHandler } from '../../dependence-graph.handler.js';
import { dataFlowPathHandler } from '../../data-flow-path.handler.js';

// Discovery layer
import { semanticEmbeddingHandler } from '../../semantic-embedding.handler.js';

// Score facade + index
import { scoreApiHandler } from '../score-api.handler.js';
import { scoreIndexHandler } from '../score-index.handler.js';

// --- Cached kernel state ---

let cachedKernel: Kernel | null = null;
let cachedKernelId: string | null = null;

export const scoreKernelHandler: ConceptHandler = {

  async boot(input, storage) {
    const projectRoot = input.projectRoot as string;

    // Check if already booted
    const existing = await storage.get('kernel', `kernel:${projectRoot}`);
    if (existing && cachedKernel) {
      return { variant: 'alreadyBooted', kernel: existing.id };
    }

    const id = crypto.randomUUID();

    // Boot kernel with all Score layer concepts
    const result = bootKernel({
      concepts: [
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
      ],
    });

    // Bootstrap Score indexing syncs (ConceptEntity/register → ScoreIndex/upsert, etc.)
    bootstrapScore(
      result.registry,
      scoreApiHandler,
      scoreIndexHandler,
      (sync) => result.kernel.registerSync(sync),
    );

    // Cache the booted kernel for subsequent calls
    cachedKernel = result.kernel;
    cachedKernelId = id;

    const now = new Date().toISOString();
    await storage.put('kernel', `kernel:${projectRoot}`, {
      id,
      projectRoot,
      status: 'booted',
      conceptCount: result.registrations.length,
      syncCount: result.loadedSyncs.length,
      fileCount: 0,
      bootedAt: now,
      layers: JSON.stringify([
        'parse', 'symbol', 'semantic', 'analysis', 'discovery',
      ]),
    });

    return {
      variant: 'ok',
      kernel: id,
      conceptCount: result.registrations.length,
      syncCount: result.loadedSyncs.length,
    };
  },

  async discover(input, storage) {
    const kernelId = input.kernel as string;

    if (!cachedKernel) {
      return { variant: 'notBooted' };
    }

    const basePaths = input.basePaths as string;
    const paths = basePaths.split(',').map(p => p.trim()).filter(Boolean);

    // Walk each base path and register files via FileArtifact
    // This triggers: FileArtifact/register → syncs → SyntaxTree/parse →
    // entity registration → ScoreIndex upsert
    let fileCount = 0;

    for (const basePath of paths) {
      try {
        const result = await cachedKernel.invokeConcept(
          'urn:clef/FileArtifact', 'discover', { basePath },
        );
        if (result && typeof result.fileCount === 'number') {
          fileCount += result.fileCount;
        }
      } catch {
        // Non-fatal — some paths may not exist
      }
    }

    // Update kernel record with file count
    const all = await storage.find('kernel');
    const entry = all.find(k => k.id === kernelId);
    if (entry) {
      await storage.put('kernel', `kernel:${entry.projectRoot}`, {
        ...entry,
        fileCount,
      });
    }

    return { variant: 'ok', fileCount };
  },

  async status(input, storage) {
    const kernelId = input.kernel as string;

    const all = await storage.find('kernel');
    const entry = all.find(k => k.id === kernelId);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      status: entry.status as string,
      layers: entry.layers as string,
      coverage: JSON.stringify({
        conceptCount: entry.conceptCount,
        syncCount: entry.syncCount,
        fileCount: entry.fileCount,
      }),
    };
  },

  async connectRuntime(input, storage) {
    const kernelId = input.kernel as string;

    if (!cachedKernel) {
      return { variant: 'notBooted' };
    }

    const endpoint = input.endpoint as string;
    const connectionId = crypto.randomUUID();

    // Future: connect a ChangeStream endpoint for live runtime data ingestion
    // For now, return a connection ID that can be used when the bridge is built
    return { variant: 'ok', connectionId };
  },
};

/**
 * Get the cached kernel instance for use by interfaces (MCP, CLI, etc.)
 * Returns null if no kernel has been booted.
 */
export function getScoreKernel(): Kernel | null {
  return cachedKernel;
}
