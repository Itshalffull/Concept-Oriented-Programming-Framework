// @migrated dsl-constructs 2026-03-18
// ============================================================
// DerivedScaffoldGen — Derived concept (.derived) scaffold generator
//
// Generates well-formed .derived files from provided inputs:
// name, type parameters, purpose, composes list, syncs,
// surface actions/queries, and operational principles.
//
// See derived-concepts-proposal-v3.md for the full specification.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface ComposesEntry {
  name: string;
  typeParams: string[];
  isDerived?: boolean;
}

interface ActionTrigger {
  concept: string;
  action: string;
  args: Record<string, string>;
}

interface SurfaceAction {
  name: string;
  params: Array<{ name: string; type: string }>;
  matches:
    | { type: 'action'; concept: string; action: string; fields?: Record<string, string>; on?: Record<string, string> }
    | { type: 'derivedContext'; tag: string }
    | { type: 'entry'; concept: string; action: string; fields?: Record<string, string> };
  triggers?: ActionTrigger[];
}

interface SurfaceQuery {
  name: string;
  params: Array<{ name: string; type: string }>;
  target: { concept: string; action: string; args: Record<string, string> };
  /** When true, generate block form with reads: instead of inline -> form. */
  blockForm?: boolean;
}

function buildDerivedSpec(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyDerived';
  const typeParams = (input.typeParams as string[]) || ['T'];
  const purpose = (input.purpose as string) || `TODO: Describe the purpose of ${name}.`;
  const composes = (input.composes as ComposesEntry[]) || [];
  const syncs = (input.syncs as string[]) || [];
  const actions = (input.surfaceActions as SurfaceAction[]) || [];
  const queries = (input.surfaceQueries as SurfaceQuery[]) || [];
  const principle = (input.principle as string[]) || [];

  const lines: string[] = [];
  const typeParamStr = typeParams.join(', ');

  // Derived declaration
  lines.push(`derived ${name} [${typeParamStr}] {`);
  lines.push('');

  // Purpose
  lines.push('  purpose {');
  for (const line of purpose.split('\n')) {
    lines.push(`    ${line.trim()}`);
  }
  lines.push('  }');
  lines.push('');

  // Composes
  lines.push('  composes {');
  for (const c of composes) {
    const prefix = c.isDerived ? 'derived ' : '';
    const params = c.typeParams.length > 0 ? ` [${c.typeParams.join(', ')}]` : '';
    lines.push(`    ${prefix}${c.name}${params}`);
  }
  lines.push('  }');
  lines.push('');

  // Syncs
  lines.push('  syncs {');
  if (syncs.length > 0) {
    lines.push(`    required: [${syncs.join(', ')}]`);
  } else {
    lines.push('    required: []');
  }
  lines.push('  }');
  lines.push('');

  // Surface
  lines.push('  surface {');
  for (const action of actions) {
    const paramStr = action.params.map(p => `${p.name}: ${p.type}`).join(', ');
    lines.push(`    action ${action.name}(${paramStr}) {`);

    if (action.matches.type === 'entry') {
      // entry: + triggers: form
      const { concept, action: actionName, fields } = action.matches;
      let entryLine = `      entry: ${concept}/${actionName}`;
      if (fields && Object.keys(fields).length > 0) {
        const fieldStr = Object.entries(fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        entryLine += ` matches on ${fieldStr}`;
      }
      lines.push(entryLine);

      if (action.triggers && action.triggers.length > 0) {
        lines.push('      triggers: [');
        for (const trigger of action.triggers) {
          const trigArgsStr = Object.entries(trigger.args)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          lines.push(`        ${trigger.concept}/${trigger.action}(${trigArgsStr})`);
        }
        lines.push('      ]');
      }
    } else if (action.matches.type === 'derivedContext') {
      lines.push(`      matches: derivedContext "${action.matches.tag}"`);
    } else {
      // Standard matches: form (type === 'action')
      const { concept, action: actionName, fields, on: onFields } = action.matches;
      if (fields && Object.keys(fields).length > 0) {
        const fieldStr = Object.entries(fields)
          .map(([k, v]) => `${k}: "${v}"`)
          .join(', ');
        lines.push(`      matches: ${concept}/${actionName}(${fieldStr})`);
      } else if (onFields && Object.keys(onFields).length > 0) {
        const onStr = Object.entries(onFields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        lines.push(`      matches: ${concept}/${actionName} on ${onStr}`);
      } else {
        lines.push(`      matches: ${concept}/${actionName}`);
      }
    }

    lines.push('    }');
    lines.push('');
  }

  for (const query of queries) {
    const paramStr = query.params.map(p => `${p.name}: ${p.type}`).join(', ');
    const argsStr = Object.entries(query.target.args)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    if (query.blockForm) {
      // Block form with reads: keyword
      lines.push(`    query ${query.name}(${paramStr}) {`);
      lines.push(`      reads: ${query.target.concept}/${query.target.action}(${argsStr})`);
      lines.push('    }');
    } else {
      // Inline arrow form
      lines.push(`    query ${query.name}(${paramStr}) -> ${query.target.concept}/${query.target.action}(${argsStr})`);
    }
  }

  lines.push('  }');

  // Principle
  if (principle.length > 0) {
    lines.push('');
    lines.push('  principle {');
    for (const step of principle) {
      lines.push(`    ${step}`);
    }
    lines.push('  }');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    { let p = createProgram(); p = complete(p, 'ok', { name: 'DerivedScaffoldGen',
      inputKind: 'DerivedConfig',
      outputKind: 'DerivedSpec',
      capabilities: JSON.stringify([
        'derived-spec', 'composes', 'surface-actions',
        'surface-queries', 'principles', 'annotation-syncs',
        'entry-triggers', 'derived-context', 'block-queries',
      ]) }); return p; }
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MyDerived';

    if (!name || typeof name !== 'string') {
      { let p = createProgram(); p = complete(p, 'error', { message: 'Derived concept name is required' }); return p; }
    }

    try {
      const derivedSpec = buildDerivedSpec(input);
      const kebab = toKebab(name);

      const files: { path: string; content: string }[] = [
        { path: `concepts/${kebab}.stub.derived`, content: derivedSpec },
      ];

      { let p = createProgram(); p = complete(p, 'ok', { files, filesGenerated: files.length }); return p; }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      { let p = createProgram(); p = complete(p, 'error', { message, ...(stack ? { stack } : {}) }); return p; }
    }
  },

  preview(input: Record<string, unknown>) {
    const result = await derivedScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    { let p = createProgram(); p = complete(p, 'ok', { files,
      wouldWrite: files.length,
      wouldSkip: 0 }); return p; }
  },
};

export const derivedScaffoldGenHandler = autoInterpret(_handler);
