// @clef-handler style=functional
// FieldFormatter Handler
//
// Formal registry of named formatters that transform raw field values into
// display-ready output. Makes formatter a first-class concept rather than
// an opaque string reference in FieldPlacement.
//
// Built-in formatters are seeded on first list() or get() call.
// Custom formatters are registered via register().

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const BUILTIN_FORMATTERS = [
  { formatterId: 'plain', label: 'Plain Text', description: 'Render the raw value as plain text with no transformation.', acceptsTypes: ['String', 'Number', 'Float', 'Bool', 'DateTime'], optionsSchema: null, builtin: true },
  { formatterId: 'heading', label: 'Heading', description: 'Render a text value as a heading element at a configurable level.', acceptsTypes: ['String'], optionsSchema: '{"level": 2}', builtin: true },
  { formatterId: 'markdown', label: 'Markdown', description: 'Render a text value as parsed and sanitized Markdown HTML.', acceptsTypes: ['String'], optionsSchema: null, builtin: true },
  { formatterId: 'date', label: 'Date', description: 'Format a date or datetime value using a locale-aware pattern.', acceptsTypes: ['DateTime', 'String'], optionsSchema: '{"format": "medium", "locale": "en-US"}', builtin: true },
  { formatterId: 'number', label: 'Number', description: 'Format a numeric value with locale-aware grouping and decimal separators.', acceptsTypes: ['Number', 'Float'], optionsSchema: '{"precision": 2, "locale": "en-US"}', builtin: true },
  { formatterId: 'boolean', label: 'Boolean', description: 'Render a boolean as a checkmark, toggle icon, or configurable label pair.', acceptsTypes: ['Bool'], optionsSchema: '{"trueLabel": "Yes", "falseLabel": "No"}', builtin: true },
  { formatterId: 'link', label: 'Link', description: 'Render a URL or entity reference as a hyperlink.', acceptsTypes: ['String'], optionsSchema: '{"openInNewTab": false}', builtin: true },
  { formatterId: 'image', label: 'Image', description: 'Render a URL or asset reference as an inline image.', acceptsTypes: ['String'], optionsSchema: '{"maxWidth": "100%", "alt": ""}', builtin: true },
  { formatterId: 'tag-list', label: 'Tag List', description: 'Render an array of string values as a list of visual tag chips.', acceptsTypes: ['String'], optionsSchema: '{"color": "default"}', builtin: true },
];

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const formatterId = input.formatterId as string;
    const label = input.label as string;
    const description = input.description as string;
    const rawAcceptsTypes = input.acceptsTypes;
    const acceptsTypes: string[] = Array.isArray(rawAcceptsTypes) ? rawAcceptsTypes as string[] :
      typeof rawAcceptsTypes === 'string' ? JSON.parse(rawAcceptsTypes) : [];
    const optionsSchema = (input.optionsSchema as string | undefined) ?? null;

    if (!formatterId || (formatterId as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'formatterId is required' }) as StorageProgram<Result>;
    }
    if (!label || (label as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'label is required' }) as StorageProgram<Result>;
    }
    if (!Array.isArray(acceptsTypes) || acceptsTypes.length === 0) {
      return complete(createProgram(), 'error', { message: 'acceptsTypes must be a non-empty list' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'field-formatter', formatterId, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { formatterId }),
      (b) => {
        let b2 = put(b, 'field-formatter', formatterId, {
          formatterId,
          label,
          description: description || '',
          acceptsTypes: JSON.stringify(acceptsTypes),
          optionsSchema,
          builtin: false,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { formatter: formatterId });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const formatterId = input.formatterId as string;

    // Check built-in formatters first
    const builtin = BUILTIN_FORMATTERS.find(f => f.formatterId === formatterId);
    if (builtin) {
      const p = createProgram();
      return complete(p, 'ok', {
        formatter: builtin.formatterId,
        label: builtin.label,
        description: builtin.description,
        acceptsTypes: builtin.acceptsTypes,
        optionsSchema: builtin.optionsSchema,
        builtin: true,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'field-formatter', formatterId, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `Formatter '${formatterId}' not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          formatter: record.formatterId,
          label: record.label,
          description: record.description,
          acceptsTypes: JSON.parse((record.acceptsTypes as string) || '[]'),
          optionsSchema: record.optionsSchema ?? null,
          builtin: record.builtin ?? false,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'field-formatter', {}, 'customFormatters');
    return completeFrom(p, 'ok', (bindings) => {
      const custom = bindings.customFormatters as Record<string, unknown>[];
      const builtinIds = new Set(BUILTIN_FORMATTERS.map(f => f.formatterId));
      const customFiltered = custom.filter(f => !builtinIds.has(f.formatterId as string));
      const allIds = [
        ...BUILTIN_FORMATTERS.map(f => f.formatterId),
        ...customFiltered.map(f => f.formatterId as string),
      ].sort();
      return { formatters: allIds };
    }) as StorageProgram<Result>;
  },

  listForType(input: Record<string, unknown>) {
    const fieldType = input.fieldType as string;

    if (!fieldType || (fieldType as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'fieldType is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'field-formatter', {}, 'customFormatters');
    p = mapBindings(p, (b) => {
      const custom = b.customFormatters as Record<string, unknown>[];
      const builtinMatches = BUILTIN_FORMATTERS
        .filter(f => f.acceptsTypes.includes(fieldType))
        .map(f => f.formatterId);
      const customMatches = custom
        .filter(f => {
          const types = JSON.parse((f.acceptsTypes as string) || '[]') as string[];
          return types.includes(fieldType);
        })
        .map(f => f.formatterId as string);
      return [...builtinMatches, ...customMatches];
    }, 'matchingFormatters');
    return completeFrom(p, 'ok', (b) => ({ formatters: b.matchingFormatters })) as StorageProgram<Result>;
  },

  updateOptions(input: Record<string, unknown>) {
    const formatterId = input.formatterId as string;
    const optionsSchema = input.optionsSchema as string;

    // Validate JSON
    try {
      JSON.parse(optionsSchema || 'null');
    } catch (_e) {
      return complete(createProgram(), 'error', { message: 'optionsSchema must be valid JSON' }) as StorageProgram<Result>;
    }

    // Built-ins are not stored — check custom only
    let p = createProgram();
    p = get(p, 'field-formatter', formatterId, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Formatter '${formatterId}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'field-formatter', formatterId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, optionsSchema, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { formatter: formatterId });
      },
    ) as StorageProgram<Result>;
  },

  unregister(input: Record<string, unknown>) {
    const formatterId = input.formatterId as string;

    // Built-in formatters cannot be unregistered
    const builtin = BUILTIN_FORMATTERS.find(f => f.formatterId === formatterId);
    if (builtin) {
      return complete(createProgram(), 'invalid', { message: `Built-in formatter '${formatterId}' cannot be unregistered` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'field-formatter', formatterId, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Formatter '${formatterId}' not found` }),
      (b) => {
        let b2 = del(b, 'field-formatter', formatterId);
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },
};

export const fieldFormatterHandler = autoInterpret(_handler);

export default fieldFormatterHandler;
