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

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `action-guide-${++idCounter}`;
}

const SUPPORTED_FORMATS = ['skill-md', 'cli-help', 'rest-guide', 'generic'];

export const actionGuideHandler: ConceptHandler = {
  async define(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;
    const steps = input.steps as string[];
    const content = input.content as string;

    if (!Array.isArray(steps) || steps.length === 0) {
      return { variant: 'emptySteps' };
    }

    // Parse steps into structured objects
    const parsedSteps = steps.map((action, index) => ({
      action,
      title: action,
      prose: '',
      order: index,
    }));

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('action-guide', id, {
      id,
      concept,
      steps: JSON.stringify(parsedSteps),
      content,
      createdAt: now,
    });

    return { variant: 'ok', workflow: id, stepCount: parsedSteps.length };
  },

  async render(input: Record<string, unknown>, storage: ConceptStorage) {
    const workflow = input.workflow as string;
    const format = input.format as string;

    if (!SUPPORTED_FORMATS.includes(format)) {
      return { variant: 'unknownFormat', format };
    }

    const record = await storage.get('action-guide', workflow);
    if (!record) {
      return { variant: 'unknownFormat', format: `Workflow '${workflow}' not found` };
    }

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

    const sections: string[] = [];

    // Render steps section
    if (format === 'skill-md') {
      sections.push(`# Action Guide: ${record.concept}`);
      sections.push('');
      sections.push('## Steps');
      for (const step of steps) {
        sections.push(`${step.order + 1}. **${step.title}** — \`${step.action}\``);
        if (step.prose) {
          sections.push(`   ${step.prose}`);
        }
      }
    } else if (format === 'cli-help') {
      sections.push(`Action Guide: ${record.concept}`);
      sections.push('');
      sections.push('Steps:');
      for (const step of steps) {
        sections.push(`  ${step.order + 1}. ${step.title} (${step.action})`);
      }
    } else if (format === 'rest-guide') {
      sections.push(`# ${record.concept} REST Guide`);
      sections.push('');
      for (const step of steps) {
        sections.push(`## ${step.order + 1}. ${step.title}`);
        sections.push(`Endpoint action: \`${step.action}\``);
      }
    } else {
      // generic
      sections.push(`Action Guide: ${record.concept}`);
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

    const rendered = sections.join('\n');
    return { variant: 'ok', content: rendered };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetActionGuideCounter(): void {
  idCounter = 0;
}
