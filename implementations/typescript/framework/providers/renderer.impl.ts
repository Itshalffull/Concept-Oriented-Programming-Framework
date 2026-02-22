// ============================================================
// Renderer Concept Handler
//
// Registry-based renderer for opaque enrichment JSON. Each
// handler knows how to render one enrichment key in one output
// format. Targets call render(content, format) and get back
// assembled output. New enrichment kinds = register a handler.
// Architecture doc: Interface Kit, Section 1.8
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';

// --- Handler Registry ---

/** A registered render handler for a (key, format) pair. */
interface RenderHandler {
  key: string;
  format: string;
  order: number;
  fn: (data: unknown, ctx: RenderContext) => string;
}

/** Context passed to render handler functions. */
interface RenderContext {
  format: string;
  allContent: Record<string, unknown>;
}

/**
 * Global handler registry. Keyed by `${format}:${key}`.
 * Populated at module load time with built-in handlers.
 * Custom handlers can be registered via the register action.
 */
const handlerRegistry = new Map<string, RenderHandler>();

function registryKey(key: string, format: string): string {
  return `${format}:${key}`;
}

function registerHandler(
  key: string,
  format: string,
  order: number,
  fn: (data: unknown, ctx: RenderContext) => string,
): void {
  handlerRegistry.set(registryKey(key, format), { key, format, order, fn });
}

function getHandlersForFormat(format: string): RenderHandler[] {
  const handlers: RenderHandler[] = [];
  for (const handler of handlerRegistry.values()) {
    if (handler.format === format) {
      handlers.push(handler);
    }
  }
  return handlers.sort((a, b) => a.order - b.order);
}

// --- Built-in Markdown Render Functions ---
// Each function takes opaque data and returns a markdown string.
// They're registered for "skill-md" and "cli-help" formats.

