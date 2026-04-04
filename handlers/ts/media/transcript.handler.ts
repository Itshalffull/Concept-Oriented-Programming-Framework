// @clef-handler style=functional concept=Transcript
// Transcript Concept Implementation — Functional (StorageProgram) style with
// imperative override for addSegment (dynamic storage key).
//
// Manages time-synchronized text transcripts of audio/video content with
// word-level timestamps and speaker diarization. Each segment is stored under
// the key `<transcriptId>::seg::<index>`. Most actions are pure StorageProgram;
// addSegment uses an imperative override because the segment key is computed at
// runtime from the transcript's current segmentCount.
//
// See repertoire/concepts/media/transcript.concept for the full spec.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, delMany, branch, complete, completeFrom,
  mapBindings, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Storage relation names
const REL_TRANSCRIPT = 'transcript';
const REL_SEGMENT = 'segment';

/** Build the storage key for a segment: `<transcriptId>::seg::<index>` */
function segKey(transcriptId: string, index: number): string {
  return `${transcriptId}::seg::${index}`;
}

// ─── Functional handler ───────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'Transcript' }) as StorageProgram<Result>;
  },

  // ── create ────────────────────────────────────────────────────────────────
  // Validates that sourceEntity is non-empty, checks for a duplicate ID,
  // then stores the transcript header with status "processing" and 0 segments.

  create(input: Record<string, unknown>) {
    const id = input.id as string;
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const language = (input.language as string | null) ?? null;
    const duration = (input.duration as string | null) ?? null;

    if (!sourceEntity || sourceEntity.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'sourceEntity is required',
      }) as StorageProgram<Result>;
    }

    if (!id || id.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'id is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'error', { message: `A transcript with id "${id}" already exists` }),
      (b) => {
        const b2 = put(b, REL_TRANSCRIPT, id, {
          id,
          sourceEntity,
          language,
          speakers: null,
          status: 'processing',
          duration,
          segmentCount: 0,
        });
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  // addSegment is overridden below with an imperative implementation because
  // the segment storage key is computed at runtime from the transcript's
  // current segmentCount — putFrom requires a static key known at build time.
  addSegment(_input: Record<string, unknown>) {
    // This placeholder is replaced by the imperative override on the export.
    return complete(createProgram(), 'notfound', { message: 'unreachable' }) as StorageProgram<Result>;
  },

  // ── seekToWord ────────────────────────────────────────────────────────────
  // Scans all segments' word arrays to find the word at the given flat index
  // across the transcript, then returns its start timestamp.

  seekToWord(input: Record<string, unknown>) {
    const id = input.id as string;
    const wordIndex = parseInt((input.wordIndex as string) ?? '0', 10);

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'txMeta');
    return branch(p,
      (b) => b.txMeta == null,
      (b) => complete(b, 'notfound', { message: `No transcript found with id "${id}"` }),
      (b) => {
        let b2 = find(b, REL_SEGMENT, { transcriptId: id }, 'allSegments');

        b2 = mapBindings(b2, (bindings) => {
          const segments = (bindings.allSegments ?? []) as Array<Record<string, unknown>>;
          segments.sort((a, c) => (a.segmentIndex as number) - (c.segmentIndex as number));

          let globalWordIdx = 0;
          for (const seg of segments) {
            const wordsJson = seg.words as string | null;
            if (!wordsJson) continue;
            let wordsArr: Array<Record<string, unknown>>;
            try {
              wordsArr = JSON.parse(wordsJson) as Array<Record<string, unknown>>;
            } catch {
              continue;
            }
            for (const w of wordsArr) {
              if (globalWordIdx === wordIndex) {
                return { found: true, timestamp: String(w.start ?? '') };
              }
              globalWordIdx++;
            }
          }
          return { found: false, timestamp: '' };
        }, '_seekResult');

        return branch(b2,
          (bindings) => (bindings._seekResult as { found: boolean }).found,
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const r = bindings._seekResult as { found: boolean; timestamp: string };
            return { timestamp: r.timestamp };
          }),
          (bb) => complete(bb, 'notfound', {
            message: `Word index ${wordIndex} is out of range`,
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── getSegmentAt ─────────────────────────────────────────────────────────
  // Finds the segment whose [startTime, endTime] interval contains the given
  // timestamp and returns it along with the active word index.

  getSegmentAt(input: Record<string, unknown>) {
    const id = input.id as string;
    const timestamp = parseFloat((input.timestamp as string) ?? '0');

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'txMeta');
    return branch(p,
      (b) => b.txMeta == null,
      (b) => complete(b, 'notfound', { message: `No transcript found with id "${id}"` }),
      (b) => {
        let b2 = find(b, REL_SEGMENT, { transcriptId: id }, 'allSegments');

        b2 = mapBindings(b2, (bindings) => {
          const segments = (bindings.allSegments ?? []) as Array<Record<string, unknown>>;
          segments.sort((a, c) => (a.segmentIndex as number) - (c.segmentIndex as number));

          for (const seg of segments) {
            const start = parseFloat(seg.startTime as string);
            const end = parseFloat(seg.endTime as string);
            if (timestamp >= start && timestamp <= end) {
              let activeWordIdx = 0;
              const wordsJson = seg.words as string | null;
              if (wordsJson) {
                try {
                  const wordsArr = JSON.parse(wordsJson) as Array<Record<string, unknown>>;
                  for (let i = 0; i < wordsArr.length; i++) {
                    const wEnd = parseFloat(String(wordsArr[i].end ?? '0'));
                    if (timestamp <= wEnd) {
                      activeWordIdx = i;
                      break;
                    }
                    activeWordIdx = i;
                  }
                } catch {
                  // ignore malformed words JSON
                }
              }
              return {
                found: true,
                segmentIndex: String(seg.segmentIndex),
                wordIndex: String(activeWordIdx),
                content: seg.content as string,
                speaker: (seg.speaker as string | null) ?? null,
              };
            }
          }
          return { found: false };
        }, '_segResult');

        return branch(b2,
          (bindings) => (bindings._segResult as { found: boolean }).found,
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const r = bindings._segResult as {
              found: boolean;
              segmentIndex: string;
              wordIndex: string;
              content: string;
              speaker: string | null;
            };
            return {
              segmentIndex: r.segmentIndex,
              wordIndex: r.wordIndex,
              content: r.content,
              speaker: r.speaker,
            };
          }),
          (bb) => complete(bb, 'notfound', {
            message: `No segment covers timestamp ${timestamp}`,
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── setSpeaker ────────────────────────────────────────────────────────────
  // Updates the speaker label for the segment at the given index.

  setSpeaker(input: Record<string, unknown>) {
    const id = input.id as string;
    const segmentIndex = parseInt((input.segmentIndex as string) ?? '0', 10);
    const speaker = (input.speaker as string) ?? '';

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'txMeta');
    return branch(p,
      (b) => b.txMeta == null,
      (b) => complete(b, 'notfound', { message: `No transcript found with id "${id}"` }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.txMeta as Record<string, unknown>;
          return (rec.segmentCount as number) ?? 0;
        }, '_count');

        return branch(b2,
          (bindings) => segmentIndex >= (bindings._count as number),
          (bb) => complete(bb, 'notfound', {
            message: `Segment index ${segmentIndex} is out of range`,
          }),
          (bb) => {
            const key = segKey(id, segmentIndex);
            const bb2 = mergeFrom(bb, REL_SEGMENT, key, () => ({ speaker }));
            return complete(bb2, 'ok', { id });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── get ───────────────────────────────────────────────────────────────────
  // Returns transcript metadata including segment count.

  get(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No transcript found with id "${id}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          id: rec.id as string,
          sourceEntity: rec.sourceEntity as string,
          language: (rec.language as string | null) ?? null,
          speakers: (rec.speakers as string | null) ?? null,
          status: rec.status as string,
          duration: (rec.duration as string | null) ?? null,
          segmentCount: String((rec.segmentCount as number) ?? 0),
        };
      }),
    ) as StorageProgram<Result>;
  },

  // ── list ──────────────────────────────────────────────────────────────────
  // Returns all transcripts, optionally filtered by sourceEntity.

  list(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string | null) ?? null;

    let p = createProgram();
    const criteria = sourceEntity ? { sourceEntity } : {};
    p = find(p, REL_TRANSCRIPT, criteria, 'allTranscripts');
    return completeFrom(p, 'ok', (bindings) => {
      const transcripts = (bindings.allTranscripts ?? []) as Array<Record<string, unknown>>;
      return { transcripts: JSON.stringify(transcripts) };
    }) as StorageProgram<Result>;
  },

  // ── delete ────────────────────────────────────────────────────────────────
  // Removes the transcript and all its segments. The source MediaAsset is
  // not affected.

  delete(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, REL_TRANSCRIPT, id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No transcript found with id "${id}"` }),
      (b) => {
        // Delete all segments belonging to this transcript
        let b2 = delMany(b, REL_SEGMENT, { transcriptId: id }, '_deletedSegments');
        b2 = del(b2, REL_TRANSCRIPT, id);
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

};

// ─── Imperative override for addSegment ──────────────────────────────────────
// addSegment uses an imperative override because the segment storage key
// (`<transcriptId>::seg::<segmentCount>`) is computed at runtime from the
// current transcript record — putFrom requires a static key at build time.

const _base = autoInterpret(_handler);

export const transcriptHandler = {
  ..._base,

  async addSegment(input: Record<string, unknown>, storage: {
    get(relation: string, key: string): Promise<Record<string, unknown> | null>;
    put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  }) {
    const id = input.id as string;
    const startTime = (input.startTime as string) ?? '';
    const endTime = (input.endTime as string) ?? '';
    const content = (input.content as string) ?? '';
    const speaker = (input.speaker as string | null) ?? null;
    const words = (input.words as string | null) ?? null;

    const existing = await storage.get(REL_TRANSCRIPT, id);
    if (!existing) {
      return { variant: 'notfound', message: `No transcript found with id "${id}"` };
    }

    const segmentCount = (existing.segmentCount as number) ?? 0;
    const key = segKey(id, segmentCount);

    await storage.put(REL_SEGMENT, key, {
      transcriptId: id,
      segmentIndex: segmentCount,
      startTime,
      endTime,
      content,
      speaker,
      words,
    });

    // Read-modify-write to increment segmentCount (no merge on storage adapter)
    await storage.put(REL_TRANSCRIPT, id, {
      ...existing,
      segmentCount: segmentCount + 1,
    });

    return { variant: 'ok', id };
  },
};
