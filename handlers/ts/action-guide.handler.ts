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
  createProgram, get, put, branch, complete, completeFrom,
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

const _actionGuideHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const steps = input.steps as string[];
    const content = input.content as string;

    if (!Array.isArray(steps) || steps.length === 0) {
      const p = createProgram();
      return complete(p, 'emptySteps', {}) as StorageProgram<Result>;
    }

    const parsedSteps = steps.map((action, index) => ({
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

    return complete(p, 'ok', { workflow: id, stepCount: parsedSteps.length }) as StorageProgram<Result>;
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

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
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
        }) as StorageProgram<Result>;
      },
      (b) => {
        return complete(b, 'unknownFormat', { format: `Workflow '${workflow}' not found` }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },
};

export const actionGuideHandler = autoInterpret(_actionGuideHandler);

/** Reset the ID counter. Useful for testing. */
export function resetActionGuideCounter(): void {
  idCounter = 0;
}
