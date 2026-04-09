// generated/tests/process-chat.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-chat.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-chat', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-chat-dataSource", {"name":"process-chat-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessConversation\",\"action\":\"list\",\"params\":{\"run_ref\":\"{{runId}}\"}}"});
    await storage.put("presentation", "process-chat-presentation", {"name":"process-chat-presentation","displayType":"table","hints":"{}"});
    await storage.put("interaction", "process-chat-interaction", {"name":"process-chat-interaction","rowActions":"[{\"key\":\"send\",\"concept\":\"ProcessConversation\",\"action\":\"send\",\"label\":\"Send\"}]"});
    await storage.put("sort", "process-chat-sort", {"name":"process-chat-sort","keys":"[]"});
    await storage.put("pagination", "process-chat-pagination", {"name":"process-chat-pagination","mode":"offset","pageSize":"25"});
    await storage.put('view', "process-chat", {"name":"process-chat","title":"process-chat","description":"","dataSource":"process-chat-dataSource","filter":"","sort":"process-chat-sort","group":"","projection":"","presentation":"process-chat-presentation","interaction":"process-chat-interaction","features":"[\"interaction\",\"sort\",\"pagination\"]","pagination":"process-chat-pagination"});
    analysis = await compileAndAnalyze("process-chat", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: has pagination", () => {
    expect(analysis.enabledFeatures).toContain("pagination");
  });

  it("always: invokes only ProcessConversation actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ProcessConversation/")).toBe(true);
    }
  });
  });
});
