// FlakyTest — Flaky test detection and management: records test results and
// detects pass/fail flips indicating flakiness, quarantines flaky tests with
// ownership tracking, releases stabilized tests, checks quarantine status,
// generates flakiness reports, and configures detection policies.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FlakyTestStorage,
  FlakyTestRecordInput,
  FlakyTestRecordOutput,
  FlakyTestQuarantineInput,
  FlakyTestQuarantineOutput,
  FlakyTestReleaseInput,
  FlakyTestReleaseOutput,
  FlakyTestIsQuarantinedInput,
  FlakyTestIsQuarantinedOutput,
  FlakyTestReportInput,
  FlakyTestReportOutput,
  FlakyTestSetPolicyInput,
  FlakyTestSetPolicyOutput,
} from './types.js';

import {
  recordOk,
  recordFlakyDetected,
  quarantineOk,
  quarantineAlreadyQuarantined,
  quarantineNotFound,
  releaseOk,
  releaseNotQuarantined,
  isQuarantinedYes,
  isQuarantinedNo,
  isQuarantinedUnknown,
  reportOk,
  setPolicyOk,
} from './types.js';

export interface FlakyTestError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): FlakyTestError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

const DEFAULT_FLIP_THRESHOLD = 3;
const RECENT_WINDOW_SIZE = 10;

