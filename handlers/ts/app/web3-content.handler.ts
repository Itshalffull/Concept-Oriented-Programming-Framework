// @migrated dsl-constructs 2026-03-18
// Web3 Content Concept Implementation
import { createHash } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

function generateCid(data: Buffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
  return 'Qm' + createHash('sha256').update(bytes).digest('hex').slice(0, 44);
}

const _web3ContentHandler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>) {
    const data = input.data as string | Uint8Array; const name = input.name as string; const contentType = input.contentType as string;
    if (!data || !name || !contentType) { let p = createProgram(); return complete(p, 'error', { message: 'Missing required fields: data, name, contentType' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
    const cid = generateCid(bytes); const size = bytes.length;
    let p = createProgram();
    p = put(p, 'item', cid, { cid, name, contentType, size, pinned: false, createdAt: new Date().toISOString() });
    p = put(p, 'blob', cid, { cid, data: bytes.toString('base64'), encoding: 'base64' });
    return complete(p, 'ok', { cid, size }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  pin(input: Record<string, unknown>) {
    const cid = input.cid as string;
    let p = createProgram(); p = spGet(p, 'item', cid, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'item', cid, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), pinned: true, pinnedAt: new Date().toISOString() })); return complete(b2, 'ok', { cid }); },
      (b) => complete(b, 'error', { cid, message: 'Content not found for CID' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  unpin(input: Record<string, unknown>) {
    const cid = input.cid as string;
    let p = createProgram(); p = spGet(p, 'item', cid, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'item', cid, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), pinned: false, unpinnedAt: new Date().toISOString() })); return complete(b2, 'ok', { cid }); },
      (b) => complete(b, 'error', { cid, message: 'Content not found for CID' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  resolve(input: Record<string, unknown>) {
    const cid = input.cid as string;
    let p = createProgram(); p = spGet(p, 'item', cid, 'meta');
    p = branch(p, 'meta',
      (b) => { let b2 = spGet(b, 'blob', cid, 'blob'); b2 = branch(b2, 'blob',
        (b3) => complete(b3, 'ok', { data: '', contentType: '', size: 0 }),
        (b3) => complete(b3, 'unavailable', { cid, message: 'Content metadata exists but blob data is unreachable' }));
        return b2; },
      (b) => complete(b, 'notFound', { cid }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const web3ContentHandler = autoInterpret(_web3ContentHandler);

