// @clef-handler style=functional
// StructureDetector Handler
//
// Detect structured patterns (dates, tags, key-value pairs, URLs, emails)
// in freeform text and propose promotions to typed properties. Enables
// progressive formalization of unstructured content.
//
// Built-in detectors are always available: kv_detector, date_detector,
// tag_detector, url_detector, email_detector.
// Custom detectors are registered via registerDetector().

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ────────────────────────────────────────────────────────────────────────────
// Built-in detectors
// ────────────────────────────────────────────────────────────────────────────

interface DetectionResult {
  field: string;
  rawValue: string;
  normalizedValue: string;
  confidence: number;
  detectorName: string;
}

interface BuiltinDetector {
  name: string;
  fieldType: string;
  detect(content: string): DetectionResult[];
}

const KV_SOURCE = /^([A-Za-z_][A-Za-z0-9_\-\s]{0,40}):\s+(.+)$/;
const DATE_SOURCE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i;
const TAG_SOURCE = /#([A-Za-z][A-Za-z0-9_\-]{0,49})\b/;
const URL_SOURCE = /https?:\/\/[^\s"'<>)]+/i;
const EMAIL_SOURCE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

function runPattern(content: string, source: RegExp, flags: string, handler: (m: RegExpExecArray) => DetectionResult): DetectionResult[] {
  const results: DetectionResult[] = [];
  const re = new RegExp(source.source, flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    results.push(handler(m));
    if (!flags.includes('g')) break;
  }
  return results;
}

const BUILTIN_DETECTORS: BuiltinDetector[] = [
  {
    name: 'kv_detector',
    fieldType: 'String',
    detect(content) {
      return runPattern(content, KV_SOURCE, 'gm', (m) => ({
        field: m[1].trim().toLowerCase().replace(/[\s\-]+/g, '_'),
        rawValue: m[2].trim(),
        normalizedValue: m[2].trim(),
        confidence: 0.9,
        detectorName: 'kv_detector',
      }));
    },
  },
  {
    name: 'date_detector',
    fieldType: 'DateTime',
    detect(content) {
      return runPattern(content, DATE_SOURCE, 'gi', (m) => {
        const raw = m[0];
        const parsed = new Date(raw);
        const normalized = isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
        return { field: 'date', rawValue: raw, normalizedValue: normalized, confidence: 0.85, detectorName: 'date_detector' };
      });
    },
  },
  {
    name: 'tag_detector',
    fieldType: 'String',
    detect(content) {
      return runPattern(content, TAG_SOURCE, 'g', (m) => ({
        field: 'tag', rawValue: m[0], normalizedValue: m[1].toLowerCase(), confidence: 0.95, detectorName: 'tag_detector',
      }));
    },
  },
  {
    name: 'url_detector',
    fieldType: 'String',
    detect(content) {
      return runPattern(content, URL_SOURCE, 'gi', (m) => ({
        field: 'url', rawValue: m[0], normalizedValue: m[0], confidence: 0.98, detectorName: 'url_detector',
      }));
    },
  },
  {
    name: 'email_detector',
    fieldType: 'String',
    detect(content) {
      return runPattern(content, EMAIL_SOURCE, 'g', (m) => ({
        field: 'email', rawValue: m[0], normalizedValue: m[0].toLowerCase(), confidence: 0.97, detectorName: 'email_detector',
      }));
    },
  },
];

const BUILTIN_DETECTOR_MAP = new Map<string, BuiltinDetector>(
  BUILTIN_DETECTORS.map(d => [d.name, d]),
);

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  detect(input: Record<string, unknown>) {
    const content = (input.content as string) ?? '';
    const rawDetectors = input.detectors;
    const detectorNames: string[] = Array.isArray(rawDetectors)
      ? (rawDetectors as string[])
      : typeof rawDetectors === 'string' && rawDetectors !== ''
      ? (() => { try { return JSON.parse(rawDetectors); } catch { return []; } })()
      : [];

    if (!content || content.trim() === '') {
      return complete(createProgram(), 'error', { message: 'content is required' }) as StorageProgram<Result>;
    }

    if (detectorNames.length === 0) {
      // Run all built-ins
      const detections = BUILTIN_DETECTORS.flatMap(d => d.detect(content));
      return complete(createProgram(), 'ok', { detections: JSON.stringify(detections) }) as StorageProgram<Result>;
    }

    const unknownNames = detectorNames.filter(n => !BUILTIN_DETECTOR_MAP.has(n));

    if (unknownNames.length === 0) {
      // All requested are built-ins
      const detections = detectorNames.flatMap(n => BUILTIN_DETECTOR_MAP.get(n)!.detect(content));
      return complete(createProgram(), 'ok', { detections: JSON.stringify(detections) }) as StorageProgram<Result>;
    }

    // Some may be custom — look up the first unknown to validate existence
    const firstUnknown = unknownNames[0];
    let p = createProgram();
    p = get(p, 'structure-detector', firstUnknown, 'customRecord');
    return branch(p,
      (b) => !b.customRecord,
      (b) => complete(b, 'error', { message: `Unknown detector: ${firstUnknown}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const customRecord = bindings.customRecord as Record<string, unknown>;
        const detections: DetectionResult[] = [];
        for (const name of detectorNames) {
          const builtin = BUILTIN_DETECTOR_MAP.get(name);
          if (builtin) {
            detections.push(...builtin.detect(content));
          } else if (name === firstUnknown && customRecord) {
            const pattern = customRecord.pattern as string;
            try {
              const results = runPattern(content, new RegExp(pattern), 'gi', (m) => ({
                field: name.replace(/_detector$/, ''),
                rawValue: m[0],
                normalizedValue: m[1] ?? m[0],
                confidence: 0.8,
                detectorName: name,
              }));
              detections.push(...results);
            } catch (_e) { /* skip invalid pattern */ }
          }
        }
        return { detections: JSON.stringify(detections) };
      }),
    ) as StorageProgram<Result>;
  },

  propose(input: Record<string, unknown>) {
    const entityId = (input.entityId as string) ?? '';
    const rawDetections = (input.detections as string) ?? '';

    if (!entityId || entityId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entityId is required' }) as StorageProgram<Result>;
    }

    let detections: DetectionResult[];
    try {
      const parsed = JSON.parse(rawDetections);
      if (!Array.isArray(parsed)) throw new Error('not array');
      detections = parsed as DetectionResult[];
    } catch (_e) {
      return complete(createProgram(), 'error', { message: 'detections must be valid JSON array' }) as StorageProgram<Result>;
    }

    if (detections.length === 0) {
      return complete(createProgram(), 'error', { message: 'detections array must not be empty' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();
    const promotionIds: string[] = [];
    let p = createProgram();

    for (let i = 0; i < detections.length; i++) {
      const d = detections[i];
      // Use a stable deterministic id based on entityId + index for testability
      const promotionId = `promo-${entityId}-${i}`;
      promotionIds.push(promotionId);
      p = put(p, 'structure-detector-promotion', promotionId, {
        promotionId,
        entityId,
        field: d.field ?? '',
        rawValue: d.rawValue ?? '',
        normalizedValue: d.normalizedValue ?? '',
        confidence: d.confidence ?? 0,
        detectorName: d.detectorName ?? '',
        status: 'pending',
        createdAt: now,
      });
    }

    return complete(p, 'ok', { promotionIds }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const entityId = (input.entityId as string) ?? '';
    const promotionId = (input.promotionId as string) ?? '';

    let p = createProgram();
    p = get(p, 'structure-detector-promotion', promotionId, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `No promotion found with id '${promotionId}'` }),
      (b) => {
        // Check status at runtime via completeFrom / putFrom
        // Use mapBindings to compute needed outcome fields
        let b2 = putFrom(b, 'structure-detector-promotion', promotionId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'applied', appliedAt: new Date().toISOString() };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { field: record?.field ?? '', value: record?.normalizedValue ?? '' };
        });
      },
    ) as StorageProgram<Result>;
  },

  dismiss(input: Record<string, unknown>) {
    const entityId = (input.entityId as string) ?? '';
    const promotionId = (input.promotionId as string) ?? '';

    let p = createProgram();
    p = get(p, 'structure-detector-promotion', promotionId, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `No promotion found with id '${promotionId}'` }),
      (b) => {
        let b2 = putFrom(b, 'structure-detector-promotion', promotionId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'dismissed', dismissedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  listProposals(input: Record<string, unknown>) {
    const entityId = (input.entityId as string) ?? '';

    if (!entityId || entityId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entityId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'structure-detector-promotion', { entityId, status: 'pending' }, 'records');
    return completeFrom(p, 'ok', (b) => {
      const records = b.records as Record<string, unknown>[];
      return { proposals: records.map(r => r.promotionId as string) };
    }) as StorageProgram<Result>;
  },

  listDetectors(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'structure-detector', {}, 'customRecords');
    return completeFrom(p, 'ok', (b) => {
      const custom = b.customRecords as Record<string, unknown>[];
      const builtinNames = BUILTIN_DETECTORS.map(d => d.name);
      const customNames = custom
        .map(r => r.name as string)
        .filter(n => !BUILTIN_DETECTOR_MAP.has(n));
      return { detectors: [...builtinNames, ...customNames].sort() };
    }) as StorageProgram<Result>;
  },

  registerDetector(input: Record<string, unknown>) {
    const name = (input.name as string) ?? '';
    const pattern = (input.pattern as string) ?? '';
    const fieldType = (input.fieldType as string) ?? '';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!fieldType || fieldType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'fieldType is required' }) as StorageProgram<Result>;
    }
    try {
      new RegExp(pattern);
    } catch (_e) {
      return complete(createProgram(), 'error', { message: `Invalid pattern: ${(_e as Error).message}` }) as StorageProgram<Result>;
    }

    if (BUILTIN_DETECTOR_MAP.has(name)) {
      return complete(createProgram(), 'duplicate', { name }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'structure-detector', name, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        let b2 = put(b, 'structure-detector', name, {
          name,
          pattern,
          fieldType,
          builtin: false,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { id: name });
      },
    ) as StorageProgram<Result>;
  },
};

export const structureDetectorHandler = autoInterpret(_handler);

export default structureDetectorHandler;
