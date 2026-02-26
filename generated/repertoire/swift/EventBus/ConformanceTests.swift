// generated: EventBus/ConformanceTests.swift

import XCTest
@testable import Clef

final class EventBusConformanceTests: XCTestCase {

    func testEventBusInvariant1() async throws {
        // invariant 1: after registerEventType, subscribe, dispatch behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let sid = "u-test-invariant-001"
        let e = "u-test-invariant-002"
        let r = "u-test-invariant-003"

        // --- AFTER clause ---
        // registerEventType(name: "user.login", schema: "{}") -> ok()
        let step1 = try await handler.registerEventType(
            input: EventBusRegisterEventTypeInput(name: "user.login", schema: "{}"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // subscribe(event: "user.login", handler: "logHandler", priority: 10) -> ok(subscriptionId: sid)
        let step2 = try await handler.subscribe(
            input: EventBusSubscribeInput(event: "user.login", handler: "logHandler", priority: 10),
            storage: storage
        )
        if case .ok(let subscriptionId) = step2 {
            XCTAssertEqual(subscriptionId, sid)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // dispatch(event: e, data: "{"user":"alice"}") -> ok(results: r)
        let step3 = try await handler.dispatch(
            input: EventBusDispatchInput(event: e, data: "{"user":"alice"}"),
            storage: storage
        )
        if case .ok(let results) = step3 {
            XCTAssertEqual(results, r)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
