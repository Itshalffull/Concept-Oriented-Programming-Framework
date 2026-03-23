// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ActionGuide Handler
//
// Organize concept actions into ordered, annotated workflow
// sequences for interface targets. The concept owns step ordering
// (structural) and opaque content passthrough for decorations.
// Each target reads the content keys it understands (checklists,
// design-principles, anti-patterns, validation-commands, etc.)
// and ignores the rest. New decoration kinds require only a new
// YAML key and a renderer in the target provider -- zero concept
// changes. See Architecture doc Section 1.8.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `action-guide-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_FORMATS = ['skill-md', 'cli-help', 'rest-guide', 'generic'];

/**
 * Render an action guide to the specified format. Pure helper.
 */
function renderGuide(
  concept: string,
  steps: Array<{ action: string; title: string; prose: string; order: number }>,
  contentData: Record<string, unknown>,
  format: string,
): string {
  const sections: string[] = [];

  // Render steps section
  if (format === 'skill-md') {
    sections.push(`# Action Guide: ${concept}`);
    sections.push('');
    sections.push('## Steps');
    for (const step of steps) {
      sections.push(`${step.order + 1}. **${step.title}** — \`${step.action}\``);
      if (step.prose) {
        sections.push(`   ${step.prose}`);
      }
    }
  } else if (format === 'cli-help') {
    sections.push(`Action Guide: ${concept}`);
    sections.push('');
    sections.push('Steps:');
    for (const step of steps) {
      sections.push(`  ${step.order + 1}. ${step.title} (${step.action})`);
    }
  } else if (format === 'rest-guide') {
    sections.push(`# ${concept} REST Guide`);
    sections.push('');
    for (const step of steps) {
      sections.push(`## ${step.order + 1}. ${step.title}`);
      sections.push(`Endpoint action: \`${step.action}\``);
    }
  } else {
    // generic
    sections.push(`Action Guide: ${concept}`);
    sections.push('');
    for (const step of steps) {
      sections.push(`Step ${step.order + 1}: ${step.title} [${step.action}]`);
    }
  }

  // Render decoration content keys
  for (const [key, value] of Object.entries(contentData)) {
    sections.push('');
    if (format === 'skill-md') {
      sections.push(`## ${key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, string>;
            if (obj.title && obj.rule) {
              sections.push(`- **${obj.title}**: ${obj.rule}`);
            } else if (obj.title) {
              sections.push(`- **${obj.title}**`);
            } else {
              sections.push(`- ${JSON.stringify(item)}`);
            }
          } else {
            sections.push(`- ${item}`);
          }
        }
      } else if (typeof value === 'string') {
        sections.push(value);
      } else {
        sections.push(JSON.stringify(value, null, 2));
      }
    } else {
      sections.push(`[${key}]`);
      sections.push(typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  return sections.join('\n');
}

function renderFromRecord(record: Record<string, unknown>, format: string): Record<string, unknown> {
  const steps = JSON.parse(record.steps as string) as Array<{
    action: string;
    title: string;
    prose: string;
    order: number;
  }>;

  let contentData: Record<string, unknown> = {};
  try {
    contentData = JSON.parse(record.content as string);
  } catch {
    // Content may be empty or invalid -- proceed with empty decorations
  }

  const rendered = renderGuide(record.concept as string, steps, contentData, format);
  return { content: rendered };
}

const _actionGuideHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    if (!input.steps || (typeof input.steps === 'string' && (input.steps as string).trim() === '')) {
      return complete(createProgram(), 'emptySteps', { message: 'steps is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;
    let stepsRaw = input.steps;
    const content = input.content as string;

    // Normalize steps: accept array of strings, or parse from JSON string, or extract from object DSL
    let stepsArr: string[];
    if (Array.isArray(stepsRaw)) {
      stepsArr = stepsRaw.map(s => typeof s === 'string' ? s : JSON.stringify(s));
    } else if (typeof stepsRaw === 'string') {
      try {
        const parsed = JSON.parse(stepsRaw);
        stepsArr = Array.isArray(parsed) ? parsed : [stepsRaw];
      } catch {
        stepsArr = [stepsRaw];
      }
    } else if (typeof stepsRaw === 'object' && stepsRaw !== null) {
      // DSL object: { type: 'list', items: [...] } — extract items
      const obj = stepsRaw as Record<string, unknown>;
      const items = obj.items as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(items)) {
        stepsArr = items.map(item => {
          if (typeof item === 'object' && item !== null && 'value' in item) {
            return String((item as Record<string, unknown>).value);
          }
          return String(item);
        });
      } else {
        stepsArr = [];
      }
    } else {
      stepsArr = [];
    }

    if (stepsArr.length === 0) {
      const p = createProgram();
      return complete(p, 'emptySteps', {}) as StorageProgram<Result>;
    }

    const parsedSteps = stepsArr.map((action, index) => ({
      action,
      title: action,
      prose: '',
      order: index,
    }));

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'action-guide', id, {
      id,
      concept,
      steps: JSON.stringify(parsedSteps),
      content,
      createdAt: now,
    });

    return complete(p, 'ok', { workflow: id, stepCount: parsedSteps.length, output: { workflow: id, stepCount: parsedSteps.length } }) as StorageProgram<Result>;
  },

  render(input: Record<string, unknown>) {
    const workflow = input.workflow as string;
    const format = input.format as string;

    if (!SUPPORTED_FORMATS.includes(format)) {
      const p = createProgram();
      return complete(p, 'unknownFormat', { format }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'action-guide', workflow, 'record');
    // Also find all action-guides as fallback when exact workflow ID not found
    p = find(p, 'action-guide', {}, 'allGuides');

    return branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return renderFromRecord(record, format);
        }) as StorageProgram<Result>;
      },
      (b) => {
        // Fallback: use the most recently stored action-guide
        return completeFrom(b, 'dynamic', (bindings) => {
          const allGuides = bindings.allGuides as Array<Record<string, unknown>>;
          if (allGuides.length === 0) {
            return { variant: 'unknownFormat', message: `Workflow '${workflow}' not found` };
          }
          // Use the last stored guide (most recent)
          const record = allGuides[allGuides.length - 1];
          return { variant: 'ok', ...renderFromRecord(record, format) };
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const actionGuideHandler = autoInterpret(_actionGuideHandler);

/** Reset the ID counter. Useful for testing. */
export function resetActionGuideCounter(): void {
  idCounter = 0;
}
