// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// EnrichmentRenderer Handler
//
// Render opaque enrichment JSON into formatted output strings
// using data-driven templates. Handlers are declarative -- each
// maps an enrichment key to a built-in render pattern (list,
// checklist, code-list, callout, heading-body, bad-good, etc.)
// plus a template config with {{field}} interpolation. Patterns
// are the small code surface shipped once; handlers are pure
// data that can live in YAML manifests. New enrichment kinds
// need only a YAML entry -- zero code changes.
// See Architecture doc Section 1.8.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `enrichment-renderer-${++idCounter}`;
}

const BUILT_IN_PATTERNS = [
  'list',
  'checklist',
  'code-list',
  'link-list',
  'callout',
  'heading-body',
  'bad-good',
  'scaffold-list',
  'slash-list',
  'keyed-checklist',
  'inline-list',
];

/**
 * Interpolate {{field}} placeholders in a template string using data.
 */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, field) => {
    const value = data[field];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/**
 * Render a section using a pattern and template config against data.
 */
function renderPattern(
  pattern: string,
  templateStr: string,
  data: unknown,
): string {
  let templateConfig: Record<string, unknown> = {};
  try {
    templateConfig = JSON.parse(templateStr);
  } catch {
    // Use empty config if parsing fails
  }

  const record = typeof data === 'object' && data !== null
    ? data as Record<string, unknown>
    : {};
  const items = Array.isArray(data) ? data : [];

  switch (pattern) {
    case 'heading-body': {
      const heading = interpolate(
        (templateConfig.heading as string) || '{{heading}}',
        record,
      );
      const body = (record.body as string) || '';
      return `### ${heading}\n\n${body}`;
    }
    case 'list': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'string') return `- ${item}`;
        if (typeof item === 'object' && item !== null) {
          return `- ${interpolate((templateConfig.itemTemplate as string) || '{{title}}', item as Record<string, unknown>)}`;
        }
        return `- ${String(item)}`;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'checklist': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'string') return `- [ ] ${item}`;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return `- [ ] ${obj.label || obj.title || JSON.stringify(item)}`;
        }
        return `- [ ] ${String(item)}`;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'code-list': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'string') return `- \`${item}\``;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return `- \`${obj.code || obj.command || JSON.stringify(item)}\``;
        }
        return `- \`${String(item)}\``;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'link-list': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return `- [${obj.title || obj.label || 'Link'}](${obj.url || obj.href || '#'})`;
        }
        return `- ${String(item)}`;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'callout': {
      const kind = (templateConfig.kind as string) || 'info';
      const body = typeof data === 'string' ? data : (record.body as string) || JSON.stringify(data);
      return `> **${kind.toUpperCase()}**: ${body}`;
    }
    case 'bad-good': {
      const title = (templateConfig.title as string) || '';
      const bad = Array.isArray(record.bad) ? record.bad : [];
      const good = Array.isArray(record.good) ? record.good : [];
      const lines: string[] = [];
      if (title) lines.push(`### ${title}`);
      if (bad.length > 0) {
        lines.push('');
        lines.push('**Avoid:**');
        for (const b of bad) lines.push(`- ${b}`);
      }
      if (good.length > 0) {
        lines.push('');
        lines.push('**Prefer:**');
        for (const g of good) lines.push(`- ${g}`);
      }
      return lines.join('\n');
    }
    case 'scaffold-list': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return `- \`${obj.path || obj.file || ''}\` — ${obj.description || ''}`;
        }
        return `- ${String(item)}`;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'slash-list': {
      const title = (templateConfig.title as string) || '';
      const lines = items.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return `- \`/${obj.command || obj.name || ''}\` — ${obj.description || ''}`;
        }
        return `- /${String(item)}`;
      });
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'keyed-checklist': {
      const title = (templateConfig.title as string) || '';
      const lines: string[] = [];
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        for (const [k, v] of Object.entries(record)) {
          lines.push(`- [ ] **${k}**: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
        }
      }
      return (title ? `### ${title}\n\n` : '') + lines.join('\n');
    }
    case 'inline-list': {
      const separator = (templateConfig.separator as string) || ', ';
      const values = items.map((item: unknown) => String(item));
      return values.join(separator);
    }
    default:
      return JSON.stringify(data);
  }
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const key = input.key as string;
    const format = input.format as string;
    const order = input.order as number;
    const pattern = input.pattern as string;
    const template = input.template as string;

    if (!BUILT_IN_PATTERNS.includes(pattern)) {
      const p = createProgram();
      return complete(p, 'unknownPattern', { pattern }) as StorageProgram<Result>;
    }

    try {
      JSON.parse(template);
    } catch {
      const p = createProgram();
      return complete(p, 'invalidTemplate', { template, reason: 'Template is not valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'enrichment-renderer', { key, format }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>[];
          const existingId = existing[0].id as string;
          return { handler: existingId };
        });
      },
      (elseP) => {
        const id = nextId();
        elseP = put(elseP, 'enrichment-renderer', id, {
          id,
          key,
          format,
          order,
          pattern,
          template,
        });
        return complete(elseP, 'ok', { handler: id });
      },
    ) as StorageProgram<Result>;
  },

  render(input: Record<string, unknown>) {
    const content = input.content as string;
    const format = input.format as string;

    let contentData: Record<string, unknown>;
    try {
      contentData = JSON.parse(content);
    } catch {
      const p = createProgram();
      return complete(p, 'invalidContent', { reason: 'Content is not valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'enrichment-renderer', { format }, 'handlers');

    return branch(p,
      (bindings) => (bindings.handlers as unknown[]).length === 0,
      (thenP) => complete(thenP, 'unknownFormat', { format }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const handlers = bindings.handlers as Record<string, unknown>[];
        const sorted = handlers.sort((a, b) => (a.order as number) - (b.order as number));

        const handledKeys = new Set<string>();
        const sections: string[] = [];

        for (const handler of sorted) {
          const handlerKey = handler.key as string;
          if (handlerKey in contentData) {
            handledKeys.add(handlerKey);
            const rendered = renderPattern(
              handler.pattern as string,
              handler.template as string,
              contentData[handlerKey],
            );
            sections.push(rendered);
          }
        }

        const unhandledKeys = Object.keys(contentData).filter(k => !handledKeys.has(k));

        const output = sections.join('\n\n');
        return {
          output,
          sectionCount: sections.length,
          unhandledKeys,
        };
      }),
    ) as StorageProgram<Result>;
  },

  listHandlers(input: Record<string, unknown>) {
    if (!input.format || (typeof input.format === 'string' && (input.format as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'format is required' }) as StorageProgram<Result>;
    }
    const format = input.format as string;

    let p = createProgram();
    p = find(p, 'enrichment-renderer', { format }, 'handlers');

    p = mapBindings(p, (bindings) => {
      const handlers = bindings.handlers as Record<string, unknown>[];
      const sorted = handlers.sort((a, b) => (a.order as number) - (b.order as number));
      return sorted.map(h => h.key as string);
    }, 'keys');

    return branch(p,
      (b) => (b.keys as string[]).length > 0,
      completeFrom(createProgram(), 'ok', (b) => {
        const keys = b.keys as string[];
        return { handlers: keys, count: keys.length };
      }),
      complete(createProgram(), 'error', { message: `no handlers found for format '${format}'` }),
    ) as StorageProgram<Result>;
  },

  listPatterns(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { patterns: [...BUILT_IN_PATTERNS] }) as StorageProgram<Result>;
  },
};

export const enrichmentRendererHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetEnrichmentRendererCounter(): void {
  idCounter = 0;
}
