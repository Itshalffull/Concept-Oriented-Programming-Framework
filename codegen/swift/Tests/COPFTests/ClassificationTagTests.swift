// ClassificationTagTests.swift — Tests for ClassificationTag concept

import XCTest
@testable import COPF

final class ClassificationTagTests: XCTestCase {

    // MARK: - addTag

    func testAddTagReturnsOkWithTagName() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        let result = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "important"),
            storage: storage
        )

        if case .ok(let tagName) = result {
            XCTAssertEqual(tagName, "important")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddTagStoresEntry() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "urgent"),
            storage: storage
        )

        let record = try await storage.get(relation: "tag_entry", key: "n1:urgent")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["tagName"] as? String, "urgent")
    }

    func testAddTagUpdatesIndex() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "work"),
            storage: storage
        )
        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n2", tagName: "work"),
            storage: storage
        )

        let index = try await storage.get(relation: "tag_index", key: "work")
        XCTAssertNotNil(index)
        let nodeIds = index?["nodeIds"] as? [String] ?? []
        XCTAssertTrue(nodeIds.contains("n1"))
        XCTAssertTrue(nodeIds.contains("n2"))
    }

    // MARK: - removeTag

    func testRemoveTagReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "temp"),
            storage: storage
        )

        let result = try await handler.removeTag(
            input: ClassificationTagRemoveTagInput(nodeId: "n1", tagName: "temp"),
            storage: storage
        )

        if case .ok(let tagName) = result {
            XCTAssertEqual(tagName, "temp")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRemoveTagMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        let result = try await handler.removeTag(
            input: ClassificationTagRemoveTagInput(nodeId: "n1", tagName: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getByTag

    func testGetByTagReturnsTaggedNodes() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "project"),
            storage: storage
        )
        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n2", tagName: "project"),
            storage: storage
        )

        let result = try await handler.getByTag(
            input: ClassificationTagGetByTagInput(tagName: "project"),
            storage: storage
        )

        if case .ok(let tagName, let nodeIds) = result {
            XCTAssertEqual(tagName, "project")
            XCTAssertTrue(nodeIds.contains("n1"))
            XCTAssertTrue(nodeIds.contains("n2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetByTagNoNodesReturnsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        let result = try await handler.getByTag(
            input: ClassificationTagGetByTagInput(tagName: "empty"),
            storage: storage
        )

        if case .ok(let tagName, let nodeIds) = result {
            XCTAssertEqual(tagName, "empty")
            XCTAssertEqual(nodeIds, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - rename

    func testRenameTagReturnsOkWithNewName() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "old-name"),
            storage: storage
        )

        let result = try await handler.rename(
            input: ClassificationTagRenameInput(oldTag: "old-name", newTag: "new-name"),
            storage: storage
        )

        if case .ok(let tagName) = result {
            XCTAssertEqual(tagName, "new-name")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRenameMissingTagReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        let result = try await handler.rename(
            input: ClassificationTagRenameInput(oldTag: "nonexistent", newTag: "new"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testRenamePreservesNodeAssociations() async throws {
        let storage = InMemoryStorage()
        let handler = ClassificationTagHandlerImpl()

        _ = try await handler.addTag(
            input: ClassificationTagAddTagInput(nodeId: "n1", tagName: "alpha"),
            storage: storage
        )

        _ = try await handler.rename(
            input: ClassificationTagRenameInput(oldTag: "alpha", newTag: "beta"),
            storage: storage
        )

        let result = try await handler.getByTag(
            input: ClassificationTagGetByTagInput(tagName: "beta"),
            storage: storage
        )

        if case .ok(_, let nodeIds) = result {
            XCTAssertTrue(nodeIds.contains("n1"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
