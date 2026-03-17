// Auto-generated entrypoint for suite "clef-devtools", target "cli"
import { Command } from 'commander';
import { specParserCommand } from './spec-parser/spec-parser.command';
import { schemaGenCommand } from './schema-gen/schema-gen.command';
import { syncParserCommand } from './sync-parser/sync-parser.command';
import { syncCompilerCommand } from './sync-compiler/sync-compiler.command';
import { flowTraceCommand } from './flow-trace/flow-trace.command';
import { deploymentValidatorCommand } from './deployment-validator/deployment-validator.command';
import { projectScaffoldCommand } from './project-scaffold/project-scaffold.command';
import { devServerCommand } from './dev-server/dev-server.command';
import { suiteManagerCommand } from './suite-manager/suite-manager.command';
import { kernelBootCommand } from './kernel-boot/kernel-boot.command';
import { deployPlanCommand } from './deploy-plan/deploy-plan.command';
import { vercelRuntimeCommand } from './vercel-runtime/vercel-runtime.command';
import { deployOrchestratorCommand } from './deploy-orchestrator/deploy-orchestrator.command';
import { suiteScaffoldGenCommand } from './suite-scaffold-gen/suite-scaffold-gen.command';
import { deployScaffoldGenCommand } from './deploy-scaffold-gen/deploy-scaffold-gen.command';
import { interfaceScaffoldGenCommand } from './interface-scaffold-gen/interface-scaffold-gen.command';
import { conceptScaffoldGenCommand } from './concept-scaffold-gen/concept-scaffold-gen.command';
import { syncScaffoldGenCommand } from './sync-scaffold-gen/sync-scaffold-gen.command';
import { handlerScaffoldGenCommand } from './handler-scaffold-gen/handler-scaffold-gen.command';
import { storageAdapterScaffoldGenCommand } from './storage-adapter-scaffold-gen/storage-adapter-scaffold-gen.command';
import { transportAdapterScaffoldGenCommand } from './transport-adapter-scaffold-gen/transport-adapter-scaffold-gen.command';
import { surfaceComponentScaffoldGenCommand } from './surface-component-scaffold-gen/surface-component-scaffold-gen.command';
import { surfaceThemeScaffoldGenCommand } from './surface-theme-scaffold-gen/surface-theme-scaffold-gen.command';
import { derivedScaffoldGenCommand } from './derived-scaffold-gen/derived-scaffold-gen.command';
import { generatorCommand } from './generator/generator.command';
import { projectionCommand } from './projection/projection.command';
import { apiSurfaceCommand } from './api-surface/api-surface.command';
import { symbolCommand } from './symbol/symbol.command';
import { symbolOccurrenceCommand } from './symbol-occurrence/symbol-occurrence.command';
import { scopeGraphCommand } from './scope-graph/scope-graph.command';
import { symbolRelationshipCommand } from './symbol-relationship/symbol-relationship.command';
import { conceptEntityCommand } from './concept-entity/concept-entity.command';
import { actionEntityCommand } from './action-entity/action-entity.command';
import { variantEntityCommand } from './variant-entity/variant-entity.command';
import { stateFieldCommand } from './state-field/state-field.command';
import { syncEntityCommand } from './sync-entity/sync-entity.command';
import { widgetEntityCommand } from './widget-entity/widget-entity.command';
import { anatomyPartEntityCommand } from './anatomy-part-entity/anatomy-part-entity.command';
import { widgetStateEntityCommand } from './widget-state-entity/widget-state-entity.command';
import { widgetPropEntityCommand } from './widget-prop-entity/widget-prop-entity.command';
import { themeEntityCommand } from './theme-entity/theme-entity.command';
import { interactorEntityCommand } from './interactor-entity/interactor-entity.command';
import { runtimeFlowCommand } from './runtime-flow/runtime-flow.command';
import { runtimeCoverageCommand } from './runtime-coverage/runtime-coverage.command';
import { performanceProfileCommand } from './performance-profile/performance-profile.command';
import { errorCorrelationCommand } from './error-correlation/error-correlation.command';
import { derivedEntityCommand } from './derived-entity/derived-entity.command';
import { handlerEntityCommand } from './handler-entity/handler-entity.command';
import { widgetImplementationEntityCommand } from './widget-implementation-entity/widget-implementation-entity.command';
import { themeImplementationEntityCommand } from './theme-implementation-entity/theme-implementation-entity.command';
import { deploymentEntityCommand } from './deployment-entity/deployment-entity.command';
import { suiteManifestEntityCommand } from './suite-manifest-entity/suite-manifest-entity.command';
import { interfaceEntityCommand } from './interface-entity/interface-entity.command';
import { deploymentHealthCommand } from './deployment-health/deployment-health.command';
import { infrastructureEntityCommand } from './infrastructure-entity/infrastructure-entity.command';
import { generationProvenanceCommand } from './generation-provenance/generation-provenance.command';
import { testEntityCommand } from './test-entity/test-entity.command';
import { environmentEntityCommand } from './environment-entity/environment-entity.command';
import { dependenceGraphCommand } from './dependence-graph/dependence-graph.command';
import { dataFlowPathCommand } from './data-flow-path/data-flow-path.command';
import { programSliceCommand } from './program-slice/program-slice.command';
import { analysisRuleCommand } from './analysis-rule/analysis-rule.command';
import { semanticEmbeddingCommand } from './semantic-embedding/semantic-embedding.command';
import { scoreApiCommand } from './score-api/score-api.command';
import { scoreIndexCommand } from './score-index/score-index.command';
import { branchCommand } from './branch/branch.command';
import { changeStreamCommand } from './change-stream/change-stream.command';
import { contentHashCommand } from './content-hash/content-hash.command';
import { dAGHistoryCommand } from './daghistory/daghistory.command';
import { diffCommand } from './diff/diff.command';
import { mergeCommand } from './merge/merge.command';
import { patchCommand } from './patch/patch.command';
import { refCommand } from './ref/ref.command';
import { retentionPolicyCommand } from './retention-policy/retention-policy.command';
import { schemaEvolutionCommand } from './schema-evolution/schema-evolution.command';
import { temporalVersionCommand } from './temporal-version/temporal-version.command';
import { attributionCommand } from './attribution/attribution.command';
import { causalClockCommand } from './causal-clock/causal-clock.command';
import { conflictResolutionCommand } from './conflict-resolution/conflict-resolution.command';
import { inlineAnnotationCommand } from './inline-annotation/inline-annotation.command';
import { pessimisticLockCommand } from './pessimistic-lock/pessimistic-lock.command';
import { replicaCommand } from './replica/replica.command';
import { signatureCommand } from './signature/signature.command';
import { actionGuideCommand } from './action-guide/action-guide.command';
import { enrichmentRendererCommand } from './enrichment-renderer/enrichment-renderer.command';
import { storageProgramCommand } from './storage-program/storage-program.command';
import { functionalHandlerCommand } from './functional-handler/functional-handler.command';
import { programInterpreterCommand } from './program-interpreter/program-interpreter.command';
import { programAnalysisCommand } from './program-analysis/program-analysis.command';
import { programCacheCommand } from './program-cache/program-cache.command';
import { lensCommand } from './lens/lens.command';
import { effectHandlerCommand } from './effect-handler/effect-handler.command';
import { completionCoverageCommand } from './completion-coverage/completion-coverage.command';
import { readWriteSetProviderCommand } from './read-write-set-provider/read-write-set-provider.command';
import { commutativityProviderCommand } from './commutativity-provider/commutativity-provider.command';
import { parallelismProviderCommand } from './parallelism-provider/parallelism-provider.command';
import { deadBranchProviderCommand } from './dead-branch-provider/dead-branch-provider.command';
import { invariantExtractionProviderCommand } from './invariant-extraction-provider/invariant-extraction-provider.command';
import { lensExtractionProviderCommand } from './lens-extraction-provider/lens-extraction-provider.command';
import { variantExtractionProviderCommand } from './variant-extraction-provider/variant-extraction-provider.command';
import { transportEffectProviderCommand } from './transport-effect-provider/transport-effect-provider.command';
import { renderTransformCommand } from './render-transform/render-transform.command';
import { tokenRemapProviderCommand } from './token-remap-provider/token-remap-provider.command';
import { a11yAdaptProviderCommand } from './a11y-adapt-provider/a11y-adapt-provider.command';
import { bindRewriteProviderCommand } from './bind-rewrite-provider/bind-rewrite-provider.command';
import { customTransformProviderCommand } from './custom-transform-provider/custom-transform-provider.command';
import { transformExtractionProviderCommand } from './transform-extraction-provider/transform-extraction-provider.command';

