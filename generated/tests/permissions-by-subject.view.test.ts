// generated/tests/permissions-by-subject.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\permissions-by-subject.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: permissions-by-subject', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "permissions-by-subject-dataSource", {"name":"permissions-by-subject-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "permissions-by-subject-presentation", {"name":"permissions-by-subject-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "permissions-by-subject-filter", {"name":"permissions-by-subject-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "permissions-by-subject-sort", {"name":"permissions-by-subject-sort","keys":"[]"});
    await storage.put("projection", "permissions-by-subject-projection", {"name":"permissions-by-subject-projection","fields":"[]"});
    await storage.put('view', "permissions-by-subject", {"name":"permissions-by-subject","title":"permissions-by-subject","description":"","dataSource":"permissions-by-subject-dataSource","filter":"permissions-by-subject-filter","sort":"permissions-by-subject-sort","group":"","projection":"permissions-by-subject-projection","presentation":"permissions-by-subject-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("permissions-by-subject", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
