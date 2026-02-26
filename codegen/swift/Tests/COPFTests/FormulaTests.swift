// FormulaTests.swift — Tests for Formula concept

import XCTest
@testable import COPF

final class FormulaTests: XCTestCase {

    // MARK: - setExpression

    func testSetExpression() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        let result = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "prop(\"price\") * 1.1"),
            storage: storage
        )

        if case .ok(let formulaId) = result {
            XCTAssertEqual(formulaId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetExpressionStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "A + B"),
            storage: storage
        )

        let record = try await storage.get(relation: "formula", key: "f1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["expression"] as? String, "A + B")
    }

    func testSetExpressionOverwritesPrevious() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "A + B"),
            storage: storage
        )
        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "A * B"),
            storage: storage
        )

        let record = try await storage.get(relation: "formula", key: "f1")
        XCTAssertEqual(record?["expression"] as? String, "A * B")
    }

    // MARK: - evaluate

    func testEvaluate() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "A + B"),
            storage: storage
        )

        let result = try await handler.evaluate(
            input: FormulaEvaluateInput(formulaId: "f1", context: "{\"A\":1,\"B\":2}"),
            storage: storage
        )

        if case .ok(let formulaId, let resultStr) = result {
            XCTAssertEqual(formulaId, "f1")
            XCTAssertTrue(resultStr.contains("A + B"))
            XCTAssertTrue(resultStr.contains("context="))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateFormulaNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        let result = try await handler.evaluate(
            input: FormulaEvaluateInput(formulaId: "nonexistent", context: "{}"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getDependencies

    func testGetDependencies() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        // Manually set up a formula with dependencies
        try await storage.put(
            relation: "formula",
            key: "f1",
            value: [
                "formulaId": "f1",
                "expression": "A + B",
                "dependencies": "[\"A\",\"B\"]",
            ]
        )

        let result = try await handler.getDependencies(
            input: FormulaGetDependenciesInput(formulaId: "f1"),
            storage: storage
        )

        if case .ok(let formulaId, let dependencies) = result {
            XCTAssertEqual(formulaId, "f1")
            XCTAssertTrue(dependencies.contains("A"))
            XCTAssertTrue(dependencies.contains("B"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetDependenciesNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        let result = try await handler.getDependencies(
            input: FormulaGetDependenciesInput(formulaId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testGetDependenciesDefaultEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "42"),
            storage: storage
        )

        let result = try await handler.getDependencies(
            input: FormulaGetDependenciesInput(formulaId: "f1"),
            storage: storage
        )

        if case .ok(_, let dependencies) = result {
            XCTAssertEqual(dependencies, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - invalidate

    func testInvalidate() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        _ = try await handler.setExpression(
            input: FormulaSetExpressionInput(formulaId: "f1", expression: "X + Y"),
            storage: storage
        )

        let result = try await handler.invalidate(
            input: FormulaInvalidateInput(formulaId: "f1"),
            storage: storage
        )

        if case .ok(let formulaId) = result {
            XCTAssertEqual(formulaId, "f1")
            let record = try await storage.get(relation: "formula", key: "f1")
            XCTAssertEqual(record?["cached"] as? Bool, false)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testInvalidateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FormulaHandlerImpl()

        let result = try await handler.invalidate(
            input: FormulaInvalidateInput(formulaId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
