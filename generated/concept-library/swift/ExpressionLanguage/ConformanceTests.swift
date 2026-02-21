// generated: ExpressionLanguage/ConformanceTests.swift

import XCTest
@testable import COPF

final class ExpressionLanguageConformanceTests: XCTestCase {

    func testExpressionLanguageInvariant1() async throws {
        // invariant 1: after registerLanguage, parse, evaluate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let e = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerLanguage(name: "math", grammar: "arithmetic") -> ok()
        let step1 = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(name: "math", grammar: "arithmetic"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // parse(expression: e, text: "2 + 3", language: "math") -> ok(ast: "add(2, 3)")
        let step2 = try await handler.parse(
            input: ExpressionLanguageParseInput(expression: e, text: "2 + 3", language: "math"),
            storage: storage
        )
        if case .ok(let ast) = step2 {
            XCTAssertEqual(ast, "add(2, 3)")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // evaluate(expression: e) -> ok(result: "5")
        let step3 = try await handler.evaluate(
            input: ExpressionLanguageEvaluateInput(expression: e),
            storage: storage
        )
        if case .ok(let result) = step3 {
            XCTAssertEqual(result, "5")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
