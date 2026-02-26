// ExpressionLanguageTests.swift — Tests for ExpressionLanguage concept

import XCTest
@testable import Clef

final class ExpressionLanguageTests: XCTestCase {

    // MARK: - registerLanguage

    func testRegisterLanguage() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "expr := term (('+' | '-') term)*"),
            storage: storage
        )

        if case .ok(let languageId) = result {
            XCTAssertEqual(languageId, "formula")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterLanguageStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "sql_like", grammar: "SELECT ... FROM ..."),
            storage: storage
        )

        let record = try await storage.get(relation: "language", key: "sql_like")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["grammar"] as? String, "SELECT ... FROM ...")
    }

    func testRegisterMultipleLanguages() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "g1"),
            storage: storage
        )
        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "filter", grammar: "g2"),
            storage: storage
        )

        let lang1 = try await storage.get(relation: "language", key: "formula")
        let lang2 = try await storage.get(relation: "language", key: "filter")
        XCTAssertNotNil(lang1)
        XCTAssertNotNil(lang2)
    }

    // MARK: - registerFunction

    func testRegisterFunction() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "g"),
            storage: storage
        )

        let result = try await handler.registerFunction(
            input: ExpressionLanguageRegisterFunctionInput(
                languageId: "formula",
                name: "sum",
                signature: "(numbers: [Number]) -> Number"
            ),
            storage: storage
        )

        if case .ok(let languageId, let name) = result {
            XCTAssertEqual(languageId, "formula")
            XCTAssertEqual(name, "sum")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterFunctionLanguageNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.registerFunction(
            input: ExpressionLanguageRegisterFunctionInput(
                languageId: "nonexistent",
                name: "sum",
                signature: "() -> Number"
            ),
            storage: storage
        )

        if case .langNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .langNotfound but got \(result)")
        }
    }

    func testRegisterFunctionStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "g"),
            storage: storage
        )

        _ = try await handler.registerFunction(
            input: ExpressionLanguageRegisterFunctionInput(
                languageId: "formula",
                name: "avg",
                signature: "([Number]) -> Number"
            ),
            storage: storage
        )

        let record = try await storage.get(relation: "function_registry", key: "formula:avg")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["name"] as? String, "avg")
        XCTAssertEqual(record?["signature"] as? String, "([Number]) -> Number")
    }

    // MARK: - parse

    func testParse() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "g"),
            storage: storage
        )

        let result = try await handler.parse(
            input: ExpressionLanguageParseInput(languageId: "formula", expressionString: "1 + 2"),
            storage: storage
        )

        if case .ok(let ast) = result {
            XCTAssertTrue(ast.contains("formula"))
            XCTAssertTrue(ast.contains("1 + 2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testParseLanguageNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.parse(
            input: ExpressionLanguageParseInput(languageId: "nonexistent", expressionString: "1 + 2"),
            storage: storage
        )

        if case .parseError(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .parseError but got \(result)")
        }
    }

    func testParseEmptyExpression() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        _ = try await handler.registerLanguage(
            input: ExpressionLanguageRegisterLanguageInput(languageId: "formula", grammar: "g"),
            storage: storage
        )

        let result = try await handler.parse(
            input: ExpressionLanguageParseInput(languageId: "formula", expressionString: ""),
            storage: storage
        )

        if case .parseError(let message) = result {
            XCTAssertTrue(message.contains("Empty"))
        } else {
            XCTFail("Expected .parseError but got \(result)")
        }
    }

    // MARK: - evaluate

    func testEvaluate() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.evaluate(
            input: ExpressionLanguageEvaluateInput(
                ast: "{\"type\":\"expression\",\"body\":\"1 + 2\"}",
                context: "{\"x\":10}"
            ),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertTrue(resultStr.contains("1 + 2"))
            XCTAssertTrue(resultStr.contains("context="))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateEmptyAST() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.evaluate(
            input: ExpressionLanguageEvaluateInput(ast: "", context: "{}"),
            storage: storage
        )

        if case .evalError(let message) = result {
            XCTAssertTrue(message.contains("Empty"))
        } else {
            XCTFail("Expected .evalError but got \(result)")
        }
    }

    func testEvaluateWithContext() async throws {
        let storage = InMemoryStorage()
        let handler = ExpressionLanguageHandlerImpl()

        let result = try await handler.evaluate(
            input: ExpressionLanguageEvaluateInput(
                ast: "{\"type\":\"var\",\"name\":\"x\"}",
                context: "{\"x\":42}"
            ),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertTrue(resultStr.contains("{\"x\":42}"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
