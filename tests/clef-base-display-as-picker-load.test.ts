import { describe, expect, it, vi } from 'vitest';

vi.mock('../clef-base/lib/use-concept-query', () => ({
  useConceptQuery: () => ({
    data: { modes: '[]' },
    loading: false,
  }),
}));

import { DisplayAsPicker } from '../clef-base/app/components/widgets/DisplayAsPicker';

describe('DisplayAsPicker module load', () => {
  it('loads with the shared floating contract in place', () => {
    expect(typeof DisplayAsPicker).toBe('function');
  });
});
