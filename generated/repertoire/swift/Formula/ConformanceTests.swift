// generated: Formula/ConformanceTests.swift

import XCTest
@testable import COPF

final class FormulaConformanceTests: XCTestCase {

    func testFormulaInvariant1() async throws {
        // invariant 1: after create, evaluate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(formula: f, expression: "price * quantity") -> ok()
        let step1 = try await handler.create(
            input: FormulaCreateInput(formula: f, expression: "price * quantity"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // evaluate(formula: f) -> ok(result: "computed")
        let step2 = try await handler.evaluate(
            input: FormulaEvaluateInput(formula: f),
            storage: storage
        )
        if case .ok(let result) = step2 {
            XCTAssertEqual(result, "computed")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
