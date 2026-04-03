// @clef-handler style=functional concept=Credential export=credentialHandler
// ============================================================
// Credential Handler
//
// Manage named client-side connection profiles, each binding a kernel
// endpoint to stored authentication credentials. Supports multiple
// profiles for different environments and multiple auth methods.
//
// Section 3.3 — Connected Bind and Surface Pilot
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, del, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _credentialHandler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'Credential' }) as StorageProgram<Result>;
  },

  /**
   * create -- Add a new named profile with endpoint and method.
   * Validates name is non-empty (returns duplicate for empty name, matching spec fixture).
   * Checks uniqueness of name across all existing profiles.
   */
  create(input: Record<string, unknown>) {
    const profile = input.profile as string;
    const name = input.name as string;
    const endpoint = input.endpoint as string;
    const method = input.method as string;

    // Guard: empty name returns duplicate (as per spec fixture create_empty_name -> duplicate)
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'duplicate', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Scan all profiles to check uniqueness of name
    let p = createProgram();
    p = find(p, 'credential_profile', {}, '_allProfiles');
    p = mapBindings(p, (bindings) => {
      const all = (bindings._allProfiles || []) as Array<Record<string, unknown>>;
      return all.find((pr) => (pr.name as string) === name) || null;
    }, '_existing');

    return branch(p,
      (bindings) => bindings._existing != null,
      (b) => complete(b, 'duplicate', { message: 'A profile named "' + name + '" already exists' }),
      (b) => {
        let b2 = put(b, 'credential_profile', profile, {
          profile,
          name,
          endpoint,
          method,
          status: 'unset',
          token: null,
          expiresAt: null,
        });
        return complete(b2, 'ok', { profile });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * store -- Save a token (and optional expiresAt) for an existing profile.
   * Returns notfound if the profile does not exist.
   * Returns notfound if token is empty.
   */
  store(input: Record<string, unknown>) {
    const profile = input.profile as string;
    const token = input.token as string;
    const expiresAt = (input.expiresAt && input.expiresAt !== true) ? input.expiresAt as string : null;

    // Guard: empty token
    if (!token || token.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'token is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'credential_profile', profile, '_record');

    return branch(p,
      (bindings) => bindings._record == null,
      (b) => complete(b, 'notfound', { message: 'No profile exists with identifier "' + profile + '"' }),
      (b) => {
        let b2 = putFrom(b, 'credential_profile', profile, (bindings) => {
          const existing = bindings._record as Record<string, unknown>;
          return {
            ...existing,
            token,
            expiresAt: expiresAt ?? null,
            status: 'valid',
          };
        });
        return complete(b2, 'ok', { profile });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * load -- Retrieve token and endpoint for a profile.
   * Returns notfound if no profile with that id exists.
   * Returns expired if status is "unset" or expiresAt is in the past.
   */
  load(input: Record<string, unknown>) {
    const profile = input.profile as string;

    let p = createProgram();
    p = get(p, 'credential_profile', profile, '_record');

    return branch(p,
      (bindings) => bindings._record == null,
      (b) => complete(b, 'notfound', { message: 'No profile exists with identifier "' + profile + '"' }),
      (b) => {
        // Check status and expiry from bindings
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          const status = record.status as string;
          if (status === 'unset') return 'expired';
          const expiresAt = record.expiresAt as string | null;
          if (expiresAt != null && new Date(expiresAt).getTime() < Date.now()) return 'expired';
          return 'ok';
        }, '_loadOutcome');

        return branch(b2,
          (bindings) => bindings._loadOutcome === 'expired',
          (c) => complete(c, 'expired', { message: 'Token is expired or has not been set' }),
          (c) => completeFrom(c, 'ok', (bindings) => {
            const record = bindings._record as Record<string, unknown>;
            return {
              profile,
              token: record.token as string,
              endpoint: record.endpoint as string,
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  /**
   * refresh -- Simulate a token refresh for a profile that already has a token.
   * Returns notfound if profile does not exist.
   * Returns error if status is "unset" (no token to refresh).
   */
  refresh(input: Record<string, unknown>) {
    const profile = input.profile as string;

    let p = createProgram();
    p = get(p, 'credential_profile', profile, '_record');

    return branch(p,
      (bindings) => bindings._record == null,
      (b) => complete(b, 'notfound', { message: 'No profile exists with identifier "' + profile + '"' }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          return record.status as string;
        }, '_status');

        return branch(b2,
          (bindings) => bindings._status === 'unset',
          (c) => complete(c, 'error', { message: 'No token stored for this profile; cannot refresh' }),
          (c) => {
            // Generate a deterministic new token based on profile id
            const newToken = 'refreshed_' + profile + '_' + Date.now();
            const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

            let c2 = putFrom(c, 'credential_profile', profile, (bindings) => {
              const existing = bindings._record as Record<string, unknown>;
              return {
                ...existing,
                token: newToken,
                expiresAt: newExpiresAt,
                status: 'valid',
              };
            });
            return complete(c2, 'ok', { profile, token: newToken });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  /**
   * remove -- Delete a profile and all its credentials.
   * Returns notfound if the profile does not exist.
   */
  remove(input: Record<string, unknown>) {
    const profile = input.profile as string;

    let p = createProgram();
    p = get(p, 'credential_profile', profile, '_record');

    return branch(p,
      (bindings) => bindings._record == null,
      (b) => complete(b, 'notfound', { message: 'No profile exists with identifier "' + profile + '"' }),
      (b) => {
        let b2 = del(b, 'credential_profile', profile);
        return complete(b2, 'ok', { profile });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * list -- Return all profiles without exposing stored token values.
   */
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'credential_profile', {}, '_allProfiles');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allProfiles || []) as Array<Record<string, unknown>>;
      const profiles = all.map((pr) => ({
        name: pr.name,
        endpoint: pr.endpoint,
        method: pr.method,
        status: pr.status,
      }));
      return { profiles: JSON.stringify(profiles) };
    }) as StorageProgram<Result>;
  },
};

export const credentialHandler = autoInterpret(_credentialHandler);
