// generated: SpecificationSchema/ConformanceTests.swift

import XCTest
@testable import Clef

final class SpecificationSchemaConformanceTests: XCTestCase {

    func testSpecificationSchemaInvariant1() async throws {
        // invariant 1: after define, instantiate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let r = "u-test-invariant-002"

        // --- AFTER clause ---
        // define(name: "reentrancy-guard", category: "smart_contract", pattern_type: "absence", template_text: "always (call_depth(${function}) <= 1)", formal_language: "smtlib", parameters: [["name": "function", "type": "String", "description": "Function to guard"]]) -> ok(schema: s)
        let step1 = try await handler.define(
            input: SpecificationSchemaDefineInput(name: "reentrancy-guard", category: "smart_contract", pattern_type: "absence", template_text: "always (call_depth(${function}) <= 1)", formal_language: "smtlib", parameters: [["name": "function", "type": "String", "description": "Function to guard"]]),
            storage: storage
        )
        if case .ok(let schema) = step1 {
            XCTAssertEqual(schema, s)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // instantiate(schema: s, parameter_values: ["function": "transfer"], target_symbol: "clef/concept/Token") -> ok(property_ref: r)
        let step2 = try await handler.instantiate(
            input: SpecificationSchemaInstantiateInput(schema: s, parameter_values: ["function": "transfer"], target_symbol: "clef/concept/Token"),
            storage: storage
        )
        if case .ok(let property_ref) = step2 {
            XCTAssertEqual(property_ref, r)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}