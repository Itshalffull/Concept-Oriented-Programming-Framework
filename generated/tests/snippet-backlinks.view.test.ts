// generated/tests/snippet-backlinks.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\snippet-backlinks.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: snippet-backlinks', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "snippet-backlinks-dataSource", {"name":"snippet-backlinks-dataSource","kind":"concept-action","config":"{\"concept\":\"Reference\",\"action\":\"getRefs\",\"params\":{\"source\":\"{{entityId}}\"}}"});
    await storage.put("presentation", "snippet-backlinks-presentation", {"name":"snippet-backlinks-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "snippet-backlinks-sort", {"name":"snippet-backlinks-sort","keys":"[]"});
    await storage.put("projection", "snippet-backlinks-projection", {"name":"snippet-backlinks-projection","fields":"[]"});
    await storage.put('view', "snippet-backlinks", {"name":"snippet-backlinks","title":"snippet-backlinks","description":"","dataSource":"snippet-backlinks-dataSource","filter":"","sort":"snippet-backlinks-sort","group":"","projection":"snippet-backlinks-projection","presentation":"snippet-backlinks-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("snippet-backlinks", storage);
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
