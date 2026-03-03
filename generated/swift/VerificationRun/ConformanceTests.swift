// generated: VerificationRun/ConformanceTests.swift

import XCTest
@testable import Clef

final class VerificationRunConformanceTests: XCTestCase {

    func testVerificationRunInvariant1() async throws {
        // invariant 1: after start, complete behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"
        let res = "u-test-invariant-002"
        let usage = "u-test-invariant-003"

        // --- AFTER clause ---
        // start(target_symbol: "clef/concept/Password", properties: ["p1", "p2"], solver: "z3", timeout_ms: 10000) -> ok(run: r)
        let step1 = try await handler.start(
            input: VerificationRunStartInput(target_symbol: "clef/concept/Password", properties: ["p1", "p2"], solver: "z3", timeout_ms: 10000),
            storage: storage
        )
        if case .ok(let run) = step1 {
            XCTAssertEqual(run, r)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // complete(run: r, results: res, resource_usage: usage) -> ok(run: r, proved: 2, refuted: 0, unknown: 0)
        let step2 = try await handler.complete(
            input: VerificationRunCompleteInput(run: r, results: res, resource_usage: usage),
            storage: storage
        )
        if case .ok(let run, let proved, let refuted, let unknown) = step2 {
            XCTAssertEqual(run, r)
            XCTAssertEqual(proved, 2)
            XCTAssertEqual(refuted, 0)
            XCTAssertEqual(unknown, 0)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}