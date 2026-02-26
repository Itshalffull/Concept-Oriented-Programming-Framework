// generated: Notification/ConformanceTests.swift

import XCTest
@testable import Clef

final class NotificationConformanceTests: XCTestCase {

    func testNotificationInvariant1() async throws {
        // invariant 1: after registerChannel, defineTemplate, subscribe, notify, getUnread behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let cfg = "u-test-invariant-002"
        let n = "u-test-invariant-003"
        let t = "u-test-invariant-004"
        let u = "u-test-invariant-005"
        let e = "u-test-invariant-006"
        let d = "u-test-invariant-007"

        // --- AFTER clause ---
        // registerChannel(name: c, config: cfg) -> ok()
        let step1 = try await handler.registerChannel(
            input: NotificationRegisterChannelInput(name: c, config: cfg),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // defineTemplate(notification: n, template: t) -> ok()
        let step2 = try await handler.defineTemplate(
            input: NotificationDefineTemplateInput(notification: n, template: t),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // subscribe(user: u, eventType: e, channel: c) -> ok()
        let step3 = try await handler.subscribe(
            input: NotificationSubscribeInput(user: u, eventType: e, channel: c),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
        // notify(notification: n, user: u, template: t, data: d) -> ok()
        let step4 = try await handler.notify(
            input: NotificationNotifyInput(notification: n, user: u, template: t, data: d),
            storage: storage
        )
        guard case .ok = step4 else {
            XCTFail("Expected .ok, got \(step4)")
            return
        }
        // getUnread(user: u) -> ok(notifications: n)
        let step5 = try await handler.getUnread(
            input: NotificationGetUnreadInput(user: u),
            storage: storage
        )
        if case .ok(let notifications) = step5 {
            XCTAssertEqual(notifications, n)
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    func testNotificationInvariant2() async throws {
        // invariant 2: after notify, markRead, getUnread behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let n = "u-test-invariant-001"
        let u = "u-test-invariant-002"
        let t = "u-test-invariant-003"
        let d = "u-test-invariant-004"

        // --- AFTER clause ---
        // notify(notification: n, user: u, template: t, data: d) -> ok()
        let step1 = try await handler.notify(
            input: NotificationNotifyInput(notification: n, user: u, template: t, data: d),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // markRead(notification: n) -> ok()
        let step2 = try await handler.markRead(
            input: NotificationMarkReadInput(notification: n),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // getUnread(user: u) -> ok(notifications: _)
        let step3 = try await handler.getUnread(
            input: NotificationGetUnreadInput(user: u),
            storage: storage
        )
        if case .ok(let notifications) = step3 {
            XCTAssertEqual(notifications, _)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
