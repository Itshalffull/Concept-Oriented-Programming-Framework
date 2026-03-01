// RuntimeCoverage — Runtime code coverage tracking across actions, syncs, and widgets
// Records execution hits, computes coverage percentages, detects dead code at runtime.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RuntimeCoverageStorage,
  RuntimeCoverageRecordInput,
  RuntimeCoverageRecordOutput,
  RuntimeCoverageCoverageReportInput,
  RuntimeCoverageCoverageReportOutput,
  RuntimeCoverageVariantCoverageInput,
  RuntimeCoverageVariantCoverageOutput,
  RuntimeCoverageSyncCoverageInput,
  RuntimeCoverageSyncCoverageOutput,
  RuntimeCoverageWidgetStateCoverageInput,
  RuntimeCoverageWidgetStateCoverageOutput,
  RuntimeCoverageWidgetLifecycleReportInput,
  RuntimeCoverageWidgetLifecycleReportOutput,
  RuntimeCoverageWidgetRenderTraceInput,
  RuntimeCoverageWidgetRenderTraceOutput,
  RuntimeCoverageWidgetComparisonInput,
  RuntimeCoverageWidgetComparisonOutput,
  RuntimeCoverageDeadAtRuntimeInput,
  RuntimeCoverageDeadAtRuntimeOutput,
} from './types.js';

import {
  recordOk,
  recordCreated,
  coverageReportOk,
  variantCoverageOk,
  syncCoverageOk,
  widgetStateCoverageOk,
  widgetLifecycleReportOk,
  widgetRenderTraceOk,
  widgetRenderTraceNotfound,
  widgetComparisonOk,
  deadAtRuntimeOk,
} from './types.js';

export interface RuntimeCoverageError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): RuntimeCoverageError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const coverageKey = (symbol: string, kind: string): string =>
  `cov_${kind}_${symbol}`;

