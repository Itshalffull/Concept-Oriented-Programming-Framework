// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, branch, put, pure, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/**
 * A11yAuditProvider — functional handler.
 *
 * Analyzes RenderProgram instructions for accessibility gaps:
 * missing ARIA roles on interactive parts, missing labels, keyboard
 * navigation gaps, and focus management issues.
 */

type RenderInstruction = { tag: string; [key: string]: unknown };

function analyzeA11y(instructions: RenderInstruction[], parts: string[]): { findings: string[]; passed: boolean } {
  const findings: string[] = [];

  // Collect declared elements and their roles
  const partRoles = new Map<string, string>();
  const ariaAttrs = new Map<string, Map<string, string>>();
  const keyboardMappings: string[] = [];
  let hasFocusConfig = false;

  for (const instr of instructions) {
    switch (instr.tag) {
      case 'element':
        partRoles.set(instr.part as string, instr.role as string);
        break;
      case 'aria':
        if (!ariaAttrs.has(instr.part as string)) {
          ariaAttrs.set(instr.part as string, new Map());
        }
        ariaAttrs.get(instr.part as string)!.set(instr.attr as string, instr.value as string);
        break;
      case 'keyboard':
        keyboardMappings.push(instr.key as string);
        break;
      case 'focus':
        hasFocusConfig = true;
        break;
    }
  }

  // Check: interactive parts need ARIA role
  for (const [part, role] of partRoles) {
    if ((role === 'interactive' || role === 'action') && !ariaAttrs.has(part)) {
      findings.push(`Interactive part "${part}" has no ARIA attributes`);
    }
  }

  // Check: parts with visible text need labels
  for (const part of parts) {
    const hasLabel = ariaAttrs.get(part)?.has('label') || ariaAttrs.get(part)?.has('labelledby');
    const isContainer = partRoles.get(part) === 'container';
    const isPresentation = partRoles.get(part) === 'presentation';
    if (!hasLabel && !isContainer && !isPresentation && partRoles.has(part)) {
      findings.push(`Part "${part}" has no aria-label or aria-labelledby`);
    }
  }

  // Check: keyboard mappings for essential keys
  const essentialKeys = ['Enter', 'Escape', 'Tab'];
  const hasInteractive = [...partRoles.values()].some(r => r === 'interactive' || r === 'action');
  if (hasInteractive) {
    for (const key of essentialKeys) {
      if (!keyboardMappings.includes(key)) {
        findings.push(`Missing keyboard mapping for "${key}"`);
      }
    }
  }

  // Check: dialogs need focus trap
  const hasDialog = [...(ariaAttrs.values())].some(attrs => attrs.get('role') === 'dialog');
  if (hasDialog && !hasFocusConfig) {
    findings.push(`Dialog detected but no focus management configured`);
  }

  return { findings, passed: findings.length === 0 };
}

const _a11yAuditProviderHandler: FunctionalConceptHandler = {
  audit(input: Record<string, unknown>) {
    const audit = input.audit as string;
    const program = input.program as string;

    try {
      function extractList(val: unknown): unknown[] {
        if (Array.isArray(val)) return val as unknown[];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as Record<string, unknown>;
          if (obj.type === 'list' && Array.isArray(obj.items)) {
            return (obj.items as Array<Record<string, unknown>>).map((item) => {
              if (item && typeof item === 'object' && item.type === 'literal') return item.value;
              return item;
            });
          }
        }
        if (typeof val === 'string') return JSON.parse(val) as unknown[];
        return [];
      }

      let instructions: RenderInstruction[] = [];
      let parts: string[] = [];

      if (input.instructions) {
        const rawInstructions = extractList(input.instructions) as (string | RenderInstruction)[];
        instructions = rawInstructions.map((item) => {
          if (typeof item === 'string') {
            const p = item.split(':');
            return { tag: p[0] || '', part: p[1] || '', attr: p[2] || '', value: p[3] || '', key: p[1] || '', role: p[2] || '' } as RenderInstruction;
          }
          return item as RenderInstruction;
        });
      }
      if (input.parts) {
        parts = extractList(input.parts) as string[];
      }

      const { findings, passed } = analyzeA11y(instructions, parts);

      let p = createProgram();
      p = put(p, 'audits', audit, { program, findings, passed });
      return complete(p, 'ok', {
        audit,
        findings: JSON.stringify(findings),
        passed,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      return complete(createProgram(), 'error', {
        message: `A11y audit failed: ${(e as Error).message}`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  getFindings(input: Record<string, unknown>) {
    const audit = input.audit as string;

    let p = createProgram();
    p = get(p, 'audits', audit, 'auditResult');
    return branch(p, 'auditResult',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.auditResult as Record<string, unknown>;
        return {
          audit,
          findings: typeof data.findings === 'string' ? data.findings : JSON.stringify(data.findings || []),
          passed: data.passed,
        };
      }),
      (b) => complete(b, 'notfound', { audit, message: `audit not found: ${audit}` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const a11yAuditProviderHandler = autoInterpret(_a11yAuditProviderHandler);

