// OutlineTests.swift — Tests for Outline concept

import XCTest
@testable import COPF

final class OutlineTests: XCTestCase {

    /// Helper to seed an outline node in storage
    private func seedOutlineNode(
        _ storage: InMemoryStorage,
        nodeId: String,
        depth: Int = 0,
        collapsed: Bool = false,
        parentId: String? = nil
    ) async throws {
        var value: [String: Any] = [
            "id": nodeId,
            "depth": depth,
            "collapsed": collapsed,
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-01T00:00:00Z",
        ]
        if let parentId = parentId {
            value["parentId"] = parentId
        }
        try await storage.put(relation: "outline_node", key: nodeId, value: value)
    }

    // MARK: - indent

    func testIndentIncreasesDepth() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1", depth: 0)

        let result = try await handler.indent(
            input: OutlineIndentInput(nodeId: "o1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "o1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "outline_node", key: "o1")
        XCTAssertEqual(record?["depth"] as? Int, 1)
    }

    func testIndentMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()

        let result = try await handler.indent(
            input: OutlineIndentInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - outdent

    func testOutdentDecreasesDepth() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1", depth: 2)

        let result = try await handler.outdent(
            input: OutlineOutdentInput(nodeId: "o1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "o1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "outline_node", key: "o1")
        XCTAssertEqual(record?["depth"] as? Int, 1)
    }

    func testOutdentAtZeroStaysAtZero() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1", depth: 0)

        _ = try await handler.outdent(
            input: OutlineOutdentInput(nodeId: "o1"),
            storage: storage
        )

        let record = try await storage.get(relation: "outline_node", key: "o1")
        XCTAssertEqual(record?["depth"] as? Int, 0)
    }

    // MARK: - reparent

    func testReparentSetsNewParent() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1")

        let result = try await handler.reparent(
            input: OutlineReparentInput(nodeId: "o1", newParentId: "parent1", position: 0),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "o1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "outline_node", key: "o1")
        XCTAssertEqual(record?["parentId"] as? String, "parent1")
        XCTAssertEqual(record?["position"] as? Int, 0)
    }

    func testReparentCreatesNodeIfNotExists() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()

        let result = try await handler.reparent(
            input: OutlineReparentInput(nodeId: "new1", newParentId: "parent1", position: 1),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "new1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - collapse

    func testCollapseSetsCollapsedTrue() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1", collapsed: false)

        let result = try await handler.collapse(
            input: OutlineCollapseInput(nodeId: "o1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "o1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCollapseMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()

        let result = try await handler.collapse(
            input: OutlineCollapseInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - expand

    func testExpandSetsCollapsedFalse() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "o1", collapsed: true)

        let result = try await handler.expand(
            input: OutlineExpandInput(nodeId: "o1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "o1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExpandMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()

        let result = try await handler.expand(
            input: OutlineExpandInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - zoom

    func testZoomReturnsChildrenList() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()
        try await seedOutlineNode(storage, nodeId: "parent1")
        try await seedOutlineNode(storage, nodeId: "child1", parentId: "parent1")

        let result = try await handler.zoom(
            input: OutlineZoomInput(nodeId: "parent1"),
            storage: storage
        )

        if case .ok(let nodeId, _) = result {
            XCTAssertEqual(nodeId, "parent1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testZoomMissingNodeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = OutlineHandlerImpl()

        let result = try await handler.zoom(
            input: OutlineZoomInput(nodeId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
