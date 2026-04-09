// generated/tests/unlinked-references.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\unlinked-references.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: unlinked-references', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "unlinked-references-dataSource", {"name":"unlinked-references-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "unlinked-references-presentation", {"name":"unlinked-references-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "unlinked-references-sort", {"name":"unlinked-references-sort","keys":"[]"});
    await storage.put("projection", "unlinked-references-projection", {"name":"unlinked-references-projection","fields":"[]"});
    await storage.put('view', "unlinked-references", {"name":"unlinked-references","title":"unlinked-references","description":"","dataSource":"unlinked-references-dataSource","filter":"","sort":"unlinked-references-sort","group":"","projection":"unlinked-references-projection","presentation":"unlinked-references-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("unlinked-references", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
