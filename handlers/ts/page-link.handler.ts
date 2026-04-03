// @clef-handler style=functional
// ============================================================
// PageLink Handler
//
// Maps source control variables to target page route parameters,
// enabling navigation with data transfer between pages. Manages
// link definitions, param mappings, navigation behavior, URL
// construction, and link lifecycle.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_METHODS = new Set(['push', 'replace', 'external']);

const _handler: FunctionalConceptHandler = {

  // ── create ──────────────────────────────────────────────────
  create(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;
    const name = (input.name as string) ?? '';
    const sourcePageRef = input.sourcePageRef as string;
    const targetPageRef = input.targetPageRef as string;
    const method = input.method as string;

    // Validate inputs before any storage operations
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!VALID_METHODS.has(method)) {
      return complete(createProgram(), 'invalid', {
        message: 'method must be one of: push, replace, external',
      }) as StorageProgram<Result>;
    }

    // Check uniqueness: (name, sourcePageRef) pair must be unique
    let p = createProgram();
    p = find(p, 'pageLink', {}, 'allLinks');

    p = mapBindings(p, (b) => {
      const all = b.allLinks as Array<Record<string, unknown>>;
      return all.find((l) => l.name === name && l.sourcePageRef === sourcePageRef) ?? null;
    }, 'existingDuplicate');

    return branch(p,
      (b) => b.existingDuplicate != null,
      (dupP) => complete(dupP, 'duplicate', {
        message: `A link named "${name}" already exists for source page "${sourcePageRef}"`,
      }),
      (okP) => {
        let p2 = putFrom(okP, 'pageLink', linkId, (_b) => ({
          link: linkId,
          name,
          sourcePageRef,
          targetPageRef,
          method,
          paramMappings: [] as Array<Record<string, unknown>>,
          openInNewTab: false,
          prefetch: false,
        }));
        return complete(p2, 'ok', { link: linkId });
      },
    ) as StorageProgram<Result>;
  },

  // ── addMapping ──────────────────────────────────────────────
  addMapping(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;
    const sourceVar = (input.sourceVar as string) ?? '';
    const targetParam = (input.targetParam as string) ?? '';
    const transform = (input.transform as string | null | undefined) ?? null;

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (foundP) => {
        // Check for duplicate targetParam within this link
        let p2 = mapBindings(foundP, (b) => {
          const link = b.existingLink as Record<string, unknown>;
          const mappings = (link.paramMappings ?? []) as Array<Record<string, unknown>>;
          return mappings.find((m) => m.targetParam === targetParam) ?? null;
        }, 'dupMapping');

        return branch(p2,
          (b) => b.dupMapping != null,
          (dupP) => complete(dupP, 'duplicate', {
            message: `A mapping for targetParam "${targetParam}" already exists on this link`,
          }),
          (okP) => {
            let p3 = putFrom(okP, 'pageLink', linkId, (b) => {
              const link = b.existingLink as Record<string, unknown>;
              const mappings = [
                ...((link.paramMappings ?? []) as Array<Record<string, unknown>>),
              ];
              mappings.push({
                sourceVar,
                targetParam,
                transform: transform && transform !== '' ? transform : null,
              });
              return { ...link, paramMappings: mappings };
            });
            return complete(p3, 'ok', { link: linkId });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── removeMapping ────────────────────────────────────────────
  removeMapping(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;
    const targetParam = input.targetParam as string;

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (foundP) => {
        // Check that a mapping exists for this targetParam
        let p2 = mapBindings(foundP, (b) => {
          const link = b.existingLink as Record<string, unknown>;
          const mappings = (link.paramMappings ?? []) as Array<Record<string, unknown>>;
          return mappings.findIndex((m) => m.targetParam === targetParam);
        }, 'mappingIdx');

        return branch(p2,
          (b) => (b.mappingIdx as number) < 0,
          (missingP) => complete(missingP, 'notfound', {
            message: `No mapping exists for targetParam "${targetParam}" on link "${linkId}"`,
          }),
          (okP) => {
            let p3 = putFrom(okP, 'pageLink', linkId, (b) => {
              const link = b.existingLink as Record<string, unknown>;
              const mappings = (link.paramMappings ?? []) as Array<Record<string, unknown>>;
              return { ...link, paramMappings: mappings.filter((m) => m.targetParam !== targetParam) };
            });
            return complete(p3, 'ok', { link: linkId });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── setBehavior ──────────────────────────────────────────────
  setBehavior(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;
    const openInNewTab = input.openInNewTab as boolean;
    const prefetch = input.prefetch as boolean;

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (okP) => {
        let p2 = putFrom(okP, 'pageLink', linkId, (b) => {
          const link = b.existingLink as Record<string, unknown>;
          return { ...link, openInNewTab, prefetch };
        });
        return complete(p2, 'ok', { link: linkId });
      },
    ) as StorageProgram<Result>;
  },

  // ── get ──────────────────────────────────────────────────────
  get(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (okP) => completeFrom(okP, 'ok', (b) => {
        const link = b.existingLink as Record<string, unknown>;
        return {
          link: link.link,
          name: link.name,
          sourcePageRef: link.sourcePageRef,
          targetPageRef: link.targetPageRef,
          method: link.method,
          paramMappings: link.paramMappings ?? [],
          openInNewTab: link.openInNewTab ?? false,
          prefetch: link.prefetch ?? false,
        };
      }),
    ) as StorageProgram<Result>;
  },

  // ── listForPage ──────────────────────────────────────────────
  listForPage(input: Record<string, unknown>): StorageProgram<Result> {
    const sourcePageRef = input.sourcePageRef as string;

    let p = createProgram();
    p = find(p, 'pageLink', {}, 'allLinks');

    return completeFrom(p, 'ok', (b) => {
      const all = b.allLinks as Array<Record<string, unknown>>;
      const links = all
        .filter((l) => l.sourcePageRef === sourcePageRef)
        .map((l) => ({
          link: l.link,
          name: l.name,
          targetPageRef: l.targetPageRef,
          method: l.method,
          mappingCount: ((l.paramMappings ?? []) as Array<unknown>).length,
        }));
      return { links };
    }) as StorageProgram<Result>;
  },

  // ── buildUrl ─────────────────────────────────────────────────
  buildUrl(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;
    const variablesStr = input.variables as string;

    // Safely parse variables JSON before any storage operations
    let variables: Record<string, string>;
    try {
      variables = JSON.parse(variablesStr);
    } catch {
      return complete(createProgram(), 'invalid', {
        message: 'variables must be a valid JSON object',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (foundP) => {
        // Apply mappings and transforms to construct the URL
        let p2 = mapBindings(foundP, (b) => {
          const link = b.existingLink as Record<string, unknown>;
          const mappings = (link.paramMappings ?? []) as Array<Record<string, unknown>>;
          const targetPageRef = link.targetPageRef as string;

          const params: Record<string, string> = {};
          for (const mapping of mappings) {
            const sourceVar = mapping.sourceVar as string;
            const targetParam = mapping.targetParam as string;
            const transform = mapping.transform as string | null;

            let value = variables[sourceVar];
            if (value === undefined || value === null) {
              return {
                error: `Required variable "${sourceVar}" for parameter "${targetParam}" is missing`,
              };
            }

            // Apply transform
            if (transform && transform !== '') {
              if (transform === 'toString') {
                value = String(value);
              } else if (transform === 'parseInt') {
                const n = parseInt(value, 10);
                if (isNaN(n)) {
                  return {
                    error: `Transform "parseInt" failed for variable "${sourceVar}": not a valid integer`,
                  };
                }
                value = String(n);
              } else if (transform === 'encodeURIComponent') {
                value = encodeURIComponent(value);
              }
              // Unknown transforms pass through unchanged
            }

            params[targetParam] = value;
          }

          // Substitute path params (:param) into the URL pattern
          let url = targetPageRef;
          const usedInPath = new Set<string>();
          for (const [param, val] of Object.entries(params)) {
            if (url.includes(`:${param}`)) {
              url = url.replace(`:${param}`, encodeURIComponent(val));
              usedInPath.add(param);
            }
          }

          // Append remaining params as query string
          const queryParts: string[] = [];
          for (const [param, val] of Object.entries(params)) {
            if (!usedInPath.has(param)) {
              queryParts.push(`${encodeURIComponent(param)}=${encodeURIComponent(val)}`);
            }
          }
          if (queryParts.length > 0) {
            url += (url.includes('?') ? '&' : '?') + queryParts.join('&');
          }

          return { url };
        }, 'urlResult');

        return branch(p2,
          (b) => {
            const result = b.urlResult as Record<string, unknown>;
            return 'error' in result;
          },
          (errP) => completeFrom(errP, 'invalid', (b) => {
            const result = b.urlResult as Record<string, unknown>;
            return { message: result.error as string };
          }),
          (okP) => completeFrom(okP, 'ok', (b) => {
            const result = b.urlResult as Record<string, unknown>;
            return { url: result.url as string };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  // ── delete ───────────────────────────────────────────────────
  delete(input: Record<string, unknown>): StorageProgram<Result> {
    const linkId = input.link as string;

    let p = createProgram();
    p = get(p, 'pageLink', linkId, 'existingLink');

    return branch(p,
      (b) => b.existingLink == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No link exists with id "${linkId}"`,
      }),
      (okP) => {
        let p2 = del(okP, 'pageLink', linkId);
        return complete(p2, 'ok', { link: linkId });
      },
    ) as StorageProgram<Result>;
  },

  // ── register ─────────────────────────────────────────────────
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'PageLink' }) as StorageProgram<Result>;
  },
};

export const pageLinkHandler = autoInterpret(_handler);