export interface RuntimeCoverageHandler {
  readonly record: (
    input: RuntimeCoverageRecordInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageRecordOutput>;
  readonly coverageReport: (
    input: RuntimeCoverageCoverageReportInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageCoverageReportOutput>;
  readonly variantCoverage: (
    input: RuntimeCoverageVariantCoverageInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageVariantCoverageOutput>;
  readonly syncCoverage: (
    input: RuntimeCoverageSyncCoverageInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageSyncCoverageOutput>;
  readonly widgetStateCoverage: (
    input: RuntimeCoverageWidgetStateCoverageInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageWidgetStateCoverageOutput>;
  readonly widgetLifecycleReport: (
    input: RuntimeCoverageWidgetLifecycleReportInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageWidgetLifecycleReportOutput>;
  readonly widgetRenderTrace: (
    input: RuntimeCoverageWidgetRenderTraceInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageWidgetRenderTraceOutput>;
  readonly widgetComparison: (
    input: RuntimeCoverageWidgetComparisonInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageWidgetComparisonOutput>;
  readonly deadAtRuntime: (
    input: RuntimeCoverageDeadAtRuntimeInput,
    storage: RuntimeCoverageStorage,
  ) => TE.TaskEither<RuntimeCoverageError, RuntimeCoverageDeadAtRuntimeOutput>;
}

// --- Implementation ---

export const runtimeCoverageHandler: RuntimeCoverageHandler = {
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = coverageKey(input.symbol, input.kind);
          const existing = await storage.get('coverage', key);

          if (existing) {
            const hitCount = Number(existing['hitCount'] ?? 0) + 1;
            await storage.put('coverage', key, {
              ...existing,
              hitCount,
              lastFlowId: input.flowId,
              lastHitAt: new Date().toISOString(),
            });
            return recordOk(key);
          }

          await storage.put('coverage', key, {
            id: key,
            symbol: input.symbol,
            kind: input.kind,
            hitCount: 1,
            firstFlowId: input.flowId,
            lastFlowId: input.flowId,
            firstHitAt: new Date().toISOString(),
            lastHitAt: new Date().toISOString(),
          });
          return recordCreated(key);
        },
        storageError,
      ),
    ),

  coverageReport: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entries = await storage.find('coverage', { kind: input.kind });
          const allSymbols = await storage.find('registered_symbol', { kind: input.kind });
          const total = Math.max(allSymbols.length, entries.length);
          const covered = entries.length;
          const report = {
            kind: input.kind,
            since: input.since,
            totalSymbols: total,
            coveredSymbols: covered,
            coveragePercent: total === 0 ? 100 : Math.round((covered / total) * 100),
            entries: entries.map((e) => ({
              symbol: String(e['symbol']),
              hitCount: Number(e['hitCount'] ?? 0),
            })),
          };
          return coverageReportOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  variantCoverage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const variants = await storage.find('coverage', { kind: 'variant' });
          const conceptVariants = variants.filter((v) =>
            String(v['symbol'] ?? '').startsWith(input.concept),
          );
          const allDeclared = await storage.find('variant_declaration', { concept: input.concept });
          const total = Math.max(allDeclared.length, 1);
          const covered = conceptVariants.length;
          const report = {
            concept: input.concept,
            totalVariants: total,
            coveredVariants: covered,
            coveragePercent: Math.round((covered / total) * 100),
            uncovered: allDeclared
              .filter((d) => !conceptVariants.some((c) => String(c['symbol']) === String(d['name'])))
              .map((d) => String(d['name'])),
          };
          return variantCoverageOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  syncCoverage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const syncEntries = await storage.find('coverage', { kind: 'sync' });
          const allSyncs = await storage.find('sync_entity');
          const total = Math.max(allSyncs.length, 1);
          const covered = syncEntries.length;
          const report = {
            since: input.since,
            totalSyncs: total,
            exercisedSyncs: covered,
            coveragePercent: Math.round((covered / total) * 100),
          };
          return syncCoverageOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  widgetStateCoverage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const stateEntries = await storage.find('coverage', { kind: 'widget_state' });
          const widgetStates = stateEntries.filter((e) =>
            String(e['symbol'] ?? '').startsWith(input.widget),
          );
          const allStates = await storage.find('widget_state_declaration', { widget: input.widget });
          const total = Math.max(allStates.length, 1);
          const covered = widgetStates.length;
          const report = {
            widget: input.widget,
            totalStates: total,
            coveredStates: covered,
            coveragePercent: Math.round((covered / total) * 100),
          };
          return widgetStateCoverageOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  widgetLifecycleReport: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const lifecycle = await storage.find('widget_lifecycle', { widget: input.widget });
          const report = {
            widget: input.widget,
            since: input.since,
            mountCount: lifecycle.filter((e) => String(e['event']) === 'mount').length,
            unmountCount: lifecycle.filter((e) => String(e['event']) === 'unmount').length,
            updateCount: lifecycle.filter((e) => String(e['event']) === 'update').length,
            errorCount: lifecycle.filter((e) => String(e['event']) === 'error').length,
          };
          return widgetLifecycleReportOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  widgetRenderTrace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('render_trace', { widgetInstance: input.widgetInstance }),
        storageError,
      ),
      TE.map((records) =>
        records.length === 0
          ? widgetRenderTraceNotfound()
          : widgetRenderTraceOk(JSON.stringify(records.map((r) => ({
              renderIndex: Number(r['renderIndex'] ?? 0),
              durationMs: Number(r['durationMs'] ?? 0),
              stateSnapshot: String(r['stateSnapshot'] ?? '{}'),
            })))),
      ),
    ),

  widgetComparison: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allWidgetCov = await storage.find('coverage', { kind: 'widget' });
          const sorted = [...allWidgetCov]
            .sort((a, b) => Number(b['hitCount'] ?? 0) - Number(a['hitCount'] ?? 0))
            .slice(0, input.topN);
          const ranking = sorted.map((w, i) => ({
            rank: i + 1,
            widget: String(w['symbol']),
            hitCount: Number(w['hitCount'] ?? 0),
          }));
          return widgetComparisonOk(JSON.stringify(ranking));
        },
        storageError,
      ),
    ),

  deadAtRuntime: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRegistered = await storage.find('registered_symbol', { kind: input.kind });
          const covered = await storage.find('coverage', { kind: input.kind });
          const coveredSymbols = new Set(covered.map((c) => String(c['symbol'])));
          const neverExercised = allRegistered
            .filter((r) => !coveredSymbols.has(String(r['symbol'] ?? r['name'])))
            .map((r) => String(r['symbol'] ?? r['name']));
          return deadAtRuntimeOk(JSON.stringify(neverExercised));
        },
        storageError,
      ),
    ),
};
