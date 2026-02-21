// PathautoTests.swift — Tests for Pathauto concept

import XCTest
@testable import COPF

final class PathautoTests: XCTestCase {

    // MARK: - generateAlias

    func testGenerateAlias() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        let result = try await handler.generateAlias(
            input: PathautoGenerateAliasInput(nodeId: "n1", title: "Hello World"),
            storage: storage
        )

        if case .ok(let nodeId, let alias) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertEqual(alias, "hello-world")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGenerateAliasStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        _ = try await handler.generateAlias(
            input: PathautoGenerateAliasInput(nodeId: "n1", title: "Test Page"),
            storage: storage
        )

        let record = try await storage.get(relation: "path_alias", key: "n1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["alias"] as? String, "test-page")
        XCTAssertEqual(record?["title"] as? String, "Test Page")
    }

    func testGenerateAliasWithSpecialCharacters() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        let result = try await handler.generateAlias(
            input: PathautoGenerateAliasInput(nodeId: "n2", title: "Hello! @World# 123"),
            storage: storage
        )

        if case .ok(_, let alias) = result {
            XCTAssertEqual(alias, "hello-world-123")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - cleanString

    func testCleanString() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        let result = try await handler.cleanString(
            input: PathautoCleanStringInput(input: "My Blog Post!"),
            storage: storage
        )

        if case .ok(let cleaned) = result {
            XCTAssertEqual(cleaned, "my-blog-post")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCleanStringCollapsesMultipleDashes() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        let result = try await handler.cleanString(
            input: PathautoCleanStringInput(input: "Hello   World"),
            storage: storage
        )

        if case .ok(let cleaned) = result {
            XCTAssertEqual(cleaned, "hello-world")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - bulkGenerate

    func testBulkGenerateNoMatches() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        let result = try await handler.bulkGenerate(
            input: PathautoBulkGenerateInput(nodeType: "article"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testBulkGenerateWithExistingAliases() async throws {
        let storage = InMemoryStorage()
        let handler = PathautoHandlerImpl()

        // Manually insert an alias record with nodeType so bulkGenerate can find it
        try await storage.put(
            relation: "path_alias",
            key: "n1",
            value: [
                "nodeId": "n1",
                "title": "Old Title",
                "alias": "old-title",
                "nodeType": "article",
            ]
        )

        let result = try await handler.bulkGenerate(
            input: PathautoBulkGenerateInput(nodeType: "article"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
