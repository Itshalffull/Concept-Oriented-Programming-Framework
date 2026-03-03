// generated: SolverProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class SolverProviderConformanceTests: XCTestCase {

    func testSolverProviderInvariant1() async throws {
        // invariant 1: after register, dispatch behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let p = "u-test-invariant-001"
        let r = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(provider_id: "z3", supported_languages: ["smtlib"], supported_kinds: ["invariant", "precondition", "postcondition", "safety"], capabilities: ["smt", "quantifiers", "theories"], priority: 1) -> ok(provider: p)
        let step1 = try await handler.register(
            input: SolverProviderRegisterInput(provider_id: "z3", supported_languages: ["smtlib"], supported_kinds: ["invariant", "precondition", "postcondition", "safety"], capabilities: ["smt", "quantifiers", "theories"], priority: 1),
            storage: storage
        )
        if case .ok(let provider) = step1 {
            XCTAssertEqual(provider, p)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // dispatch(property_ref: "prop-1", formal_language: "smtlib", kind: "invariant", timeout_ms: 5000) -> ok(provider: p, run_ref: r)
        let step2 = try await handler.dispatch(
            input: SolverProviderDispatchInput(property_ref: "prop-1", formal_language: "smtlib", kind: "invariant", timeout_ms: 5000),
            storage: storage
        )
        if case .ok(let provider, let run_ref) = step2 {
            XCTAssertEqual(provider, p)
            XCTAssertEqual(run_ref, r)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}