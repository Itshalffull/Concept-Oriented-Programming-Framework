// @clef-handler style=functional
// ============================================================
// RouteParam Handler
//
// Declare typed URL parameters that supply contextual data to page content.
// Each route parameter specifies its source (path segment, query string, or
// hash fragment), data type, default value, and validation constraints.
// When a page URL is resolved, route parameters are extracted and made
// available as contextual filters that views and controls can bind to.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_SOURCES = new Set(['path', 'query', 'hash']);
const VALID_DATA_TYPES = new Set(['string', 'number', 'boolean', 'enum']);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'RouteParam' });
  },

  define(input: Record<string, unknown>): StorageProgram<Result> {
    const param = input.param as string;
    const name = input.name as string;
    const pageRef = input.pageRef as string;
    const source = input.source as string;
    const dataType = input.dataType as string;
    const required = input.required as boolean;
    const defaultValue = (input.defaultValue as string) || null;

    // Validate name
    if (!name || (name as string).trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate source
    if (!VALID_SOURCES.has(source)) {
      return complete(createProgram(), 'invalid', {
        message: 'source must be one of: path, query, hash',
      }) as StorageProgram<Result>;
    }

    // Validate dataType
    if (!VALID_DATA_TYPES.has(dataType)) {
      return complete(createProgram(), 'invalid', {
        message: 'dataType must be one of: string, number, boolean, enum',
      }) as StorageProgram<Result>;
    }

    // Uniqueness check: composite key of pageRef::name
    const uniquenessKey = `${pageRef}::${name}`;
    let p = createProgram();
    p = get(p, 'routeParamIndex', uniquenessKey, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (dupP) => complete(dupP, 'duplicate', {
        message: `A parameter named "${name}" already exists for page "${pageRef}"`,
      }),
      (okP) => {
        let p2 = put(okP, 'routeParam', param, {
          param,
          name,
          pageRef,
          source,
          dataType,
          required,
          defaultValue,
          enumValues: null,
          pattern: null,
          description: null,
        });
        p2 = put(p2, 'routeParamIndex', uniquenessKey, { param });
        return complete(p2, 'ok', { param });
      },
    ) as StorageProgram<Result>;
  },

  setEnumValues(input: Record<string, unknown>): StorageProgram<Result> {
    const param = input.param as string;
    const enumValues = input.enumValues as string[];

    if (!enumValues || !Array.isArray(enumValues) || enumValues.length === 0) {
      return complete(createProgram(), 'invalid', {
        message: 'enumValues must be a non-empty list',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'routeParam', param, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No parameter exists with identifier "${param}"`,
      }),
      (foundP) => {
        return branch(foundP,
          (b) => {
            const rec = b.existing as Record<string, unknown>;
            return rec.dataType !== 'enum';
          },
          (invalidP) => complete(invalidP, 'invalid', {
            message: 'setEnumValues is only valid for parameters with dataType "enum"',
          }),
          (okP) => {
            const p2 = putFrom(okP, 'routeParam', param, (b) => {
              const rec = b.existing as Record<string, unknown>;
              return { ...rec, enumValues };
            });
            return complete(p2, 'ok', { param });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  setPattern(input: Record<string, unknown>): StorageProgram<Result> {
    const param = input.param as string;
    const pattern = input.pattern as string;

    let p = createProgram();
    p = get(p, 'routeParam', param, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No parameter exists with identifier "${param}"`,
      }),
      (okP) => {
        const p2 = putFrom(okP, 'routeParam', param, (b) => {
          const rec = b.existing as Record<string, unknown>;
          return { ...rec, pattern };
        });
        return complete(p2, 'ok', { param });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>): StorageProgram<Result> {
    const param = input.param as string;

    let p = createProgram();
    p = get(p, 'routeParam', param, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No parameter exists with identifier "${param}"`,
      }),
      (okP) => completeFrom(okP, 'ok', (b) => {
        const rec = b.existing as Record<string, unknown>;
        return {
          param: rec.param,
          name: rec.name,
          pageRef: rec.pageRef,
          source: rec.source,
          dataType: rec.dataType,
          required: rec.required,
          defaultValue: rec.defaultValue,
          enumValues: rec.enumValues,
          pattern: rec.pattern,
          description: rec.description,
        };
      }),
    ) as StorageProgram<Result>;
  },

  listForPage(input: Record<string, unknown>): StorageProgram<Result> {
    const pageRef = input.pageRef as string;

    let p = createProgram();
    p = find(p, 'routeParam', {}, 'allParams');
    p = mapBindings(p, (b) => {
      const all = b.allParams as Array<Record<string, unknown>>;
      return all
        .filter((r) => r.pageRef === pageRef)
        .map((r) => ({
          param: r.param,
          name: r.name,
          source: r.source,
          dataType: r.dataType,
          required: r.required,
          defaultValue: r.defaultValue,
        }));
    }, 'filtered');

    return completeFrom(p, 'ok', (b) => ({
      params: b.filtered as unknown[],
    })) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>): StorageProgram<Result> {
    const pageRef = input.pageRef as string;
    const url = input.url as string;

    let p = createProgram();
    p = find(p, 'routeParam', {}, 'allParams');
    p = mapBindings(p, (b) => {
      const all = b.allParams as Array<Record<string, unknown>>;
      const pageParams = all.filter((r) => r.pageRef === pageRef);

      // Parse URL into path, query, and hash parts
      let path = url;
      let queryString = '';
      let hashString = '';

      const hashIdx = path.indexOf('#');
      if (hashIdx !== -1) {
        hashString = path.slice(hashIdx + 1);
        path = path.slice(0, hashIdx);
      }
      const queryIdx = path.indexOf('?');
      if (queryIdx !== -1) {
        queryString = path.slice(queryIdx + 1);
        path = path.slice(0, queryIdx);
      }

      // Parse query string into key-value pairs
      const queryParams: Record<string, string> = {};
      if (queryString) {
        for (const part of queryString.split('&')) {
          const eq = part.indexOf('=');
          if (eq !== -1) {
            queryParams[decodeURIComponent(part.slice(0, eq))] =
              decodeURIComponent(part.slice(eq + 1));
          } else if (part) {
            queryParams[decodeURIComponent(part)] = '';
          }
        }
      }

      // Path segments (non-empty)
      const pathSegments = path.split('/').filter((s) => s !== '');

      const values: Array<{ name: string; value: string; source: string }> = [];
      const errors: string[] = [];

      for (const rp of pageParams) {
        const rpName = rp.name as string;
        const rpSource = rp.source as string;
        const rpRequired = rp.required as boolean;
        const rpDefault = rp.defaultValue as string | null;
        const rpDataType = rp.dataType as string;
        const rpEnumValues = rp.enumValues as string[] | null;
        const rpPattern = rp.pattern as string | null;

        let rawValue: string | null = null;

        if (rpSource === 'query') {
          rawValue = Object.prototype.hasOwnProperty.call(queryParams, rpName)
            ? queryParams[rpName]
            : null;
        } else if (rpSource === 'hash') {
          rawValue = hashString || null;
        } else if (rpSource === 'path') {
          // Use the last non-empty path segment as the path param value
          rawValue = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null;
        }

        // Fall back to default if no raw value
        if ((rawValue === null || rawValue === '') && rpDefault !== null && rpDefault !== '') {
          rawValue = rpDefault;
        }

        // Check required — missing required param with no default is a validation error
        if (rpRequired && (rawValue === null || rawValue === '')) {
          errors.push(`Required parameter "${rpName}" has no value and no default`);
          continue;
        }

        if (rawValue === null || rawValue === '') {
          // Not required, no value — skip
          continue;
        }

        // Type validation
        if (rpDataType === 'number') {
          if (isNaN(Number(rawValue))) {
            errors.push(`Parameter "${rpName}" value "${rawValue}" is not a valid number`);
            continue;
          }
        } else if (rpDataType === 'boolean') {
          if (rawValue !== 'true' && rawValue !== 'false') {
            errors.push(`Parameter "${rpName}" value "${rawValue}" is not a valid boolean`);
            continue;
          }
        } else if (rpDataType === 'enum' && rpEnumValues && rpEnumValues.length > 0) {
          if (!rpEnumValues.includes(rawValue)) {
            errors.push(
              `Parameter "${rpName}" value "${rawValue}" is not in allowed values: ${rpEnumValues.join(', ')}`,
            );
            continue;
          }
        }

        // Pattern validation
        if (rpPattern) {
          try {
            const re = new RegExp(rpPattern);
            if (!re.test(rawValue)) {
              errors.push(
                `Parameter "${rpName}" value "${rawValue}" does not match pattern "${rpPattern}"`,
              );
              continue;
            }
          } catch {
            // Invalid regex pattern — skip pattern check
          }
        }

        values.push({ name: rpName, value: rawValue, source: rpSource });
      }

      return { values, errors };
    }, 'resolved');

    return branch(p,
      (b) => {
        const resolved = b.resolved as { errors: string[] };
        return resolved.errors.length > 0;
      },
      (invalidP) => completeFrom(invalidP, 'invalid', (b) => {
        const resolved = b.resolved as { errors: string[] };
        return { message: resolved.errors.join('; ') };
      }),
      (okP) => completeFrom(okP, 'ok', (b) => {
        const resolved = b.resolved as { values: unknown[] };
        return { values: resolved.values };
      }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>): StorageProgram<Result> {
    const param = input.param as string;

    let p = createProgram();
    p = get(p, 'routeParam', param, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', {
        message: `No parameter exists with identifier "${param}"`,
      }),
      (okP) => {
        // Delete main record; the uniqueness index entry becomes a stale tombstone
        // (acceptable since re-define will overwrite it)
        const p2 = del(okP, 'routeParam', param);
        return complete(p2, 'ok', { param });
      },
    ) as StorageProgram<Result>;
  },
};

export const routeParamHandler = autoInterpret(_handler);