export interface FlakyTestHandler {
  readonly record: (
    input: FlakyTestRecordInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestRecordOutput>;
  readonly quarantine: (
    input: FlakyTestQuarantineInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestQuarantineOutput>;
  readonly release: (
    input: FlakyTestReleaseInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestReleaseOutput>;
  readonly isQuarantined: (
    input: FlakyTestIsQuarantinedInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestIsQuarantinedOutput>;
  readonly report: (
    input: FlakyTestReportInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestReportOutput>;
  readonly setPolicy: (
    input: FlakyTestSetPolicyInput,
    storage: FlakyTestStorage,
  ) => TE.TaskEither<FlakyTestError, FlakyTestSetPolicyOutput>;
}

// --- Implementation ---

const countFlips = (results: readonly boolean[]): number => {
  let flips = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1]) {
      flips++;
    }
  }
  return flips;
};

export const flakyTestHandler: FlakyTestHandler = {
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flaky_tests', input.testId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) => {
        const previousResults = existing
          ? ((existing.recentResults ?? []) as boolean[])
          : [];
        const updatedResults = [...previousResults, input.passed].slice(
          -RECENT_WINDOW_SIZE,
        );
        const flipCount = countFlips(updatedResults);

        return pipe(
          TE.tryCatch(
            async () => {
              const policyRecord = await storage.get('flaky_policy', 'current');
              const threshold = policyRecord
                ? Number(policyRecord.flipThreshold ?? DEFAULT_FLIP_THRESHOLD)
                : DEFAULT_FLIP_THRESHOLD;

              await storage.put('flaky_tests', input.testId, {
                testId: input.testId,
                language: input.language,
                builder: input.builder,
                testType: input.testType,
                recentResults: updatedResults,
                flipCount,
                totalRuns: Number(existing?.totalRuns ?? 0) + 1,
                lastPassed: input.passed,
                lastDuration: input.duration,
                updatedAt: new Date().toISOString(),
              });

              if (flipCount >= threshold) {
                return recordFlakyDetected(
                  input.testId,
                  flipCount,
                  updatedResults,
                );
              }
              return recordOk(input.testId);
            },
            mkError('RECORD_FAILED'),
          ),
        );
      }),
    ),

  quarantine: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flaky_tests', input.testId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((testRecord) =>
        pipe(
          O.fromNullable(testRecord),
          O.fold(
            () => TE.right(quarantineNotFound(input.testId)),
            (found) => {
              if (found.quarantined) {
                return TE.right(quarantineAlreadyQuarantined(input.testId));
              }
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('flaky_tests', input.testId, {
                      ...found,
                      quarantined: true,
                      quarantineReason: input.reason,
                      quarantineOwner: input.owner,
                      quarantinedAt: new Date().toISOString(),
                    });
                    return quarantineOk(input.testId);
                  },
                  mkError('QUARANTINE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),

  release: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flaky_tests', input.testId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((testRecord) =>
        pipe(
          O.fromNullable(testRecord),
          O.fold(
            () => TE.right(releaseNotQuarantined(input.testId)),
            (found) => {
              if (!found.quarantined) {
                return TE.right(releaseNotQuarantined(input.testId));
              }
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('flaky_tests', input.testId, {
                      ...found,
                      quarantined: false,
                      quarantineReason: undefined,
                      quarantineOwner: undefined,
                      quarantinedAt: undefined,
                      releasedAt: new Date().toISOString(),
                    });
                    return releaseOk(input.testId);
                  },
                  mkError('RELEASE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),

  isQuarantined: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flaky_tests', input.testId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((testRecord) =>
        pipe(
          O.fromNullable(testRecord),
          O.fold(
            () => TE.right(isQuarantinedUnknown(input.testId)),
            (found) => {
              if (found.quarantined) {
                return TE.right(
                  isQuarantinedYes(
                    input.testId,
                    String(found.quarantineReason ?? ''),
                    found.quarantineOwner as O.Option<string>,
                    new Date(String(found.quarantinedAt)),
                  ),
                );
              }
              return TE.right(isQuarantinedNo(input.testId));
            },
          ),
        ),
      ),
    ),

  report: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allTests = await storage.find('flaky_tests');
          const filtered = pipe(
            input.testType,
            O.fold(
              () => allTests,
              (tt) => allTests.filter((t) => String(t.testType) === tt),
            ),
          );
          const totalTracked = filtered.length;
          const currentlyFlaky = filtered.filter(
            (t) => Number(t.flipCount ?? 0) >= DEFAULT_FLIP_THRESHOLD,
          ).length;
          const quarantined = filtered.filter((t) => t.quarantined).length;
          const stabilized = filtered.filter(
            (t) =>
              Number(t.flipCount ?? 0) < DEFAULT_FLIP_THRESHOLD &&
              !t.quarantined &&
              Number(t.totalRuns ?? 0) > 5,
          ).length;
          const topFlaky = filtered
            .filter((t) => Number(t.flipCount ?? 0) > 0)
            .sort(
              (a, b) =>
                Number(b.flipCount ?? 0) - Number(a.flipCount ?? 0),
            )
            .slice(0, 10)
            .map((t) => ({
              testId: String(t.testId),
              language: String(t.language),
              testType: String(t.testType),
              flipCount: Number(t.flipCount ?? 0),
              owner: (t.quarantineOwner ?? O.none) as O.Option<string>,
            }));
          return reportOk({
            totalTracked,
            currentlyFlaky,
            quarantined,
            stabilized,
            topFlaky,
          });
        },
        mkError('REPORT_FAILED'),
      ),
    ),

  setPolicy: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const currentPolicy = await storage.get('flaky_policy', 'current');
          const updated = {
            flipThreshold: pipe(
              input.flipThreshold,
              O.getOrElse(() => currentPolicy ? Number(currentPolicy.flipThreshold ?? DEFAULT_FLIP_THRESHOLD) : DEFAULT_FLIP_THRESHOLD),
            ),
            flipWindow: pipe(
              input.flipWindow,
              O.getOrElse(() => currentPolicy ? String(currentPolicy.flipWindow ?? '24h') : '24h'),
            ),
            autoQuarantine: pipe(
              input.autoQuarantine,
              O.getOrElse(() => currentPolicy ? Boolean(currentPolicy.autoQuarantine ?? false) : false),
            ),
            retryCount: pipe(
              input.retryCount,
              O.getOrElse(() => currentPolicy ? Number(currentPolicy.retryCount ?? 0) : 0),
            ),
            updatedAt: new Date().toISOString(),
          };
          await storage.put('flaky_policy', 'current', updated);
          return setPolicyOk();
        },
        mkError('SET_POLICY_FAILED'),
      ),
    ),
};
