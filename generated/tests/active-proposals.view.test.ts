// generated/tests/active-proposals.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\active-proposals.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: active-proposals', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    // TODO: Seed storage with ViewShell + child specs
    // In a real pipeline, this would load from the project's spec files
    analysis = await compileAndAnalyze("active-proposals", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ContentNode actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ContentNode/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
