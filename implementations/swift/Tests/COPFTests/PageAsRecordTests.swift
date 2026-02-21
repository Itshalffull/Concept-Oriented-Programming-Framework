// PageAsRecordTests.swift — Tests for PageAsRecord concept

import XCTest
@testable import COPF

final class PageAsRecordTests: XCTestCase {

    /// Helper to seed a page record in storage
    private func seedPageRecord(_ storage: InMemoryStorage, nodeId: String) async throws {
        try await storage.put(
            relation: "page_record",
            key: nodeId,
            value: [
                "nodeId": nodeId,
                "properties": "{}",
                "body": "[]",
                "createdAt": "2025-01-01T00:00:00Z",
                "updatedAt": "2025-01-01T00:00:00Z",
            ]
        )
    }

    // MARK: - setProperty

    func testSetPropertyOnExistingPage() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()
        try await seedPageRecord(storage, nodeId: "page1")

        let result = try await handler.setProperty(
            input: PageAsRecordSetPropertyInput(nodeId: "page1", name: "title", value: "My Page"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetPropertyOnMissingPageReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        let result = try await handler.setProperty(
            input: PageAsRecordSetPropertyInput(nodeId: "missing", name: "title", value: "val"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getProperty

    func testGetPropertyReturnsSetValue() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()
        try await seedPageRecord(storage, nodeId: "page1")

        _ = try await handler.setProperty(
            input: PageAsRecordSetPropertyInput(nodeId: "page1", name: "author", value: "Alice"),
            storage: storage
        )

        let result = try await handler.getProperty(
            input: PageAsRecordGetPropertyInput(nodeId: "page1", name: "author"),
            storage: storage
        )

        if case .ok(let nodeId, let name, let value) = result {
            XCTAssertEqual(nodeId, "page1")
            XCTAssertEqual(name, "author")
            XCTAssertEqual(value, "Alice")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetPropertyMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()
        try await seedPageRecord(storage, nodeId: "page1")

        let result = try await handler.getProperty(
            input: PageAsRecordGetPropertyInput(nodeId: "page1", name: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testGetPropertyOnMissingPageReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        let result = try await handler.getProperty(
            input: PageAsRecordGetPropertyInput(nodeId: "missing", name: "title"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - appendToBody

    func testAppendToBodyAddsChild() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()
        try await seedPageRecord(storage, nodeId: "page1")

        let result = try await handler.appendToBody(
            input: PageAsRecordAppendToBodyInput(nodeId: "page1", childNodeId: "child1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAppendToBodyOnMissingPageReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        let result = try await handler.appendToBody(
            input: PageAsRecordAppendToBodyInput(nodeId: "missing", childNodeId: "child1"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - attachToSchema

    func testAttachToSchemaCreatesOrUpdatesRecord() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        let result = try await handler.attachToSchema(
            input: PageAsRecordAttachToSchemaInput(nodeId: "page1", schemaId: "schema1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "page_record", key: "page1")
        XCTAssertEqual(record?["schemaId"] as? String, "schema1")
    }

    func testAttachToSchemaUpdatesExistingRecord() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()
        try await seedPageRecord(storage, nodeId: "page1")

        let result = try await handler.attachToSchema(
            input: PageAsRecordAttachToSchemaInput(nodeId: "page1", schemaId: "schema2"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - detachFromSchema

    func testDetachFromSchemaRemovesSchemaId() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        _ = try await handler.attachToSchema(
            input: PageAsRecordAttachToSchemaInput(nodeId: "page1", schemaId: "schema1"),
            storage: storage
        )

        let result = try await handler.detachFromSchema(
            input: PageAsRecordDetachFromSchemaInput(nodeId: "page1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDetachFromSchemaOnMissingPageReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PageAsRecordHandlerImpl()

        let result = try await handler.detachFromSchema(
            input: PageAsRecordDetachFromSchemaInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
