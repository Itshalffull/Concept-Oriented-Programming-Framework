// generated: ActionLog/ConformanceTests.swift

import XCTest
@testable import Clef

final class ActionLogConformanceTests: XCTestCase {

    func testActionLogInvariant1() async throws {
        // invariant 1: after append, query behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"
        let recs = "u-test-invariant-002"

        // --- AFTER clause ---
        // append(record: ["flow": "f1", "concept": "Echo", "action": "send", "type": "completion", "variant": "ok"]) -> ok(id: r)
        let step1 = try await handler.append(
            input: ActionLogAppendInput(record: ["flow": "f1", "concept": "Echo", "action": "send", "type": "completion", "variant": "ok"]),
            storage: storage
        )
        if case .ok(let id) = step1 {
            XCTAssertEqual(id, r)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // query(flow: "f1") -> ok(records: recs)
        let step2 = try await handler.query(
            input: ActionLogQueryInput(flow: "f1"),
            storage: storage
        )
        if case .ok(let records) = step2 {
            XCTAssertEqual(records, recs)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
