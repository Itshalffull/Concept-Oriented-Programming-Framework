// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Capture Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let capCounter = 0;
let subCounter = 0;
export function resetCaptureCounters(): void { capCounter = 0; subCounter = 0; }

const VALID_SCHEDULES = ['*/30 * * * *', '0 * * * *', '0 0 * * *', '@hourly', '@daily', '@weekly'];

const _captureHandler: FunctionalConceptHandler = {
  clip(input: Record<string, unknown>) {
    if (!input.url || (typeof input.url === 'string' && (input.url as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'url is required' }) as StorageProgram<Result>;
    }
    const url = input.url as string;
    const mode = input.mode as string;
    const metadata = input.metadata as string || '{}';

    const itemId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, 'captureItem', itemId, {
      itemId,
      url,
      mode,
      content: '',
      sourceMetadata: {
        url,
        capturedAt: new Date().toISOString(),
        contentType: mode,
        ...JSON.parse(metadata),
      },
      status: 'new',
    });
    return complete(p, 'ok', { itemId, content: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  import(input: Record<string, unknown>) {
    if (!input.file || (typeof input.file === 'string' && (input.file as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'file is required' }) as StorageProgram<Result>;
    }
    const file = input.file as string;
    const options = input.options as string || '{}';

    const itemId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, 'captureItem', itemId, {
      itemId,
      file,
      content: '',
      sourceMetadata: {
        file,
        capturedAt: new Date().toISOString(),
        contentType: 'file_upload',
        ...JSON.parse(options),
      },
      status: 'new',
    });
    return complete(p, 'ok', { itemId, content: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;
    const schedule = input.schedule as string;
    const mode = input.mode as string;

    // Validate schedule: must be a valid cron expression (5 fields) or @keyword
    const isValidCron = (s: string): boolean => {
      if (!s) return false;
      if (s.startsWith('@')) return ['@hourly','@daily','@weekly','@monthly','@yearly','@reboot'].includes(s);
      const parts = s.split(' ');
      return parts.length === 5 && parts.every(p => /^[\d\*\/,\-]+$/.test(p));
    };
    if (!isValidCron(schedule)) {
      return complete(createProgram(), 'error', { message: `Invalid schedule "${schedule}". Use a cron expression or @keyword.` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, 'captureSubscription', subscriptionId, {
      subscriptionId,
      sourceId,
      schedule,
      captureMode: mode,
      lastRun: null,
      watermark: null,
    });
    return complete(p, 'ok', { subscriptionId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  detectChanges(input: Record<string, unknown>) {
    const subscriptionId = input.subscriptionId as string;

    let p = createProgram();
    p = spGet(p, 'captureSubscription', subscriptionId, 'sub');
    p = spGet(p, 'captureItem', subscriptionId, 'item');
    return branch(p,
      (bindings) => !!(bindings.sub || bindings.item),
      (b) => {
        let b2 = put(b, 'captureSubscription', subscriptionId, {
          lastRun: new Date().toISOString(),
        });
        return complete(b2, 'ok', { changeset: '[]' });
      },
      (b) => complete(b, 'notfound', { message: `Subscription "${subscriptionId}" not found` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  markReady(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    let p = createProgram();
    p = spGet(p, 'captureItem', itemId, 'item');
    p = branch(p, 'item',
      (b) => {
        let b2 = put(b, 'captureItem', itemId, { status: 'processing' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Item "${itemId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const captureHandler = autoInterpret(_captureHandler);

