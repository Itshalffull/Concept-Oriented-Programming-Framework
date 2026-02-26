// NamespaceTests.swift — Tests for Namespace concept

import XCTest
@testable import Clef

final class NamespaceTests: XCTestCase {

    // MARK: - createNamespacedPage

    func testCreateNamespacedPage() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let result = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs/getting-started"),
            storage: storage
        )

        if case .ok(let pageId, _) = result {
            XCTAssertFalse(pageId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateNamespacedPageStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let result = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "wiki/home"),
            storage: storage
        )

        if case .ok(let pageId, _) = result {
            let record = try await storage.get(relation: "namespace_page", key: pageId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["fullPath"] as? String, "wiki/home")
            XCTAssertEqual(record?["name"] as? String, "home")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateNamespacedPageWithParent() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        // Create the parent first
        let parentResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs"),
            storage: storage
        )
        guard case .ok(let parentId, _) = parentResult else {
            XCTFail("Expected .ok for parent"); return
        }

        // Create child under the parent path
        let childResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs/intro"),
            storage: storage
        )

        if case .ok(let childPageId, let childParentId) = childResult {
            XCTAssertFalse(childPageId.isEmpty)
            XCTAssertEqual(childParentId, parentId)
        } else {
            XCTFail("Expected .ok but got \(childResult)")
        }
    }

    // MARK: - getChildren

    func testGetChildren() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let parentResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs"),
            storage: storage
        )
        guard case .ok(let parentId, _) = parentResult else {
            XCTFail("Expected .ok for parent"); return
        }

        _ = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs/intro"),
            storage: storage
        )

        let result = try await handler.getChildren(
            input: NamespaceGetChildrenInput(pageId: parentId),
            storage: storage
        )

        if case .ok(let pid, let children) = result {
            XCTAssertEqual(pid, parentId)
            XCTAssertTrue(children.contains("["))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetChildrenEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let result = try await handler.getChildren(
            input: NamespaceGetChildrenInput(pageId: "no-children"),
            storage: storage
        )

        if case .ok(_, let children) = result {
            XCTAssertEqual(children, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - getHierarchy

    func testGetHierarchy() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let parentResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs"),
            storage: storage
        )
        guard case .ok(let parentId, _) = parentResult else {
            XCTFail("Expected .ok for parent"); return
        }

        let childResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "docs/intro"),
            storage: storage
        )
        guard case .ok(let childId, _) = childResult else {
            XCTFail("Expected .ok for child"); return
        }

        let result = try await handler.getHierarchy(
            input: NamespaceGetHierarchyInput(pageId: childId),
            storage: storage
        )

        if case .ok(let pid, let ancestors) = result {
            XCTAssertEqual(pid, childId)
            XCTAssertTrue(ancestors.contains(parentId))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetHierarchyRootPage() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let result = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "home"),
            storage: storage
        )
        guard case .ok(let pageId, _) = result else {
            XCTFail("Expected .ok"); return
        }

        let hierarchyResult = try await handler.getHierarchy(
            input: NamespaceGetHierarchyInput(pageId: pageId),
            storage: storage
        )

        if case .ok(_, let ancestors) = hierarchyResult {
            XCTAssertEqual(ancestors, "[]")
        } else {
            XCTFail("Expected .ok but got \(hierarchyResult)")
        }
    }

    // MARK: - movePage

    func testMovePage() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let pageResult = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(fullPath: "old/page"),
            storage: storage
        )
        guard case .ok(let pageId, _) = pageResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.movePage(
            input: NamespaceMovePageInput(pageId: pageId, newParentPath: ""),
            storage: storage
        )

        if case .ok(let pid) = result {
            XCTAssertEqual(pid, pageId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testMovePageNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = NamespaceHandlerImpl()

        let result = try await handler.movePage(
            input: NamespaceMovePageInput(pageId: "nonexistent", newParentPath: "docs"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
