// ContentNodeTests.swift — Tests for ContentNode concept

import XCTest
@testable import COPF

final class ContentNodeTests: XCTestCase {

    // MARK: - create

    func testCreateReturnsOkWithId() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let result = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "Hello"),
            storage: storage
        )

        if case .ok(let id) = result {
            XCTAssertEqual(id, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "heading", content: "Title"),
            storage: storage
        )

        let record = try await storage.get(relation: "content_node", key: "n1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["content"] as? String, "Title")
        XCTAssertEqual(record?["nodeType"] as? String, "heading")
    }

    func testCreateMultipleNodes() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let r1 = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "First"),
            storage: storage
        )
        let r2 = try await handler.create(
            input: ContentNodeCreateInput(id: "n2", nodeType: "code", content: "Second"),
            storage: storage
        )

        if case .ok(let id1) = r1 { XCTAssertEqual(id1, "n1") } else { XCTFail("Expected .ok for n1") }
        if case .ok(let id2) = r2 { XCTAssertEqual(id2, "n2") } else { XCTFail("Expected .ok for n2") }
    }

    // MARK: - update

    func testUpdateExistingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "Original"),
            storage: storage
        )

        let result = try await handler.update(
            input: ContentNodeUpdateInput(id: "n1", content: "Updated"),
            storage: storage
        )

        if case .ok(let id) = result {
            XCTAssertEqual(id, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "content_node", key: "n1")
        XCTAssertEqual(record?["content"] as? String, "Updated")
    }

    func testUpdateNonexistentNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let result = try await handler.update(
            input: ContentNodeUpdateInput(id: "missing", content: "text"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - delete

    func testDeleteExistingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "data"),
            storage: storage
        )

        let result = try await handler.delete(
            input: ContentNodeDeleteInput(id: "n1"),
            storage: storage
        )

        if case .ok(let id) = result {
            XCTAssertEqual(id, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "content_node", key: "n1")
        XCTAssertNil(record)
    }

    func testDeleteNonexistentNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let result = try await handler.delete(
            input: ContentNodeDeleteInput(id: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - setMetadata

    func testSetMetadataOnExistingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "data"),
            storage: storage
        )

        let result = try await handler.setMetadata(
            input: ContentNodeSetMetadataInput(id: "n1", key: "author", value: "Alice"),
            storage: storage
        )

        if case .ok(let id) = result {
            XCTAssertEqual(id, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetMetadataOnMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let result = try await handler.setMetadata(
            input: ContentNodeSetMetadataInput(id: "missing", key: "k", value: "v"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getMetadata

    func testGetMetadataReturnsSetValue() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "data"),
            storage: storage
        )
        _ = try await handler.setMetadata(
            input: ContentNodeSetMetadataInput(id: "n1", key: "color", value: "blue"),
            storage: storage
        )

        let result = try await handler.getMetadata(
            input: ContentNodeGetMetadataInput(id: "n1", key: "color"),
            storage: storage
        )

        if case .ok(let id, let key, let value) = result {
            XCTAssertEqual(id, "n1")
            XCTAssertEqual(key, "color")
            XCTAssertEqual(value, "blue")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetMetadataMissingKeyReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "data"),
            storage: storage
        )

        let result = try await handler.getMetadata(
            input: ContentNodeGetMetadataInput(id: "n1", key: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - changeType

    func testChangeTypeOnExistingNode() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        _ = try await handler.create(
            input: ContentNodeCreateInput(id: "n1", nodeType: "text", content: "data"),
            storage: storage
        )

        let result = try await handler.changeType(
            input: ContentNodeChangeTypeInput(id: "n1", newType: "heading"),
            storage: storage
        )

        if case .ok(let id) = result {
            XCTAssertEqual(id, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "content_node", key: "n1")
        XCTAssertEqual(record?["nodeType"] as? String, "heading")
    }

    func testChangeTypeOnMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ContentNodeHandlerImpl()

        let result = try await handler.changeType(
            input: ContentNodeChangeTypeInput(id: "missing", newType: "heading"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
