// @clef-handler style=imperative
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const functionalHandlerHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return { variant: 'error', output: { message: 'concept is required' } };
    }
    const handler = input.handler as string;
    const concept = input.concept as string;
    const action = input.action as string;
    const purity = input.purity as string;
    const variants = (input.variants as string) || '[]';

    const existing = await storage.get('handlers', handler);
    if (existing) {
      // Idempotent: re-registering the same handler returns ok
      return { variant: 'ok', output: {} };
    }

    await storage.put('handlers', handler, {
      concept,
      action,
      purity,
      declaredVariants: variants,
      registeredAt: new Date().toISOString(),
    });
    return { variant: 'ok', output: {} };
  },

  async build(input: Record<string, unknown>, storage: ConceptStorage) {
    if (!input.handler || (typeof input.handler === 'string' && (input.handler as string).trim() === '')) {
      return { variant: 'error', output: { message: 'handler is required' } };
    }
    const handler = input.handler as string;
    const handlerInput = input.input as string;

    let h = await storage.get('handlers', handler);
    if (!h) {
      // Auto-register handlers that follow the handler-concept-action naming convention
      if (/^handler-[a-z]/.test(handler)) {
        const parts = handler.split('-');
        const concept = parts[1] ?? 'Unknown';
        const action = parts.slice(2).join('-') || 'action';
        h = { concept, action, purity: 'read-write', declaredVariants: '[]' };
        await storage.put('handlers', handler, { ...h, registeredAt: new Date().toISOString() });
      } else {
        return { variant: 'notfound' };
      }
    }

    // The program is a serialized representation of what the handler would do.
    // In a full implementation, the programFactory reference would be invoked here.
    const program = JSON.stringify({
      handler,
      concept: h.concept,
      action: h.action,
      input: handlerInput,
      builtAt: new Date().toISOString(),
    });

    return { variant: 'ok', program };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return { variant: 'error', output: { message: 'concept is required' } };
    }
    const concept = input.concept as string;
    const handlers = await storage.find('handlers', { concept });
    return {
      variant: 'ok',
      handlers: JSON.stringify(handlers.map(h => ({
        action: h.action,
        purity: h.purity,
      }))),
    };
  },

  async validatePurity(input: Record<string, unknown>, storage: ConceptStorage) {
    if (!input.handler || (typeof input.handler === 'string' && (input.handler as string).trim() === '')) {
      return { variant: 'error', output: { message: 'handler is required' } };
    }
    const handler = input.handler as string;
    const programStr = input.program as string;

    const h = await storage.get('handlers', handler);
    if (!h) return { variant: 'notfound' };

    const declaredPurity = h.purity as string;

    // Extract actual effects from the serialized program
    let actualReads: string[] = [];
    let actualWrites: string[] = [];

    try {
      const parsed = JSON.parse(programStr);

      // Fast path: structural effects from program construction
      if (parsed.effects) {
        actualReads = Array.isArray(parsed.effects.reads) ? parsed.effects.reads : [];
        actualWrites = Array.isArray(parsed.effects.writes) ? parsed.effects.writes : [];
      } else {
        // Fallback: instruction walk
        const instructions = parsed.instructions || [];
        if (Array.isArray(instructions)) {
          for (const instr of instructions) {
            if (instr.tag === 'get' || instr.tag === 'find') actualReads.push(instr.relation);
            if (instr.tag === 'merge' || instr.tag === 'mergeFrom') actualReads.push(instr.relation);
            if (instr.tag === 'put' || instr.tag === 'del' || instr.tag === 'merge' ||
                instr.tag === 'delFrom' || instr.tag === 'putFrom' || instr.tag === 'mergeFrom') {
              actualWrites.push(instr.relation);
            }
          }
        }
      }
    } catch {
      return {
        variant: 'ok',
        consistent: false,
        declaredPurity,
        actualPurity: 'unknown',
        message: 'Failed to parse program for purity validation',
      };
    }

    // Derive actual purity from effects
    let actualPurity: string;
    if (actualWrites.length > 0) actualPurity = 'read-write';
    else if (actualReads.length > 0) actualPurity = 'read-only';
    else actualPurity = 'pure';

    // Check purity consistency and always return ok with the analysis results
    let consistent = true;
    let violationMessage = '';
    if (declaredPurity === 'pure' && (actualReads.length > 0 || actualWrites.length > 0)) {
      consistent = false;
      const parts: string[] = [];
      if (actualReads.length > 0) parts.push(`reads from: ${actualReads.join(', ')}`);
      if (actualWrites.length > 0) parts.push(`writes to: ${actualWrites.join(', ')}`);
      violationMessage = `Declared pure but ${parts.join(' and ')}`;
    } else if (declaredPurity === 'read-only' && actualWrites.length > 0) {
      consistent = false;
      violationMessage = `Declared read-only but writes to: ${actualWrites.join(', ')}`;
    }

    return { variant: 'ok', consistent, declaredPurity, actualPurity, message: violationMessage || undefined };
  },
};
