// ============================================================
// EnrichmentRenderer Concept Handler — Template-Driven (formerly Renderer)
//
// Patterns are the small code surface (shipped once).
// Handlers are pure data: pattern name + template config.
// New enrichment kinds need only a YAML entry — zero code.
//
// Built-in patterns:
//   list, checklist, link-list, code-list, heading-body,
//   callout, inline-list, bad-good, scaffold-list,
//   slash-list, keyed-checklist, example-list,
//   table-list, companion-link-list
//
// Template configs use {{field}} interpolation.
// Architecture doc: Clef Bind, Section 1.8
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

// --- Template Interpolation ---

/** Replace {{field}} placeholders with values from a data object. */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, field) => {
    const val = data[field];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

// --- Render Patterns (the code surface) ---

type PatternFn = (data: unknown, tpl: Record<string, unknown>) => string;

/**
 * list — Iterate an array of objects, render each with an item
 * template. Supports heading and custom prefix (default "- ").
 *
 * Template config: { heading?, prefix?, item }
 * Example: { heading: "Design Principles", item: "**{{title}}:** {{rule}}" }
 */
function patternList(data: unknown, tpl: Record<string, unknown>): string {
  const items = data as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const prefix = (tpl.prefix as string) ?? '- ';
  const itemTpl = (tpl.item as string) || '{{value}}';
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  for (const item of items) {
    const obj = typeof item === 'object' && item !== null ? item : { value: item };
    lines.push(`${prefix}${interpolate(itemTpl, obj)}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * checklist — Iterate an array of strings, render as checkboxes.
 *
 * Template config: { heading? }
 */
function patternChecklist(data: unknown, tpl: Record<string, unknown>): string {
  const items = data as string[];
  if (!Array.isArray(items) || items.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(`**${heading}:**`);
  for (const item of items) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * keyed-checklist — Record<string, string[]> → per-key checklists.
 *
 * Template config: { keyHeading? }
 * keyHeading uses {{key}} interpolation.
 */
function patternKeyedChecklist(data: unknown, tpl: Record<string, unknown>): string {
  const record = data as Record<string, string[]>;
  if (!record || typeof record !== 'object') return '';
  const keyHeadingTpl = (tpl.keyHeading as string) || '{{key}} Checklist';
  const lines: string[] = [];
  for (const [key, items] of Object.entries(record)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    lines.push(`**${interpolate(keyHeadingTpl, { key })}:**`);
    for (const item of items) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * link-list — Array of {path, label} → markdown links.
 *
 * Template config: { heading? }
 */
function patternLinkList(data: unknown, tpl: Record<string, unknown>): string {
  const refs = data as Array<{ path: string; label: string }>;
  if (!Array.isArray(refs) || refs.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  for (const ref of refs) {
    lines.push(`- [${ref.label}](${ref.path})`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * example-list — Array of {label, language, code} → fenced code blocks.
 *
 * Template config: { heading? }
 */
function patternExampleList(data: unknown, tpl: Record<string, unknown>): string {
  const examples = data as Array<{ label: string; language: string; code: string }>;
  if (!Array.isArray(examples) || examples.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(heading);
  for (const ex of examples) {
    lines.push(`*${ex.label}*`);
    lines.push('```' + (ex.language || ''));
    lines.push((ex.code || '').trimEnd());
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * code-list — Array of {label, command} → labeled bash blocks.
 *
 * Template config: { heading?, language? }
 */
function patternCodeList(data: unknown, tpl: Record<string, unknown>): string {
  const cmds = data as Array<{ label: string; command: string; afterStep?: number }>;
  if (!Array.isArray(cmds) || cmds.length === 0) return '';
  // Only render items without afterStep (global).
  const global = cmds.filter(v => !v.afterStep);
  if (global.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lang = (tpl.language as string) || 'bash';
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  for (const vc of global) {
    lines.push(`*${vc.label}:*`);
    lines.push('```' + lang);
    lines.push(vc.command);
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * heading-body — Single {heading, body} or renders data as body
 * under a configured heading.
 *
 * Template config: { heading? }
 * If data has its own heading field, that takes precedence.
 */
function patternHeadingBody(data: unknown, tpl: Record<string, unknown>): string {
  if (!data) return '';
  if (typeof data === 'string') {
    const heading = tpl.heading as string | undefined;
    if (!heading) return data + '\n\n';
    return `## ${heading}\n\n${data}\n\n`;
  }
  const obj = data as { heading?: string; body?: string };
  const heading = obj.heading || (tpl.heading as string);
  const body = obj.body || '';
  if (!heading) return body ? body + '\n\n' : '';
  return `## ${heading}\n\n${body}\n\n`;
}

/**
 * heading-body-list — Array of {heading, body} → multiple sections.
 * Filters out items with afterStep (step-specific, handled by target).
 *
 * Template config: { headingLevel? }
 */
function patternHeadingBodyList(data: unknown, tpl: Record<string, unknown>): string {
  const sections = data as Array<{ heading: string; body: string; afterStep?: number }>;
  if (!Array.isArray(sections) || sections.length === 0) return '';
  const global = sections.filter(s => !s.afterStep);
  if (global.length === 0) return '';
  const level = (tpl.headingLevel as string) || '###';
  const lines: string[] = [];
  for (const section of global) {
    lines.push(`${level} ${section.heading}`);
    lines.push('');
    lines.push(section.body);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * callout — String → blockquote callout.
 *
 * Template config: { label }
 */
function patternCallout(data: unknown, tpl: Record<string, unknown>): string {
  const text = data as string;
  if (!text || typeof text !== 'string') return '';
  const label = (tpl.label as string) || 'Note';
  return `> **${label}:** ${text}\n\n`;
}

/**
 * inline-list — String[] → comma-separated with prefix.
 *
 * Template config: { prefix? }
 */
function patternInlineList(data: unknown, tpl: Record<string, unknown>): string {
  const items = data as string[];
  if (!Array.isArray(items) || items.length === 0) return '';
  const prefix = (tpl.prefix as string) || '**Items:**';
  return `${prefix} ${items.join(', ')}\n\n`;
}

/**
 * bad-good — Array of {title, description, bad?, good?} →
 * comparison blocks with optional fenced code.
 *
 * Template config: { heading? }
 */
function patternBadGood(data: unknown, tpl: Record<string, unknown>): string {
  const patterns = data as Array<{ title: string; description: string; bad?: string; good?: string }>;
  if (!Array.isArray(patterns) || patterns.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
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

/**
 * scaffold-list — Array of {name, path, description} → sections with links.
 *
 * Template config: { heading? }
 */
function patternScaffoldList(data: unknown, tpl: Record<string, unknown>): string {
  const scaffolds = data as Array<{ name: string; path: string; description: string }>;
  if (!Array.isArray(scaffolds) || scaffolds.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  for (const sc of scaffolds) {
    lines.push(`### ${sc.name}`);
    lines.push(sc.description);
    lines.push(`See [${sc.name}](${sc.path})`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * slash-list — Array of string | {name, description} → skill links.
 *
 * Template config: { heading? }
 */
function patternSlashList(data: unknown, tpl: Record<string, unknown>): string {
  const related = data as Array<string | { name: string; description: string }>;
  if (!Array.isArray(related) || related.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
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

/**
 * table-list — Array of objects → markdown table.
 * Renders structured data as a table with configurable headers.
 *
 * Template config: { heading?, headers: string[], fields: string[], namePrefix? }
 * headers: column header labels (e.g. ["Skill", "When to Use"])
 * fields: object keys to extract for each column (e.g. ["name", "description"])
 * namePrefix: optional prefix for the first column value (e.g. "`/")
 */
function patternTableList(data: unknown, tpl: Record<string, unknown>): string {
  const items = data as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const headers = (tpl.headers as string[]) || ['Name', 'Description'];
  const fields = (tpl.fields as string[]) || ['name', 'description'];
  const namePrefix = (tpl.namePrefix as string) || '';
  const nameSuffix = (tpl.nameSuffix as string) || '';
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  // Header row
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  // Data rows
  for (const item of items) {
    const obj = typeof item === 'object' && item !== null ? item : { name: item };
    const cells = fields.map((f, i) => {
      const val = typeof obj === 'string' ? obj : String(obj[f] ?? '');
      return i === 0 && namePrefix ? `${namePrefix}${val}${nameSuffix}` : val;
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * companion-link-list — Array of {path, label, tier?} → categorised links.
 * Groups companion documents by tier (inline, reference, summary) and
 * renders them as sectioned markdown links.
 *
 * Template config: { heading?, tiers?: string[] }
 * tiers: which tiers to include (default: all).
 */
function patternCompanionLinkList(data: unknown, tpl: Record<string, unknown>): string {
  const docs = data as Array<{ path: string; label: string; tier?: string; description?: string }>;
  if (!Array.isArray(docs) || docs.length === 0) return '';
  const heading = tpl.heading as string | undefined;
  const preamble = tpl.preamble as string | undefined;
  const tierFilter = tpl.tiers as string[] | undefined;
  const filtered = tierFilter ? docs.filter(d => !d.tier || tierFilter.includes(d.tier)) : docs;
  if (filtered.length === 0) return '';
  const lines: string[] = [];
  if (heading) lines.push(`## ${heading}`, '');
  if (preamble) lines.push(preamble, '');
  for (const doc of filtered) {
    const desc = doc.description ? ` — ${doc.description}` : '';
    lines.push(`- [${doc.label}](${doc.path})${desc}`);
  }
  lines.push('');
  return lines.join('\n');
}

// --- Content Variable Interpolation ---

/**
 * Replace $VARIABLE placeholders in a string with values from a
 * variables context. Each target provides its own variable vocabulary
 * (e.g. Claude Skills uses $ARGUMENTS, CLI uses <SOURCE>).
 *
 * Exported so targets can use this for intro-template rendering.
 */
export function interpolateVars(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [name, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\$${name}`, 'g'), value);
  }
  return result;
}

// --- Tier Filtering Utility ---

/**
 * Filter an array of enrichment items by tier.
 * Items without a tier field pass through (treated as 'inline').
 *
 * Exported so targets can filter enrichment items by tier before rendering.
 */
export function filterByTier<T extends { tier?: string }>(
  items: T[],
  tier: string,
): T[] {
  return items.filter(item => (item.tier || 'inline') === tier);
}

// --- Pattern Registry ---

const PATTERNS: Record<string, PatternFn> = {
  'list':              patternList,
  'checklist':         patternChecklist,
  'keyed-checklist':   patternKeyedChecklist,
  'link-list':         patternLinkList,
  'example-list':      patternExampleList,
  'code-list':         patternCodeList,
  'heading-body':      patternHeadingBody,
  'heading-body-list': patternHeadingBodyList,
  'callout':           patternCallout,
  'inline-list':       patternInlineList,
  'bad-good':          patternBadGood,
  'scaffold-list':          patternScaffoldList,
  'slash-list':             patternSlashList,
  'table-list':             patternTableList,
  'companion-link-list':    patternCompanionLinkList,
};

// --- Handler Registry (data-driven) ---

interface HandlerDef {
  key: string;
  format: string;
  order: number;
  pattern: string;
  template: Record<string, unknown>;
}

/**
 * Global handler registry. Keyed by `${format}:${key}`.
 * Each entry is pure data: pattern name + template config.
 */
const handlerRegistry = new Map<string, HandlerDef>();

function regKey(key: string, format: string): string {
  return `${format}:${key}`;
}

function registerHandler(def: HandlerDef): void {
  handlerRegistry.set(regKey(def.key, def.format), def);
}

function getHandlersForFormat(format: string): HandlerDef[] {
  const handlers: HandlerDef[] = [];
  for (const def of handlerRegistry.values()) {
    if (def.format === format) handlers.push(def);
  }
  return handlers.sort((a, b) => a.order - b.order);
}

/** Execute a handler: look up its pattern, run with template config. */
function executeHandler(def: HandlerDef, data: unknown): string {
  const patternFn = PATTERNS[def.pattern];
  if (!patternFn) return '';
  return patternFn(data, def.template);
}

// --- Built-in Handlers (pure data) ---

const BUILTIN_HANDLERS: HandlerDef[] = [
  {
    key: 'tool-permissions',
    order: 5,
    pattern: 'inline-list',
    template: { prefix: '**Allowed tools:**' },
  },
  {
    key: 'trigger-description',
    order: 10,
    pattern: 'callout',
    template: { label: 'When to use' },
  },
  {
    key: 'design-principles',
    order: 20,
    pattern: 'list',
    template: { heading: 'Design Principles', item: '**{{title}}:** {{rule}}' },
  },
  {
    key: 'checklists',
    order: 40,
    pattern: 'keyed-checklist',
    template: { keyHeading: '{{key}}' },
  },
  {
    key: 'examples',
    order: 50,
    pattern: 'example-list',
    template: { heading: '**Examples:**' },
  },
  {
    key: 'references',
    order: 60,
    pattern: 'link-list',
    template: { heading: 'References' },
  },
  {
    key: 'scaffolds',
    order: 70,
    pattern: 'scaffold-list',
    template: { heading: 'Scaffold Templates' },
  },
  {
    key: 'content-sections',
    order: 80,
    pattern: 'heading-body-list',
    template: { headingLevel: '###' },
  },
  {
    key: 'quick-reference',
    order: 85,
    pattern: 'heading-body',
    template: {},
  },
  {
    key: 'anti-patterns',
    order: 90,
    pattern: 'bad-good',
    template: { heading: 'Anti-Patterns' },
  },
  {
    key: 'validation-commands',
    order: 95,
    pattern: 'code-list',
    template: { heading: 'Validation', language: 'bash' },
  },
  {
    key: 'related-workflows',
    order: 100,
    pattern: 'slash-list',
    template: { heading: 'Related Skills' },
  },
];

// Register built-in handlers for all textual interface formats.
// skill-md: Claude Skills SKILL.md files
// cli-help: CLI help text and man pages
// mcp-help: MCP tool/resource descriptions
// rest-help: REST API documentation
for (const format of ['skill-md', 'cli-help', 'mcp-help', 'rest-help']) {
  for (const h of BUILTIN_HANDLERS) {
    registerHandler({ ...h, format });
  }
}

// --- Format-Specific Handler Overrides ---
// skill-md: related-workflows renders as a table with "When to Use" column
registerHandler({
  key: 'related-workflows',
  format: 'skill-md',
  order: 100,
  pattern: 'table-list',
  template: { heading: 'Related Skills', headers: ['Skill', 'When to Use'], fields: ['name', 'description'], namePrefix: '`/', nameSuffix: '`' },
});

// All formats: companion-docs renders as categorised links
for (const format of ['skill-md', 'cli-help', 'mcp-help', 'rest-help']) {
  registerHandler({
    key: 'companion-docs',
    format,
    order: 65,
    pattern: 'companion-link-list',
    template: { heading: 'Supporting Materials' },
  });
}

// All formats: example-walkthroughs renders as link list with preamble
for (const format of ['skill-md', 'cli-help', 'mcp-help', 'rest-help']) {
  registerHandler({
    key: 'example-walkthroughs',
    format,
    order: 88,
    pattern: 'companion-link-list',
    template: { heading: 'Example Walkthroughs', preamble: 'For complete examples with design rationale:' },
  });
}

// cli-help: related-workflows stays as slash-list (already registered above)
// mcp-help: related-workflows as inline-list
registerHandler({
  key: 'related-workflows',
  format: 'mcp-help',
  order: 100,
  pattern: 'inline-list',
  template: { prefix: '**Related tools:**' },
});

// rest-help: related-workflows as table
registerHandler({
  key: 'related-workflows',
  format: 'rest-help',
  order: 100,
  pattern: 'table-list',
  template: { heading: 'Related Endpoints', headers: ['Endpoint', 'Description'], fields: ['name', 'description'] },
});

// --- Public Utility API ---
// Targets import these directly for inline rendering.

/**
 * Render enrichment content in the given format.
 * Returns the rendered output string and a list of unhandled keys.
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

  for (const handler of handlers) {
    if (handler.key in content) {
      const output = executeHandler(handler, content[handler.key]);
      if (output) sections.push({ order: handler.order, output });
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
 * Returns empty string if no handler is registered.
 */
export function renderKey(
  key: string,
  data: unknown,
  format: string,
): string {
  const def = handlerRegistry.get(regKey(key, format));
  if (!def) return '';
  return executeHandler(def, data);
}

/**
 * Register a custom handler from data. Targets, plugins, or
 * manifest loaders call this to extend the renderer at runtime.
 */
export function registerCustomHandler(
  key: string,
  format: string,
  order: number,
  pattern: string,
  template: Record<string, unknown>,
): boolean {
  if (!PATTERNS[pattern]) return false;
  registerHandler({ key, format, order, pattern, template });
  return true;
}

// --- Concept Handler ---

export const rendererHandler: ConceptHandler = {
  async register(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const key = input.key as string;
    const format = input.format as string;
    const order = (input.order as number) || 50;
    const pattern = input.pattern as string;
    const templateStr = input.template as string;

    if (!key || !format) {
      return { variant: 'invalidTemplate', template: '', reason: 'key and format are required' };
    }

    if (!pattern || !PATTERNS[pattern]) {
      return { variant: 'unknownPattern', pattern: pattern || '' };
    }

    let template: Record<string, unknown> = {};
    if (templateStr) {
      try {
        template = JSON.parse(templateStr);
      } catch {
        return { variant: 'invalidTemplate', template: templateStr, reason: 'Template is not valid JSON' };
      }
    }

    registerHandler({ key, format, order, pattern, template });

    const handlerId = `${format}:${key}`;
    await storage.put('handlers', handlerId, { key, format, order, pattern, template });

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

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(contentStr || '{}');
    } catch {
      return { variant: 'invalidContent', reason: 'Content is not valid JSON' };
    }

    const result = renderContent(content, format);

    if (result.sectionCount === 0 && result.unhandledKeys.length === Object.keys(content).length) {
      // Check if this is because no handlers exist for the format at all
      const handlers = getHandlersForFormat(format);
      if (handlers.length === 0) {
        return { variant: 'unknownFormat', format };
      }
    }

    return {
      variant: 'ok',
      output: result.output,
      sectionCount: result.sectionCount,
      unhandledKeys: result.unhandledKeys,
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

  async listPatterns(
    _input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    return {
      variant: 'ok',
      patterns: Object.keys(PATTERNS),
    };
  },
};
