// AliasTests.swift — Tests for Alias concept

import XCTest
@testable import Clef

final class AliasTests: XCTestCase {

    // MARK: - addAlias

    func testAddAliasReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        let result = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "my-page"),
            storage: storage
        )

        if case .ok(let entityId, let aliasName) = result {
            XCTAssertEqual(entityId, "page1")
            XCTAssertEqual(aliasName, "my-page")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddAliasDuplicateReturnsAlreadyExists() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        _ = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "my-page"),
            storage: storage
        )

        let result = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page2", aliasName: "my-page"),
            storage: storage
        )

        if case .alreadyExists(let aliasName) = result {
            XCTAssertEqual(aliasName, "my-page")
        } else {
            XCTFail("Expected .alreadyExists but got \(result)")
        }
    }

    func testAddAliasStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        _ = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "shortcut"),
            storage: storage
        )

        let record = try await storage.get(relation: "alias", key: "shortcut")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["entityId"] as? String, "page1")
    }

    // MARK: - removeAlias

    func testRemoveAliasReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        _ = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "to-remove"),
            storage: storage
        )

        let result = try await handler.removeAlias(
            input: AliasRemoveAliasInput(entityId: "page1", aliasName: "to-remove"),
            storage: storage
        )

        if case .ok(let entityId, let aliasName) = result {
            XCTAssertEqual(entityId, "page1")
            XCTAssertEqual(aliasName, "to-remove")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "alias", key: "to-remove")
        XCTAssertNil(record)
    }

    func testRemoveAliasMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        let result = try await handler.removeAlias(
            input: AliasRemoveAliasInput(entityId: "page1", aliasName: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testRemoveAliasWrongEntityReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        _ = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "alias1"),
            storage: storage
        )

        let result = try await handler.removeAlias(
            input: AliasRemoveAliasInput(entityId: "page2", aliasName: "alias1"),
            storage: storage
        )

        if case .notfound = result {
            // expected: alias belongs to page1, not page2
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - resolve

    func testResolveReturnsEntityId() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        _ = try await handler.addAlias(
            input: AliasAddAliasInput(entityId: "page1", aliasName: "my-alias"),
            storage: storage
        )

        let result = try await handler.resolve(
            input: AliasResolveInput(name: "my-alias"),
            storage: storage
        )

        if case .ok(let entityId) = result {
            XCTAssertEqual(entityId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testResolveMissingAliasReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AliasHandlerImpl()

        let result = try await handler.resolve(
            input: AliasResolveInput(name: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
