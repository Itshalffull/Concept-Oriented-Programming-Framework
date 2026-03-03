// ConsentProcess Counting Method Provider
// Sociocratic consent: Present → Clarify → React → Object → Integrate → Consent state machine.
import type { ConceptHandler } from '@clef/runtime';

const PHASES = ['Presenting', 'Clarifying', 'Reacting', 'Objecting', 'Integrating', 'Consented'] as const;
type Phase = typeof PHASES[number];

function nextPhase(current: Phase): Phase | null {
  const idx = PHASES.indexOf(current);
  return idx < PHASES.length - 1 ? PHASES[idx + 1] : null;
}

export const consentProcessHandler: ConceptHandler = {
  async openRound(input, storage) {
    const id = `consent-${Date.now()}`;
    await storage.put('consent', id, {
      id,
      proposal: input.proposal,
      facilitator: input.facilitator,
      phase: 'Presenting' as Phase,
      objections: '[]',
      reactions: '[]',
      amendments: '[]',
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'ConsentProcess',
      instanceId: id,
    });

    return { variant: 'opened', round: id };
  },

  async advancePhase(input, storage) {
    const { round } = input;
    const record = await storage.get('consent', round as string);
    if (!record) return { variant: 'not_found', round };

    const currentPhase = record.phase as Phase;

    // Cannot advance past Objecting if unresolved objections exist
    if (currentPhase === 'Objecting') {
      const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
      const unresolved = objections.filter(o => !o.resolved);
      if (unresolved.length > 0) {
        return { variant: 'unresolved_objections', round, count: unresolved.length };
      }
    }

    const next = nextPhase(currentPhase);
    if (!next) return { variant: 'already_final', round, phase: currentPhase };

    await storage.put('consent', round as string, { ...record, phase: next });
    return { variant: 'advanced', round, phase: next };
  },

  async raiseObjection(input, storage) {
    const { round, raiser, objection } = input;
    const record = await storage.get('consent', round as string);
    if (!record) return { variant: 'not_found', round };

    const phase = record.phase as Phase;
    if (phase !== 'Objecting' && phase !== 'Reacting') {
      return { variant: 'wrong_phase', round, phase };
    }

    const objections = JSON.parse(record.objections as string) as unknown[];
    const objId = `obj-${Date.now()}`;
    objections.push({ id: objId, raiser, text: objection, resolved: false });
    await storage.put('consent', round as string, {
      ...record,
      phase: 'Objecting',
      objections: JSON.stringify(objections),
    });

    return { variant: 'objection_raised', round, objectionId: objId };
  },

  async resolveObjection(input, storage) {
    const { round, objection, resolution } = input;
    const record = await storage.get('consent', round as string);
    if (!record) return { variant: 'not_found', round };

    const objections = JSON.parse(record.objections as string) as Array<{ id: string; resolved: boolean; resolution?: string }>;
    const target = objections.find(o => o.id === objection);
    if (!target) return { variant: 'objection_not_found', round, objection };

    target.resolved = true;
    target.resolution = resolution as string;

    const amendments = JSON.parse(record.amendments as string) as unknown[];
    amendments.push({ objectionId: objection, resolution, appliedAt: new Date().toISOString() });

    await storage.put('consent', round as string, {
      ...record,
      objections: JSON.stringify(objections),
      amendments: JSON.stringify(amendments),
    });

    return { variant: 'objection_resolved', round };
  },

  async finalize(input, storage) {
    const { round } = input;
    const record = await storage.get('consent', round as string);
    if (!record) return { variant: 'not_found', round };

    const objections = JSON.parse(record.objections as string) as Array<{ resolved: boolean }>;
    const unresolved = objections.filter(o => !o.resolved);
    if (unresolved.length > 0) {
      return { variant: 'unresolved_objections', round, count: unresolved.length };
    }

    await storage.put('consent', round as string, { ...record, phase: 'Consented' });
    return { variant: 'consented', round, amendments: record.amendments };
  },
};
