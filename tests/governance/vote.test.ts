// ============================================================
// Vote Concept Conformance Tests
//
// Tests for session-based voting: open session, cast votes,
// close session, and tally results.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { voteHandler } from '../../handlers/ts/app/governance/vote.handler.js';

describe('Vote Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('openSession', () => {
    it('opens a new voting session', async () => {
      const result = await voteHandler.openSession(
        { proposalRef: 'prop-1', deadline: '2026-12-31', snapshotRef: 'latest' },
        storage,
      );
      expect(result.variant).toBe('opened');
      expect(result.session).toBeTruthy();
    });
  });

  describe('castVote', () => {
    it('records a vote in an open session', async () => {
      const { session } = await voteHandler.openSession(
        { proposalRef: 'prop-1', deadline: '2026-12-31', snapshotRef: 'latest' },
        storage,
      );
      const result = await voteHandler.castVote(
        { session, voter: 'alice', choice: 'yes', weight: 1 },
        storage,
      );
      expect(result.variant).toBe('cast');
    });

    it('prevents duplicate votes from same voter', async () => {
      const { session } = await voteHandler.openSession(
        { proposalRef: 'prop-1', deadline: '2026-12-31', snapshotRef: 'latest' },
        storage,
      );
      await voteHandler.castVote({ session, voter: 'alice', choice: 'yes', weight: 1 }, storage);
      const dup = await voteHandler.castVote({ session, voter: 'alice', choice: 'no', weight: 1 }, storage);
      expect(dup.variant).toBe('already_voted');
    });
  });

  describe('close + tally', () => {
    it('tallies votes and returns the outcome', async () => {
      const { session } = await voteHandler.openSession(
        { proposalRef: 'prop-1', deadline: '2026-12-31', snapshotRef: 'latest' },
        storage,
      );
      await voteHandler.castVote({ session, voter: 'alice', choice: 'yes', weight: 3 }, storage);
      await voteHandler.castVote({ session, voter: 'bob', choice: 'no', weight: 1 }, storage);
      await voteHandler.castVote({ session, voter: 'charlie', choice: 'yes', weight: 2 }, storage);
      await voteHandler.close({ session }, storage);

      const tally = await voteHandler.tally({ session }, storage);
      expect(tally.variant).toBe('result');
      expect(tally.outcome).toBe('yes');
    });
  });
});
