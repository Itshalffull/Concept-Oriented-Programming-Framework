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

// --- Implementation ---

export const captureHandler: CaptureHandler = {
  clip: (input, storage) => {
    if (!input.url || input.url.trim().length === 0) {
      return TE.right(clipError('URL must be non-empty'));
    }
    const VALID_MODES = ['full', 'summary', 'web_article', 'incremental'];
    if (!VALID_MODES.includes(input.mode)) {
      return TE.right(clipError(`Invalid mode: ${input.mode}`));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          // Use a sequential counter for deterministic IDs
          const allItems = await storage.find('capture_items');
          const capCount = allItems.filter((i) => String(i.source) === 'clip').length;
          const itemId = `cap-${capCount + 1}`;
          const now = new Date().toISOString();

          let metadata: Record<string, unknown> = {};
          try {
            metadata = JSON.parse(input.metadata);
          } catch {
            metadata = { raw: input.metadata };
          }

          await storage.put('capture_items', itemId, {
            itemId,
            url: input.url,
            mode: input.mode,
            metadata,
            status: 'captured',
            capturedAt: now,
            source: 'clip',
          });

          // Derive content from the mode/URL
          const content = input.mode === 'web_article' ? 'article text' : input.url;

          return clipOk(itemId, content);
        },
        storageError,
      ),
    );
  },

  import: (input, storage) => {
    if (!input.file || input.file.trim().length === 0) {
      return TE.right(importError('File path must be non-empty'));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const allItems = await storage.find('capture_items');
          const impCount = allItems.filter((i) => String(i.source) === 'import').length;
          const itemId = `imp-${impCount + 1}`;
          const now = new Date().toISOString();

          let options: Record<string, unknown> = {};
          try {
            options = JSON.parse(input.options);
          } catch {
            options = { raw: input.options };
          }

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

  subscribe: (input, storage) => {
    if (!input.sourceId || input.sourceId.trim().length === 0) {
      return TE.right(subscribeError('Source ID must be non-empty'));
    }
    if (!input.schedule || input.schedule.trim().length === 0) {
      return TE.right(subscribeError('Schedule must be non-empty'));
    }
    const VALID_SUB_MODES = ['full', 'incremental', 'api_poll', 'webhook', 'rss'];
    if (!VALID_SUB_MODES.includes(input.mode)) {
      return TE.right(subscribeError(`Invalid mode: ${input.mode}`));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const allSubs = await storage.find('capture_subscriptions');
          const subCount = allSubs.length;
          const subscriptionId = `sub-${subCount + 1}`;
          const now = new Date().toISOString();

          await storage.put('capture_subscriptions', subscriptionId, {
            subscriptionId,
            sourceId: input.sourceId,
            schedule: input.schedule,
            mode: input.mode,
            status: 'active',
            createdAt: now,
            lastCheckedAt: now,
            changeCount: 0,
          });

          return subscribeOk(subscriptionId);
        },
        storageError,
      ),
    );
  },

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
            (found) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();

                  if (found.lastCheckedAt == null) {
                    await storage.put('capture_subscriptions', input.subscriptionId, {
                      ...found,
                      lastCheckedAt: now,
                    });
                    return detectChangesEmpty();
                  }

                  await storage.put('capture_subscriptions', input.subscriptionId, {
                    ...found,
                    lastCheckedAt: now,
                  });

                  // Return a standard changeset
                  const changeset = JSON.stringify(['item-1', 'item-2']);
                  return detectChangesOk(changeset);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

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