const program = new Command();

// Merge commands that share the same name (e.g. multiple scaffold-gen
// concepts all produce a Command('scaffold') with different subcommands).
const allCommands = [specParserCommand, schemaGenCommand, syncParserCommand, syncCompilerCommand, flowTraceCommand, deploymentValidatorCommand, projectScaffoldCommand, devServerCommand, suiteManagerCommand, kernelBootCommand, deployPlanCommand, vercelRuntimeCommand, deployOrchestratorCommand, suiteScaffoldGenCommand, deployScaffoldGenCommand, interfaceScaffoldGenCommand, conceptScaffoldGenCommand, syncScaffoldGenCommand, handlerScaffoldGenCommand, storageAdapterScaffoldGenCommand, transportAdapterScaffoldGenCommand, surfaceComponentScaffoldGenCommand, surfaceThemeScaffoldGenCommand, derivedScaffoldGenCommand, generatorCommand, projectionCommand, apiSurfaceCommand, symbolCommand, symbolOccurrenceCommand, scopeGraphCommand, symbolRelationshipCommand, conceptEntityCommand, actionEntityCommand, variantEntityCommand, stateFieldCommand, syncEntityCommand, widgetEntityCommand, anatomyPartEntityCommand, widgetStateEntityCommand, widgetPropEntityCommand, themeEntityCommand, interactorEntityCommand, runtimeFlowCommand, runtimeCoverageCommand, performanceProfileCommand, errorCorrelationCommand, derivedEntityCommand, handlerEntityCommand, widgetImplementationEntityCommand, themeImplementationEntityCommand, deploymentEntityCommand, suiteManifestEntityCommand, interfaceEntityCommand, deploymentHealthCommand, infrastructureEntityCommand, generationProvenanceCommand, testEntityCommand, environmentEntityCommand, dependenceGraphCommand, dataFlowPathCommand, programSliceCommand, analysisRuleCommand, semanticEmbeddingCommand, scoreApiCommand, scoreIndexCommand, branchCommand, changeStreamCommand, contentHashCommand, dAGHistoryCommand, diffCommand, mergeCommand, patchCommand, refCommand, retentionPolicyCommand, schemaEvolutionCommand, temporalVersionCommand, attributionCommand, causalClockCommand, conflictResolutionCommand, inlineAnnotationCommand, pessimisticLockCommand, replicaCommand, signatureCommand, actionGuideCommand, enrichmentRendererCommand, storageProgramCommand, functionalHandlerCommand, programInterpreterCommand, programAnalysisCommand, programCacheCommand, lensCommand, effectHandlerCommand, completionCoverageCommand, readWriteSetProviderCommand, commutativityProviderCommand, parallelismProviderCommand, deadBranchProviderCommand, invariantExtractionProviderCommand, lensExtractionProviderCommand, variantExtractionProviderCommand, transportEffectProviderCommand, renderTransformCommand, tokenRemapProviderCommand, a11yAdaptProviderCommand, bindRewriteProviderCommand, customTransformProviderCommand, transformExtractionProviderCommand];
const merged = new Map<string, Command>();
for (const cmd of allCommands) {
  const name = cmd.name();
  const existing = merged.get(name);
  if (existing) {
    // Move subcommands from duplicate into the first instance
    for (const sub of cmd.commands) {
      // Skip if the subcommand name already exists on the target
      if (!existing.commands.some((e: Command) => e.name() === sub.name())) {
        existing.addCommand(sub);
      }
    }
  } else {
    merged.set(name, cmd);
  }
}
for (const cmd of merged.values()) {
  program.addCommand(cmd);
}

export default program;
