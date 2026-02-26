// generated: Intent/ConformanceTests.swift

import XCTest
@testable import COPF

final class IntentConformanceTests: XCTestCase {

    func testIntentInvariant1() async throws {
        // invariant 1: after define, verify behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let i = "u-test-invariant-001"
        let v = "u-test-invariant-002"
        let f = "u-test-invariant-003"

        // --- AFTER clause ---
        // define(intent: i, target: "UserAuth", purpose: "Authenticate users", operationalPrinciple: "After login, session is valid") -> ok(intent: i)
        let step1 = try await handler.define(
            input: IntentDefineInput(intent: i, target: "UserAuth", purpose: "Authenticate users", operationalPrinciple: "After login, session is valid"),
            storage: storage
        )
        if case .ok(let intent) = step1 {
            XCTAssertEqual(intent, i)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // verify(intent: i) -> ok(valid: v, failures: f)
        let step2 = try await handler.verify(
            input: IntentVerifyInput(intent: i),
            storage: storage
        )
        if case .ok(let valid, let failures) = step2 {
            XCTAssertEqual(valid, v)
            XCTAssertEqual(failures, f)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
