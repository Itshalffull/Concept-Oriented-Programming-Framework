// Capture — Data capture, ingestion, and subscription management
// Clips content from URLs, imports file-based data, subscribes to sources
// for ongoing change detection, and tracks item readiness for downstream processing.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CaptureStorage,
  CaptureClipInput,
  CaptureClipOutput,
  CaptureImportInput,
  CaptureImportOutput,
  CaptureSubscribeInput,
  CaptureSubscribeOutput,
  CaptureDetectChangesInput,
  CaptureDetectChangesOutput,
  CaptureMarkReadyInput,
  CaptureMarkReadyOutput,
} from './types.js';

import {
  clipOk,
  clipError,
  importOk,
  importError,
  subscribeOk,
  subscribeError,
  detectChangesOk,
  detectChangesNotfound,
  detectChangesEmpty,
  markReadyOk,
  markReadyNotfound,
} from './types.js';

export interface CaptureError {
  readonly code: string;
  readonly message: string;
}

export interface CaptureHandler {
  readonly clip: (
    input: CaptureClipInput,
    storage: CaptureStorage,
  ) => TE.TaskEither<CaptureError, CaptureClipOutput>;
  readonly import: (
    input: CaptureImportInput,
    storage: CaptureStorage,
  ) => TE.TaskEither<CaptureError, CaptureImportOutput>;
  readonly subscribe: (
    input: CaptureSubscribeInput,
    storage: CaptureStorage,
  ) => TE.TaskEither<CaptureError, CaptureSubscribeOutput>;
  readonly detectChanges: (
    input: CaptureDetectChangesInput,
    storage: CaptureStorage,
  ) => TE.TaskEither<CaptureError, CaptureDetectChangesOutput>;
  readonly markReady: (
    input: CaptureMarkReadyInput,
    storage: CaptureStorage,
  ) => TE.TaskEither<CaptureError, CaptureMarkReadyOutput>;
}

const storageError = (error: unknown): CaptureError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Valid capture modes
const VALID_MODES: readonly string[] = ['full', 'incremental', 'snapshot', 'delta'];

// Valid schedule formats (cron-like or interval-based)
const isValidSchedule = (schedule: string): boolean =>
  schedule.length > 0 && (
    schedule.includes('*') ||
    schedule.includes('every') ||
    /^\d+[smhd]$/.test(schedule) ||
    schedule === 'manual'
  );

// Generate a deterministic item ID from URL and timestamp
const generateItemId = (source: string): string => {
  const hash = source.split('').reduce((acc, ch) => {
    const code = ch.charCodeAt(0);
    return ((acc << 5) - acc + code) | 0;
  }, 0);
  return `cap_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
};

// --- Implementation ---

export const captureHandler: CaptureHandler = {
  // Clip content from a URL. Validates the URL format and capture mode,
  // then stores the captured item with metadata and provenance.
  clip: (input, storage) => {
    if (!input.url || input.url.trim().length === 0) {
      return TE.right(clipError('URL must be non-empty'));
    }

    if (!VALID_MODES.includes(input.mode)) {
      return TE.right(clipError(
        `Invalid capture mode '${input.mode}'; must be one of: ${VALID_MODES.join(', ')}`,
      ));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const itemId = generateItemId(input.url);
          const now = new Date().toISOString();

          // Parse metadata safely
          let metadata: Record<string, unknown> = {};
          try {
            metadata = JSON.parse(input.metadata);
          } catch {
            metadata = { raw: input.metadata };
          }

          // Store the captured item
          await storage.put('capture_items', itemId, {
            itemId,
            url: input.url,
            mode: input.mode,
            metadata,
            status: 'captured',
            capturedAt: now,
            source: 'clip',
          });

          // Store the content placeholder (actual content would come from the URL)
          const content = JSON.stringify({
            url: input.url,
            mode: input.mode,
            capturedAt: now,
          });

          return clipOk(itemId, content);
        },
        storageError,
      ),
    );
  },

  // Import data from a file. Validates the file reference and stores
  // the imported content with options as provenance metadata.
  import: (input, storage) => {
    if (!input.file || input.file.trim().length === 0) {
      return TE.right(importError('File path must be non-empty'));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const itemId = generateItemId(input.file);
          const now = new Date().toISOString();

          // Parse import options
          let options: Record<string, unknown> = {};
          try {
            options = JSON.parse(input.options);
          } catch {
            options = { raw: input.options };
          }

          // Store the imported item
          await storage.put('capture_items', itemId, {
            itemId,
            file: input.file,
            options,
            status: 'imported',
            importedAt: now,
            source: 'import',
          });

          const content = JSON.stringify({
            file: input.file,
            importedAt: now,
            options,
          });

          return importOk(itemId, content);
        },
        storageError,
      ),
    );
  },

  // Subscribe to a source for ongoing change detection. Validates the
  // schedule format and capture mode, then stores the subscription.
  subscribe: (input, storage) => {
    if (!input.sourceId || input.sourceId.trim().length === 0) {
      return TE.right(subscribeError('Source ID must be non-empty'));
    }

    if (!isValidSchedule(input.schedule)) {
      return TE.right(subscribeError(
        `Invalid schedule '${input.schedule}'; use cron, interval (e.g. '5m'), or 'manual'`,
      ));
    }

    if (!VALID_MODES.includes(input.mode)) {
      return TE.right(subscribeError(
        `Invalid capture mode '${input.mode}'; must be one of: ${VALID_MODES.join(', ')}`,
      ));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const subscriptionId = `sub_${generateItemId(input.sourceId)}`;
          const now = new Date().toISOString();

          await storage.put('capture_subscriptions', subscriptionId, {
            subscriptionId,
            sourceId: input.sourceId,
            schedule: input.schedule,
            mode: input.mode,
            status: 'active',
            createdAt: now,
            lastCheckedAt: null,
            changeCount: 0,
          });

          return subscribeOk(subscriptionId);
        },
        storageError,
      ),
    );
  },

  // Detect changes for a subscription by comparing the current source state
  // against the last known snapshot. Returns the changeset or empty if no changes.
  detectChanges: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('capture_subscriptions', input.subscriptionId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(detectChangesNotfound(
              `Subscription '${input.subscriptionId}' not found`,
            )),
            (found) => {
              const data = found as Record<string, unknown>;
              const lastCheckedAt = data.lastCheckedAt;
              const changeCount = typeof data.changeCount === 'number'
                ? data.changeCount
                : 0;

              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();

                  // Simulate change detection by comparing timestamps
                  // In a real system this would query the source for changes since lastCheckedAt
                  const hasChanges = lastCheckedAt !== null;

                  // Update the subscription's lastCheckedAt
                  await storage.put('capture_subscriptions', input.subscriptionId, {
                    ...data,
                    lastCheckedAt: now,
                    changeCount: hasChanges ? changeCount + 1 : changeCount,
                  });

                  if (!hasChanges) {
                    return detectChangesEmpty();
                  }

                  const changeset = JSON.stringify({
                    subscriptionId: input.subscriptionId,
                    sourceId: data.sourceId,
                    detectedAt: now,
                    previousCheck: lastCheckedAt,
                    changeIndex: changeCount + 1,
                  });

                  return detectChangesOk(changeset);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Mark a captured item as ready for downstream processing.
  // Transitions the item status from captured/imported to ready.
  markReady: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('capture_items', input.itemId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(markReadyNotfound(`Capture item '${input.itemId}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('capture_items', input.itemId, {
                    ...(found as Record<string, unknown>),
                    status: 'ready',
                    readyAt: new Date().toISOString(),
                  });
                  return markReadyOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
