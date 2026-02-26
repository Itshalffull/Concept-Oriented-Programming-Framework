// generated: notification.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { notificationHandler } from "./notification.impl";

describe("Notification conformance", () => {

  it("invariant 1: after registerChannel, defineTemplate, subscribe, notify, getUnread behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";
    const cfg = "u-test-invariant-002";
    const n = "u-test-invariant-003";
    const t = "u-test-invariant-004";
    const u = "u-test-invariant-005";
    const e = "u-test-invariant-006";
    const d = "u-test-invariant-007";

    // --- AFTER clause ---
    // registerChannel(name: c, config: cfg) -> ok()
    const step1 = await notificationHandler.registerChannel(
      { name: c, config: cfg },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // defineTemplate(notification: n, template: t) -> ok()
    const step2 = await notificationHandler.defineTemplate(
      { notification: n, template: t },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // subscribe(user: u, eventType: e, channel: c) -> ok()
    const step3 = await notificationHandler.subscribe(
      { user: u, eventType: e, channel: c },
      storage,
    );
    expect(step3.variant).toBe("ok");
    // notify(notification: n, user: u, template: t, data: d) -> ok()
    const step4 = await notificationHandler.notify(
      { notification: n, user: u, template: t, data: d },
      storage,
    );
    expect(step4.variant).toBe("ok");
    // getUnread(user: u) -> ok(notifications: n)
    const step5 = await notificationHandler.getUnread(
      { user: u },
      storage,
    );
    expect(step5.variant).toBe("ok");
    expect((step5 as any).notifications).toBe(n);
  });

  it("invariant 2: after notify, markRead, getUnread behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-invariant-001";
    const u = "u-test-invariant-002";
    const t = "u-test-invariant-003";
    const d = "u-test-invariant-004";

    // --- AFTER clause ---
    // notify(notification: n, user: u, template: t, data: d) -> ok()
    const step1 = await notificationHandler.notify(
      { notification: n, user: u, template: t, data: d },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // markRead(notification: n) -> ok()
    const step2 = await notificationHandler.markRead(
      { notification: n },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // getUnread(user: u) -> ok(notifications: _)
    const step3 = await notificationHandler.getUnread(
      { user: u },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).notifications).toBeDefined();
  });

});
