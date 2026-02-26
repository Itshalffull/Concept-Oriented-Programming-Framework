// ContentStorageTests.swift — Tests for ContentStorage concept

import XCTest
@testable import COPF

final class ContentStorageTests: XCTestCase {

    // MARK: - save

    func testSaveReturnsOkWithNodeId() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        let result = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "content data"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "p1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSaveStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "saved content"),
            storage: storage
        )

        let record = try await storage.get(relation: "persisted_node", key: "p1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["data"] as? String, "saved content")
    }

    func testSaveOverwritesExisting() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "original"),
            storage: storage
        )
        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "updated"),
            storage: storage
        )

        let record = try await storage.get(relation: "persisted_node", key: "p1")
        XCTAssertEqual(record?["data"] as? String, "updated")
    }

    // MARK: - load

    func testLoadReturnsOkForSavedNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "my data"),
            storage: storage
        )

        let result = try await handler.load(
            input: ContentStorageLoadInput(nodeId: "p1"),
            storage: storage
        )

        if case .ok(let nodeId, let data) = result {
            XCTAssertEqual(nodeId, "p1")
            XCTAssertEqual(data, "my data")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testLoadReturnsNotfoundForMissingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        let result = try await handler.load(
            input: ContentStorageLoadInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - delete

    func testDeleteRemovesSavedNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "data"),
            storage: storage
        )

        let result = try await handler.delete(
            input: ContentStorageDeleteInput(nodeId: "p1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "p1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "persisted_node", key: "p1")
        XCTAssertNil(record)
    }

    func testDeleteReturnsNotfoundForMissingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        let result = try await handler.delete(
            input: ContentStorageDeleteInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - query

    func testQueryReturnsOkWithResults() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p1", data: "data1"),
            storage: storage
        )
        _ = try await handler.save(
            input: ContentStorageSaveInput(nodeId: "p2", data: "data2"),
            storage: storage
        )

        let result = try await handler.query(
            input: ContentStorageQueryInput(conditions: "{}"),
            storage: storage
        )

        if case .ok(let results) = result {
            XCTAssertFalse(results.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testQueryEmptyStorageReturnsEmptyResults() async throws {
        let storage = InMemoryStorage()
        let handler = ContentStorageHandlerImpl()

        let result = try await handler.query(
            input: ContentStorageQueryInput(conditions: "{}"),
            storage: storage
        )

        if case .ok(let results) = result {
            XCTAssertTrue(results == "[]" || results.isEmpty || results == "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
