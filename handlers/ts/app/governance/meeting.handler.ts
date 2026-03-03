// Meeting Concept Handler
// Synchronous governance meetings following Roberts Rules of Order.
import type { ConceptHandler } from '@clef/runtime';

export const meetingHandler: ConceptHandler = {
  async schedule(input, storage) {
    const id = `meeting-${Date.now()}`;
    await storage.put('meeting', id, {
      id, title: input.title, scheduledAt: input.scheduledAt,
      circle: input.circle ?? null, status: 'Scheduled', agenda: [], minutes: [],
    });
    return { variant: 'scheduled', meeting: id };
  },

  async callToOrder(input, storage) {
    const { meeting, chair } = input;
    const record = await storage.get('meeting', meeting as string);
    if (!record) return { variant: 'not_found', meeting };
    await storage.put('meeting', meeting as string, { ...record, status: 'InSession', chair, startedAt: new Date().toISOString() });
    return { variant: 'called_to_order', meeting };
  },

  async makeMotion(input, storage) {
    const { meeting, mover, motion } = input;
    const id = `motion-${Date.now()}`;
    await storage.put('motion', id, { id, meeting, mover, motion, status: 'Moved', movedAt: new Date().toISOString() });
    return { variant: 'motion_made', motion: id };
  },

  async secondMotion(input, storage) {
    const { motion, seconder } = input;
    const record = await storage.get('motion', motion as string);
    if (!record) return { variant: 'not_found', motion };
    await storage.put('motion', motion as string, { ...record, status: 'Seconded', seconder });
    return { variant: 'seconded', motion };
  },

  async callQuestion(input, storage) {
    const { motion } = input;
    const record = await storage.get('motion', motion as string);
    if (!record) return { variant: 'not_found', motion };
    await storage.put('motion', motion as string, { ...record, status: 'Voting' });
    return { variant: 'question_called', motion };
  },

  async recordMinute(input, storage) {
    const { meeting, content, recordedBy } = input;
    const record = await storage.get('meeting', meeting as string);
    if (!record) return { variant: 'not_found', meeting };
    const minutes = record.minutes as unknown[];
    minutes.push({ content, recordedBy, recordedAt: new Date().toISOString() });
    await storage.put('meeting', meeting as string, { ...record, minutes });
    return { variant: 'recorded', meeting };
  },

  async adjourn(input, storage) {
    const { meeting } = input;
    const record = await storage.get('meeting', meeting as string);
    if (!record) return { variant: 'not_found', meeting };
    await storage.put('meeting', meeting as string, { ...record, status: 'Adjourned', adjournedAt: new Date().toISOString() });
    return { variant: 'adjourned', meeting };
  },
};
