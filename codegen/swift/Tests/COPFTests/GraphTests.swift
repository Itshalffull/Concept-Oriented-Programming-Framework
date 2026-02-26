// GraphTests.swift — Tests for Graph concept

import XCTest
@testable import COPF

final class GraphTests: XCTestCase {

    // MARK: - addNode

    func testAddNode() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        let result = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "node1"),
            storage: storage
        )

        if case .ok(let entityId) = result {
            XCTAssertEqual(entityId, "node1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddNodeAlreadyExists() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "node1"),
            storage: storage
        )

        let result = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "node1"),
            storage: storage
        )

        if case .alreadyExists(let message) = result {
            XCTAssertTrue(message.contains("node1"))
        } else {
            XCTFail("Expected .alreadyExists but got \(result)")
        }
    }

    func testAddMultipleNodes() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        let result1 = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "a"),
            storage: storage
        )
        let result2 = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "b"),
            storage: storage
        )

        if case .ok(let id1) = result1, case .ok(let id2) = result2 {
            XCTAssertEqual(id1, "a")
            XCTAssertEqual(id2, "b")
        } else {
            XCTFail("Expected both results to be .ok")
        }
    }

    // MARK: - removeNode

    func testRemoveNode() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addNode(
            input: GraphAddNodeInput(entityId: "node1"),
            storage: storage
        )

        let result = try await handler.removeNode(
            input: GraphRemoveNodeInput(entityId: "node1"),
            storage: storage
        )

        if case .ok(let entityId) = result {
            XCTAssertEqual(entityId, "node1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "graph_node", key: "node1")
        XCTAssertNil(record)
    }

    func testRemoveNodeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        let result = try await handler.removeNode(
            input: GraphRemoveNodeInput(entityId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - addEdge

    func testAddEdge() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        let result = try await handler.addEdge(
            input: GraphAddEdgeInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .ok(let sourceId, let targetId) = result {
            XCTAssertEqual(sourceId, "a")
            XCTAssertEqual(targetId, "b")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddEdgeStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addEdge(
            input: GraphAddEdgeInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        let edge = try await storage.get(relation: "graph_edge", key: "a:b")
        XCTAssertNotNil(edge)
        XCTAssertEqual(edge?["sourceId"] as? String, "a")
        XCTAssertEqual(edge?["targetId"] as? String, "b")
    }

    // MARK: - removeEdge

    func testRemoveEdge() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addEdge(
            input: GraphAddEdgeInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        let result = try await handler.removeEdge(
            input: GraphRemoveEdgeInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .ok(let sourceId, let targetId) = result {
            XCTAssertEqual(sourceId, "a")
            XCTAssertEqual(targetId, "b")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRemoveEdgeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        let result = try await handler.removeEdge(
            input: GraphRemoveEdgeInput(sourceId: "x", targetId: "y"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("x"))
            XCTAssertTrue(message.contains("y"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getNeighbors

    func testGetNeighbors() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "a"), storage: storage)
        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "b"), storage: storage)
        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "c"), storage: storage)
        _ = try await handler.addEdge(input: GraphAddEdgeInput(sourceId: "a", targetId: "b"), storage: storage)
        _ = try await handler.addEdge(input: GraphAddEdgeInput(sourceId: "a", targetId: "c"), storage: storage)

        let result = try await handler.getNeighbors(
            input: GraphGetNeighborsInput(entityId: "a", depth: 1),
            storage: storage
        )

        if case .ok(let entityId, let neighbors) = result {
            XCTAssertEqual(entityId, "a")
            XCTAssertTrue(neighbors.contains("b"))
            XCTAssertTrue(neighbors.contains("c"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetNeighborsNoEdges() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "a"), storage: storage)

        let result = try await handler.getNeighbors(
            input: GraphGetNeighborsInput(entityId: "a", depth: 1),
            storage: storage
        )

        if case .ok(_, let neighbors) = result {
            XCTAssertEqual(neighbors, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetNeighborsDepthTwo() async throws {
        let storage = InMemoryStorage()
        let handler = GraphHandlerImpl()

        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "a"), storage: storage)
        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "b"), storage: storage)
        _ = try await handler.addNode(input: GraphAddNodeInput(entityId: "c"), storage: storage)
        _ = try await handler.addEdge(input: GraphAddEdgeInput(sourceId: "a", targetId: "b"), storage: storage)
        _ = try await handler.addEdge(input: GraphAddEdgeInput(sourceId: "b", targetId: "c"), storage: storage)

        let result = try await handler.getNeighbors(
            input: GraphGetNeighborsInput(entityId: "a", depth: 2),
            storage: storage
        )

        if case .ok(_, let neighbors) = result {
            XCTAssertTrue(neighbors.contains("b"))
            XCTAssertTrue(neighbors.contains("c"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
