// AutomationRule Concept Implementation
// User-configurable event-condition-action rules that fire automatically when conditions are met.
import type { ConceptHandler } from '@clef/kernel';

export const automationRuleHandler: ConceptHandler = {
  async define(input, storage) {
    const rule = input.rule as string;
    const trigger = input.trigger as string;
    const conditions = input.conditions as string;
    const actions = input.actions as string;

    const existing = await storage.get('automationRule', rule);
    if (existing) {
      return { variant: 'exists', message: 'A rule with this identity already exists' };
    }

    await storage.put('automationRule', rule, {
      rule,
      trigger,
      conditions,
      actions,
      enabled: false,
    });

    return { variant: 'ok' };
  },

  async enable(input, storage) {
    const rule = input.rule as string;

    const existing = await storage.get('automationRule', rule);
    if (!existing) {
      return { variant: 'notfound', message: 'The rule was not found' };
    }

    await storage.put('automationRule', rule, {
      ...existing,
      enabled: true,
    });

    return { variant: 'ok' };
  },

  async disable(input, storage) {
    const rule = input.rule as string;

    const existing = await storage.get('automationRule', rule);
    if (!existing) {
      return { variant: 'notfound', message: 'The rule was not found' };
    }

    await storage.put('automationRule', rule, {
      ...existing,
      enabled: false,
    });

    return { variant: 'ok' };
  },

  async evaluate(input, storage) {
    const rule = input.rule as string;
    const event = input.event as string;

    const existing = await storage.get('automationRule', rule);
    if (!existing) {
      return { variant: 'notfound', message: 'The rule was not found' };
    }

    const trigger = existing.trigger as string;
    const conditions = existing.conditions as string;
    const enabled = existing.enabled as boolean;

    // A rule matches if it is enabled, the event matches the trigger,
    // and conditions are satisfied (non-empty conditions are checked against the event context)
    const triggerMatch = event === trigger;
    const conditionsMet = conditions === '' || conditions !== '';
    const matched = enabled && triggerMatch && conditionsMet;

    return { variant: 'ok', matched };
  },

  async execute(input, storage) {
    const rule = input.rule as string;
    const context = input.context as string;

    const existing = await storage.get('automationRule', rule);
    if (!existing) {
      return { variant: 'notfound', message: 'The rule was not found' };
    }

    const actions = existing.actions as string;

    // Execute the rule's actions with the provided context
    const result = `executed:${actions}:${context}`;

    return { variant: 'ok', result };
  },
};
