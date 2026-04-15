// @clef-handler style=functional
// ============================================================
// TestGeneration Derived Concept Handler — Stub
//
// Orchestrates the invariant-grammar unification pipeline:
//   1. Discover registered assertion-context plugins via PluginRegistry
//   2. Discover registered test-plan-renderer plugins via PluginRegistry
//   3. Walk all registered specs (concept / widget / sync) or a subset
//      selected by `target`
//   4. Fire the matching parser's parse action for each spec source
//   5. The sync chain takes over from there:
//        ExtractInvariants -> BuildTestPlan -> RenderForEachPlatform -> WriteArtifact
//   6. Return aggregate counters (generated, changed, failed) summed
//      across all TestArtifact/write completions reachable in this run.
//
// Architecture doc: Section 7.1 (invariant grammar portability, MAG-909)
//
// TODO (handler-scaffold-gen, follow-up card):
//   - Implement source discovery: call SpecRegistry/list if registered,
//     else walk the filesystem for .concept / .widget / .sync files
//     (see repertoire/concepts/testing/test-gen.concept for prior art)
//   - Implement aggregation: subscribe to TestArtifact/write completions
//     emitted during the parser fan-out and sum generated/changed/failed
//   - Implement target filtering: "all" | "concept" | "widget" | "sync"
//   - Add fast-fail guard: return error if PluginRegistry/discover returns
//     empty for either "assertion-context" or "test-plan-renderer"
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram,
  complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const KNOWN_SPEC_KINDS = ['all', 'concept', 'widget', 'sync'];

const _testGenerationHandler: FunctionalConceptHandler = {
  /**
   * run(target: String) -> ok(generated: Int; changed: Int; failed: Int) | error(message: String)
   *
   * Entry point for the invariant-grammar unification pipeline.
   *
   * Invariants enforced here (fast-fail guards):
   *   - At least one assertion-context plugin must be registered in PluginRegistry
   *     before parsing begins, otherwise the ExtractInvariants sync cannot classify
   *     invariant symbols and all downstream steps would produce empty plans.
   *   - At least one test-plan-renderer plugin must be registered in PluginRegistry,
   *     otherwise RenderForEachPlatform produces no output and WriteArtifact never fires.
   *   - `target` must be one of "all", "concept", "widget", or "sync".
   *
   * TODO: replace stub with real discovery + parser fan-out logic.
   *   Discovery approach:
   *     if SpecRegistry exists in kernel: call SpecRegistry/list to enumerate sources
   *     else: walk filesystem under process.cwd() for files matching target kind
   *   For each discovered source: call SpecParser/parse (concept), WidgetParser/parse
   *   (widget), or SyncParser/parse (sync). The sync chain handles the rest.
   *   Aggregation: collect TestArtifact/write completion events emitted during
   *   this invocation; sum their generated/changed/failed counters.
   */
  run(input: Record<string, unknown>) {
    const target = (input.target as string) ?? 'all';

    if (!KNOWN_SPEC_KINDS.includes(target)) {
      return complete(
        createProgram(),
        'error',
        { message: `Unknown target "${target}". Valid values: ${KNOWN_SPEC_KINDS.join(', ')}` },
      ) as StorageProgram<Result>;
    }

    // TODO: Discover assertion-context plugins via PluginRegistry/discover.
    // Fast-fail if empty — the pipeline cannot classify invariant symbols
    // without at least one registered assertion-context plugin.
    //   const contexts = await PluginRegistry/discover({ type: 'assertion-context' })
    //   if contexts.length === 0: return error('No assertion-context plugin registered ...')

    // TODO: Discover test-plan-renderer plugins via PluginRegistry/discover.
    // Fast-fail if empty — RenderForEachPlatform would dispatch to zero targets.
    //   const renderers = await PluginRegistry/discover({ type: 'test-plan-renderer' })
    //   if renderers.length === 0: return error('No test-plan-renderer plugin registered ...')

    // TODO: Enumerate spec sources for the selected target kind.
    // Preferred: call SpecRegistry/list (if available in the kernel).
    // Fallback: walk filesystem for .concept / .widget / .sync files relative to cwd.
    // Reference: repertoire/concepts/testing/test-gen.concept §"discover" action.

    // TODO: For each discovered source, call the appropriate parser:
    //   target "concept" | "all": SpecParser/parse({ source })
    //   target "widget"  | "all": WidgetParser/parse({ source })
    //   target "sync"    | "all": SyncParser/parse({ source })
    // The sync chain (ExtractInvariants -> BuildTestPlan -> RenderForEachPlatform
    // -> WriteArtifact) fires automatically from each parse completion.

    // TODO: Collect and aggregate TestArtifact/write completions:
    //   generated += completions where hash changed (new file)
    //   changed   += completions where hash unchanged (no-op write)
    //   failed    += completions returning error variant
    // Return aggregated counters.

    // Stub: return ok with zero counters until discovery logic is implemented.
    return complete(
      createProgram(),
      'ok',
      { generated: 0, changed: 0, failed: 0 },
    ) as StorageProgram<Result>;
  },
};

export const testGenerationHandler = autoInterpret(_testGenerationHandler);
export default testGenerationHandler;