function renderDesignPrinciples(data: unknown): string {
  const principles = data as Array<{ title: string; rule: string }>;
  if (!Array.isArray(principles) || principles.length === 0) return '';
  const lines = ['## Design Principles', ''];
  for (const dp of principles) {
    lines.push(`- **${dp.title}:** ${dp.rule}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderChecklists(data: unknown): string {
  const checklists = data as Record<string, string[]>;
  if (!checklists || typeof checklists !== 'object') return '';
  const lines: string[] = [];
  for (const [step, items] of Object.entries(checklists)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    lines.push(`**${step} Checklist:**`);
    for (const item of items) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderReferences(data: unknown): string {
  const refs = data as Array<{ path: string; label: string }>;
  if (!Array.isArray(refs) || refs.length === 0) return '';
  const lines = ['## References', ''];
  for (const ref of refs) {
    lines.push(`- [${ref.label}](${ref.path})`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderExamples(data: unknown): string {
  const examples = data as Array<{ label: string; language: string; code: string }>;
  if (!Array.isArray(examples) || examples.length === 0) return '';
  const lines = ['**Examples:**'];
  for (const ex of examples) {
    lines.push(`*${ex.label}*`);
    lines.push('```' + ex.language);
    lines.push(ex.code.trimEnd());
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

function renderAntiPatterns(data: unknown): string {
  const patterns = data as Array<{ title: string; description: string; bad?: string; good?: string }>;
  if (!Array.isArray(patterns) || patterns.length === 0) return '';
  const lines = ['## Anti-Patterns', ''];
  for (const ap of patterns) {
    lines.push(`### ${ap.title}`);
    lines.push(ap.description);
    if (ap.bad) {
      lines.push('');
      lines.push('**Bad:**');
      lines.push('```');
      lines.push(ap.bad);
      lines.push('```');
    }
    if (ap.good) {
      lines.push('');
      lines.push('**Good:**');
      lines.push('```');
      lines.push(ap.good);
      lines.push('```');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderRelatedWorkflows(data: unknown): string {
  const related = data as Array<string | { name: string; description: string }>;
  if (!Array.isArray(related) || related.length === 0) return '';
  const lines = ['## Related Skills', ''];
  for (const r of related) {
    if (typeof r === 'string') {
      lines.push(`- /${r}`);
    } else {
      lines.push(`- /${r.name} — ${r.description}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderQuickReference(data: unknown): string {
  const qr = data as { heading: string; body: string };
  if (!qr || !qr.heading) return '';
  const lines = [`## ${qr.heading}`, '', qr.body, ''];
  return lines.join('\n');
}

function renderContentSections(data: unknown): string {
  const sections = data as Array<{ heading: string; body: string; afterStep?: number }>;
  if (!Array.isArray(sections) || sections.length === 0) return '';
  // Only render sections without afterStep (global). Step-specific ones
  // are handled by the workflow renderer in the target provider.
  const global = sections.filter(s => !s.afterStep);
  if (global.length === 0) return '';
  const lines: string[] = [];
  for (const section of global) {
    lines.push(`### ${section.heading}`);
    lines.push('');
    lines.push(section.body);
    lines.push('');
  }
  return lines.join('\n');
}

function renderValidationCommands(data: unknown): string {
  const cmds = data as Array<{ label: string; command: string; afterStep?: number }>;
  if (!Array.isArray(cmds) || cmds.length === 0) return '';
  // Only render commands without afterStep (global).
  const global = cmds.filter(v => !v.afterStep);
  if (global.length === 0) return '';
  const lines = ['## Validation', ''];
  for (const vc of global) {
    lines.push(`*${vc.label}:*`);
    lines.push('```bash');
    lines.push(vc.command);
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

function renderScaffolds(data: unknown): string {
  const scaffolds = data as Array<{ name: string; path: string; description: string }>;
  if (!Array.isArray(scaffolds) || scaffolds.length === 0) return '';
  const lines = ['## Scaffold Templates', ''];
  for (const sc of scaffolds) {
    lines.push(`### ${sc.name}`);
    lines.push(sc.description);
    lines.push(`See [${sc.name}](${sc.path})`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderTriggerDescription(data: unknown): string {
  const desc = data as string;
  if (!desc || typeof desc !== 'string') return '';
  return `> **When to use:** ${desc}\n\n`;
}

function renderToolPermissions(data: unknown): string {
  const perms = data as string[];
  if (!Array.isArray(perms) || perms.length === 0) return '';
  return `**Allowed tools:** ${perms.join(', ')}\n\n`;
}

// --- Register Built-in Handlers ---
// Order determines render position. Lower = earlier in output.
// These are registered for both "skill-md" and "cli-help" formats.

const BUILTIN_HANDLERS: Array<{
  key: string;
  order: number;
  fn: (data: unknown, ctx: RenderContext) => string;
}> = [
  { key: 'tool-permissions',     order: 5,   fn: renderToolPermissions },
  { key: 'trigger-description',  order: 10,  fn: renderTriggerDescription },
  { key: 'design-principles',    order: 20,  fn: renderDesignPrinciples },
  { key: 'checklists',           order: 40,  fn: renderChecklists },
  { key: 'examples',             order: 50,  fn: renderExamples },
  { key: 'references',           order: 60,  fn: renderReferences },
  { key: 'scaffolds',            order: 70,  fn: renderScaffolds },
  { key: 'content-sections',     order: 80,  fn: renderContentSections },
  { key: 'quick-reference',      order: 85,  fn: renderQuickReference },
  { key: 'anti-patterns',        order: 90,  fn: renderAntiPatterns },
  { key: 'validation-commands',  order: 95,  fn: renderValidationCommands },
  { key: 'related-workflows',    order: 100, fn: renderRelatedWorkflows },
];

// Register for both skill-md and cli-help formats
for (const format of ['skill-md', 'cli-help']) {
  for (const h of BUILTIN_HANDLERS) {
    registerHandler(h.key, format, h.order, h.fn);
  }
}

// --- Public Utility API ---
// Targets import these directly for inline rendering without
// going through the concept handler / sync layer.

/**
 * Render enrichment content in the given format.
 * Returns the rendered output string and a list of unhandled keys.
 * This is the main utility function targets import.
 */
export function renderContent(
  content: Record<string, unknown>,
  format: string,
): { output: string; sectionCount: number; unhandledKeys: string[] } {
  const handlers = getHandlersForFormat(format);
  if (handlers.length === 0) {
    return { output: '', sectionCount: 0, unhandledKeys: Object.keys(content) };
  }

  const sections: Array<{ order: number; output: string }> = [];
  const handledKeys = new Set<string>();
  const ctx: RenderContext = { format, allContent: content };

  for (const handler of handlers) {
    if (handler.key in content) {
      const output = handler.fn(content[handler.key], ctx);
      if (output) {
        sections.push({ order: handler.order, output });
      }
      handledKeys.add(handler.key);
    }
  }

  const unhandledKeys = Object.keys(content).filter(k => !handledKeys.has(k));
  sections.sort((a, b) => a.order - b.order);
  const output = sections.map(s => s.output).join('');

  return { output, sectionCount: sections.length, unhandledKeys };
}

/**
 * Render a single enrichment key in the given format.
 * Returns empty string if no handler is registered for (key, format).
 */
export function renderKey(
  key: string,
  data: unknown,
  format: string,
  allContent?: Record<string, unknown>,
): string {
  const handler = handlerRegistry.get(registryKey(key, format));
  if (!handler) return '';
  const ctx: RenderContext = { format, allContent: allContent || {} };
  return handler.fn(data, ctx);
}

/**
 * Register a custom handler for a (key, format) pair.
 * Targets or plugins can call this to extend the renderer.
 */
export { registerHandler };

// --- Concept Handler ---

export const rendererHandler: ConceptHandler = {
  async register(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const key = input.key as string;
    const format = input.format as string;
    const order = (input.order as number) || 50;
    const template = input.template as string;

    if (!key || !format) {
      return { variant: 'invalidTemplate', template: template || '', reason: 'key and format are required' };
    }

    // For named templates, look up built-in handlers
    if (template && template.startsWith('builtin:')) {
      const builtinName = template.slice('builtin:'.length);
      const builtin = BUILTIN_HANDLERS.find(h => h.key === builtinName);
      if (!builtin) {
        return { variant: 'invalidTemplate', template, reason: `Unknown builtin handler: ${builtinName}` };
      }
      registerHandler(key, format, order, builtin.fn);
    } else {
      // Inline template — render as a content section with the template as body
      registerHandler(key, format, order, (data: unknown) => {
        if (!data) return '';
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return `## ${key}\n\n${content}\n\n`;
      });
    }

    const handlerId = `${format}:${key}`;
    await storage.put('handlers', handlerId, { key, format, order, template: template || 'inline' });

    return { variant: 'ok', handler: handlerId };
  },

  async render(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const contentStr = input.content as string;
    const format = input.format as string;

    if (!format) {
      return { variant: 'unknownFormat', format: '' };
    }

    // Parse content JSON
    let content: Record<string, unknown>;
    try {
      content = JSON.parse(contentStr || '{}');
    } catch {
      return { variant: 'invalidContent', reason: 'Content is not valid JSON' };
    }

    // Get handlers for this format
    const handlers = getHandlersForFormat(format);
    if (handlers.length === 0) {
      return { variant: 'unknownFormat', format };
    }

    // Walk content keys, dispatch to handlers, collect output
    const sections: Array<{ order: number; output: string }> = [];
    const handledKeys = new Set<string>();
    const ctx: RenderContext = { format, allContent: content };

    for (const handler of handlers) {
      if (handler.key in content) {
        const output = handler.fn(content[handler.key], ctx);
        if (output) {
          sections.push({ order: handler.order, output });
        }
        handledKeys.add(handler.key);
      }
    }

    // Collect unhandled keys
    const unhandledKeys = Object.keys(content).filter(k => !handledKeys.has(k));

    // Assemble output in order
    sections.sort((a, b) => a.order - b.order);
    const output = sections.map(s => s.output).join('');

    return {
      variant: 'ok',
      output,
      sectionCount: sections.length,
      unhandledKeys,
    };
  },

  async listHandlers(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const format = input.format as string;
    const handlers = getHandlersForFormat(format);
    return {
      variant: 'ok',
      handlers: handlers.map(h => h.key),
      count: handlers.length,
    };
  },
};
