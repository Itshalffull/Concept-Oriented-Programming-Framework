// Dispute Concept Handler
// Formal dispute resolution — @gate concept.
import type { ConceptHandler } from '@clef/runtime';

export const disputeHandler: ConceptHandler = {
  async open(input, storage) {
    const id = `dispute-${Date.now()}`;
    await storage.put('dispute', id, {
      id, challenger: input.challenger, respondent: input.respondent,
      subject: input.subject, evidence: [input.evidence], bond: input.bond,
      status: 'Open', openedAt: new Date().toISOString(),
    });
    return { variant: 'opened', dispute: id };
  },

  async submitEvidence(input, storage) {
    const { dispute, party, evidence } = input;
    const record = await storage.get('dispute', dispute as string);
    if (!record) return { variant: 'not_found', dispute };
    const evidenceList = record.evidence as unknown[];
    evidenceList.push({ party, evidence, submittedAt: new Date().toISOString() });
    await storage.put('dispute', dispute as string, { ...record, evidence: evidenceList, status: 'EvidencePhase' });
    return { variant: 'evidence_added', dispute };
  },

  async arbitrate(input, storage) {
    const { dispute, arbitrator, decision, reasoning } = input;
    const record = await storage.get('dispute', dispute as string);
    if (!record) return { variant: 'not_found', dispute };
    await storage.put('dispute', dispute as string, {
      ...record, status: 'Resolved', arbitrator, decision, reasoning,
      resolvedAt: new Date().toISOString(),
    });
    return { variant: 'resolved', dispute, decision };
  },

  async appeal(input, storage) {
    const { dispute, appellant, grounds } = input;
    const record = await storage.get('dispute', dispute as string);
    if (!record) return { variant: 'not_found', dispute };
    if (record.status !== 'Resolved') return { variant: 'not_resolved', dispute };
    await storage.put('dispute', dispute as string, { ...record, status: 'Appealed', appellant, appealGrounds: grounds });
    return { variant: 'appealed', dispute };
  },
};
