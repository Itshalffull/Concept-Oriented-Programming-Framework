// generated: FormalProperty/ConformanceTests.swift

import XCTest
@testable import Clef

final class FormalPropertyConformanceTests: XCTestCase {

    func testFormalPropertyInvariant1() async throws {
        // invariant 1: after define, check, coverage behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let p = "u-test-invariant-001"

        // --- AFTER clause ---
        // define(target_symbol: "clef/concept/Password", kind: "invariant", property_text: "forall p: Password | len(p.hash) > 0", formal_language: "smtlib", scope: "local", priority: "required") -> ok(property: p)
        let step1 = try await handler.define(
            input: FormalPropertyDefineInput(target_symbol: "clef/concept/Password", kind: "invariant", property_text: "forall p: Password | len(p.hash) > 0", formal_language: "smtlib", scope: "local", priority: "required"),
            storage: storage
        )
        if case .ok(let property) = step1 {
            XCTAssertEqual(property, p)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // check(property: p, solver: "z3", timeout_ms: 5000) -> ok(property: p, status: "proved")
        let step2 = try await handler.check(
            input: FormalPropertyCheckInput(property: p, solver: "z3", timeout_ms: 5000),
            storage: storage
        )
        if case .ok(let property, let status) = step2 {
            XCTAssertEqual(property, p)
            XCTAssertEqual(status, "proved")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // coverage(target_symbol: "clef/concept/Password") -> ok(total: 1, proved: 1, refuted: 0, unknown: 0, timeout: 0, coverage_pct: 100)
        let step3 = try await handler.coverage(
            input: FormalPropertyCoverageInput(target_symbol: "clef/concept/Password"),
            storage: storage
        )
        if case .ok(let total, let proved, let refuted, let unknown, let timeout, let coverage_pct) = step3 {
            XCTAssertEqual(total, 1)
            XCTAssertEqual(proved, 1)
            XCTAssertEqual(refuted, 0)
            XCTAssertEqual(unknown, 0)
            XCTAssertEqual(timeout, 0)
            XCTAssertEqual(coverage_pct, 100)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}