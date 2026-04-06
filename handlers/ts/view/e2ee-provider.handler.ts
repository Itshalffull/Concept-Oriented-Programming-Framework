// @clef-handler style=functional concept=E2EEProvider
// E2EEProvider Concept Implementation — Functional (StorageProgram) style
//
// Client-side decryption bridge for encrypted-local data sources. Transforms
// ciphertext rows fetched from the kernel into plaintext before the residual
// query pipeline runs locally.
//
// The decrypt action is the pipeline step invoked by ExecuteSplitQueryE2EEDecrypt
// (execute-split-query.sync) between the two QueryExecution/execute legs for
// encrypted-local views.
//
// Security invariant: key material and filter predicates never leave the client.
// See view-query-three-tier-execution.md Section 6 and MAG-524.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Handler implementation ──────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'E2EEProvider' });
  },

  // ─── decrypt ──────────────────────────────────────────────────────────────

  /**
   * Decrypt a JSON array of ciphertext row objects using the key identified
   * by keyRef. Returns a JSON array of plaintext row objects.
   *
   * This action is invoked by ExecuteSplitQueryE2EEDecrypt in the sync chain.
   * In this reference implementation, decryption uses a base64 decode as a
   * placeholder — a real implementation would use the Web Crypto API or a
   * similar client-side encryption library.
   *
   * The decrypt operation runs entirely client-side. No data or key material
   * is sent to the backend.
   */
  decrypt(input: Record<string, unknown>) {
    const rawRows = input.rows;
    const keyRef = input.keyRef as string;

    // Validate keyRef before any storage operations
    if (!keyRef || (typeof keyRef === 'string' && keyRef.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'keyRef is required' });
    }

    // Accept rows as either a JSON string or a pre-parsed array
    // (conformance tests pass the fixture array literal directly)
    let ciphertextRows: Array<Record<string, unknown>>;
    if (Array.isArray(rawRows)) {
      ciphertextRows = rawRows as Array<Record<string, unknown>>;
    } else if (typeof rawRows === 'string') {
      if (!rawRows || rawRows.trim() === '') {
        return complete(createProgram(), 'error', { message: 'rows is required' });
      }
      try {
        const parsed = JSON.parse(rawRows);
        if (!Array.isArray(parsed)) {
          return complete(createProgram(), 'error', { message: 'rows must be a JSON array' });
        }
        ciphertextRows = parsed as Array<Record<string, unknown>>;
      } catch {
        return complete(createProgram(), 'error', { message: 'rows is not valid JSON' });
      }
    } else if (rawRows == null) {
      return complete(createProgram(), 'error', { message: 'rows is required' });
    } else {
      return complete(createProgram(), 'error', { message: 'rows must be a JSON string or array' });
    }

    // Look up the registered key to check existence
    let p = createProgram();
    p = get(p, 'key', keyRef, '_keyRecord');

    return branch(p,
      (b) => b._keyRecord == null,
      complete(createProgram(), 'notfound', {
        message: `No key registered with keyRef: ${keyRef}`,
      }),
      (() => {
        // Perform client-side decryption.
        // Reference implementation: each row is expected to have a `ciphertext`
        // field containing a base64-encoded JSON string of the plaintext row.
        // A real implementation would use the Web Crypto API with the keyMaterial
        // stored under this keyRef.
        const plaintextRows: Array<Record<string, unknown>> = ciphertextRows.map(row => {
          const ciphertext = row.ciphertext as string | undefined;
          if (!ciphertext) return row; // no ciphertext field — pass through as-is
          try {
            // Placeholder: base64 decode → JSON parse
            const decoded = Buffer.from(ciphertext, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            return typeof parsed === 'object' && parsed !== null
              ? (parsed as Record<string, unknown>)
              : row;
          } catch {
            // Malformed ciphertext — pass through as-is rather than dropping the row
            return row;
          }
        });
        return complete(createProgram(), 'ok', {
          rows: JSON.stringify(plaintextRows),
        });
      })(),
    );
  },

  // ─── loadKey ──────────────────────────────────────────────────────────────

  /**
   * Register key material for the given keyRef so decrypt calls can use it.
   * The keyRef comes from the DataSourceSpec configuration for the
   * encrypted-local data source.
   */
  loadKey(input: Record<string, unknown>) {
    const keyRef = input.keyRef as string;
    const keyMaterial = input.keyMaterial as string;

    if (!keyRef || keyRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'keyRef is required' });
    }
    if (!keyMaterial || keyMaterial.trim() === '') {
      return complete(createProgram(), 'error', { message: 'keyMaterial is required' });
    }

    let p = createProgram();
    p = get(p, 'key', keyRef, '_existing');

    return branch(p,
      (b) => b._existing != null,
      (() => {
        let p2 = createProgram();
        p2 = get(p2, 'key', keyRef, '_dup');
        return completeFrom(p2, 'duplicate', (b) => ({
          key: (b._dup as Record<string, unknown>)?.id ?? keyRef,
        }));
      })(),
      (() => {
        let p3 = createProgram();
        p3 = put(p3, 'key', keyRef, {
          id: keyRef,
          keyRef,
          keyMaterial,
          loadedAt: new Date().toISOString(),
        });
        return complete(p3, 'ok', { key: keyRef });
      })(),
    );
  },

  // ─── unloadKey ──────────────────────────────────────────────────────────

  /**
   * Remove key material for the given keyRef from in-memory storage.
   * Used to clear sensitive key material after it is no longer needed.
   */
  unloadKey(input: Record<string, unknown>) {
    const keyRef = input.keyRef as string;

    if (!keyRef || keyRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'keyRef is required' });
    }

    let p = createProgram();
    p = get(p, 'key', keyRef, '_existing');

    return branch(p,
      (b) => b._existing == null,
      complete(createProgram(), 'notfound', {
        message: `No key registered with keyRef: ${keyRef}`,
      }),
      (() => {
        let p2 = createProgram();
        p2 = del(p2, 'key', keyRef);
        return complete(p2, 'ok', {});
      })(),
    );
  },

};

export const e2eeProviderHandler = autoInterpret(_handler);
export default e2eeProviderHandler;
