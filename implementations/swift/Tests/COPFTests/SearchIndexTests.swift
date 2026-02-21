// SearchIndexTests.swift — Tests for SearchIndex concept

import XCTest
@testable import COPF

final class SearchIndexTests: XCTestCase {

    // MARK: - createIndex

    func testCreateIndexReturnsOkWithIndexId() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        let result = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(indexId: "idx1", config: "{\"analyzer\":\"standard\"}"),
            storage: storage
        )

        if case .ok(let indexId) = result {
            XCTAssertEqual(indexId, "idx1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateIndexStoresConfig() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(indexId: "idx1", config: "{\"lang\":\"en\"}"),
            storage: storage
        )

        let record = try await storage.get(relation: "search_index", key: "idx1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["config"] as? String, "{\"lang\":\"en\"}")
    }

    func testCreateMultipleIndexes() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        let r1 = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(indexId: "idx1", config: "{}"),
            storage: storage
        )
        let r2 = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(indexId: "idx2", config: "{}"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertEqual(id1, "idx1")
            XCTAssertEqual(id2, "idx2")
        } else {
            XCTFail("Expected .ok for both")
        }
    }

    // MARK: - indexItem

    func testIndexItemReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(indexId: "idx1", config: "{}"),
            storage: storage
        )

        let result = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "Hello world"),
            storage: storage
        )

        if case .ok(let indexId, let nodeId) = result {
            XCTAssertEqual(indexId, "idx1")
            XCTAssertEqual(nodeId, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testIndexItemStoresContent() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "test content"),
            storage: storage
        )

        let record = try await storage.get(relation: "indexed_item", key: "idx1:n1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["content"] as? String, "test content")
    }

    func testIndexMultipleItems() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "first"),
            storage: storage
        )
        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n2", content: "second"),
            storage: storage
        )

        let r1 = try await storage.get(relation: "indexed_item", key: "idx1:n1")
        let r2 = try await storage.get(relation: "indexed_item", key: "idx1:n2")
        XCTAssertNotNil(r1)
        XCTAssertNotNil(r2)
    }

    // MARK: - removeItem

    func testRemoveItemReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "data"),
            storage: storage
        )

        let result = try await handler.removeItem(
            input: SearchIndexRemoveItemInput(indexId: "idx1", nodeId: "n1"),
            storage: storage
        )

        if case .ok(let indexId) = result {
            XCTAssertEqual(indexId, "idx1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "indexed_item", key: "idx1:n1")
        XCTAssertNil(record)
    }

    func testRemoveItemMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        let result = try await handler.removeItem(
            input: SearchIndexRemoveItemInput(indexId: "idx1", nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - search

    func testSearchFindsMatchingItems() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "Swift programming language"),
            storage: storage
        )
        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n2", content: "Rust programming language"),
            storage: storage
        )
        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n3", content: "Cooking recipes"),
            storage: storage
        )

        let result = try await handler.search(
            input: SearchIndexSearchInput(indexId: "idx1", queryText: "programming"),
            storage: storage
        )

        if case .ok(let indexId, let results) = result {
            XCTAssertEqual(indexId, "idx1")
            XCTAssertTrue(results.contains("n1"))
            XCTAssertTrue(results.contains("n2"))
            XCTAssertFalse(results.contains("n3"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSearchNoMatchReturnsEmptyResults() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "Hello world"),
            storage: storage
        )

        let result = try await handler.search(
            input: SearchIndexSearchInput(indexId: "idx1", queryText: "zzzzz"),
            storage: storage
        )

        if case .ok(let indexId, let results) = result {
            XCTAssertEqual(indexId, "idx1")
            XCTAssertEqual(results, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - reindex

    func testReindexReturnsItemCount() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n1", content: "a"),
            storage: storage
        )
        _ = try await handler.indexItem(
            input: SearchIndexIndexItemInput(indexId: "idx1", nodeId: "n2", content: "b"),
            storage: storage
        )

        let result = try await handler.reindex(
            input: SearchIndexReindexInput(indexId: "idx1"),
            storage: storage
        )

        if case .ok(let indexId, let count) = result {
            XCTAssertEqual(indexId, "idx1")
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReindexEmptyIndexReturnsZero() async throws {
        let storage = InMemoryStorage()
        let handler = SearchIndexHandlerImpl()

        let result = try await handler.reindex(
            input: SearchIndexReindexInput(indexId: "empty"),
            storage: storage
        )

        if case .ok(let indexId, let count) = result {
            XCTAssertEqual(indexId, "empty")
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
