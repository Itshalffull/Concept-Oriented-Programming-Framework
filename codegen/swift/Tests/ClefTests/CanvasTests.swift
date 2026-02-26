// CanvasTests.swift — Tests for Canvas concept

import XCTest
@testable import Clef

final class CanvasTests: XCTestCase {

    // MARK: - addNode

    func testAddNode() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 100.0, positionY: 200.0, content: "Hello"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertFalse(nodeId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddNodeStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "note", positionX: 50.0, positionY: 75.0, content: "My note"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            let record = try await storage.get(relation: "canvas_node", key: nodeId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["nodeType"] as? String, "note")
            XCTAssertEqual(record?["positionX"] as? Double, 50.0)
            XCTAssertEqual(record?["positionY"] as? Double, 75.0)
            XCTAssertEqual(record?["content"] as? String, "My note")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddMultipleNodes() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let r1 = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 0, positionY: 0, content: "A"),
            storage: storage
        )
        let r2 = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 100, positionY: 100, content: "B"),
            storage: storage
        )

        guard case .ok(let id1) = r1, case .ok(let id2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - moveNode

    func testMoveNode() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let addResult = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 10, positionY: 20, content: "Move me"),
            storage: storage
        )
        guard case .ok(let nodeId) = addResult else {
            return XCTFail("Expected .ok on addNode")
        }

        let result = try await handler.moveNode(
            input: CanvasMoveNodeInput(nodeId: nodeId, newX: 300.0, newY: 400.0),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, nodeId)
            let record = try await storage.get(relation: "canvas_node", key: nodeId)
            XCTAssertEqual(record?["positionX"] as? Double, 300.0)
            XCTAssertEqual(record?["positionY"] as? Double, 400.0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testMoveNodeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.moveNode(
            input: CanvasMoveNodeInput(nodeId: "nonexistent", newX: 0, newY: 0),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - connectNodes

    func testConnectNodes() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.connectNodes(
            input: CanvasConnectNodesInput(fromId: "n1", toId: "n2", label: "relates to"),
            storage: storage
        )

        if case .ok(let edgeId) = result {
            XCTAssertFalse(edgeId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testConnectNodesStoresEdge() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.connectNodes(
            input: CanvasConnectNodesInput(fromId: "n1", toId: "n2", label: "depends on"),
            storage: storage
        )

        if case .ok(let edgeId) = result {
            let record = try await storage.get(relation: "canvas_edge", key: edgeId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["fromId"] as? String, "n1")
            XCTAssertEqual(record?["toId"] as? String, "n2")
            XCTAssertEqual(record?["label"] as? String, "depends on")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testConnectNodesMultipleEdges() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let r1 = try await handler.connectNodes(
            input: CanvasConnectNodesInput(fromId: "n1", toId: "n2", label: "a"),
            storage: storage
        )
        let r2 = try await handler.connectNodes(
            input: CanvasConnectNodesInput(fromId: "n2", toId: "n3", label: "b"),
            storage: storage
        )

        guard case .ok(let e1) = r1, case .ok(let e2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(e1, e2)
    }

    // MARK: - groupNodes

    func testGroupNodes() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let r1 = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 0, positionY: 0, content: "A"),
            storage: storage
        )
        let r2 = try await handler.addNode(
            input: CanvasAddNodeInput(nodeType: "card", positionX: 100, positionY: 100, content: "B"),
            storage: storage
        )

        guard case .ok(let id1) = r1, case .ok(let id2) = r2 else {
            return XCTFail("Expected both addNode results to be .ok")
        }

        let nodeIdsJSON = "[\"\(id1)\",\"\(id2)\"]"
        let result = try await handler.groupNodes(
            input: CanvasGroupNodesInput(nodeIds: nodeIdsJSON),
            storage: storage
        )

        if case .ok(let groupId) = result {
            XCTAssertFalse(groupId.isEmpty)
            let node1 = try await storage.get(relation: "canvas_node", key: id1)
            let node2 = try await storage.get(relation: "canvas_node", key: id2)
            XCTAssertEqual(node1?["groupId"] as? String, groupId)
            XCTAssertEqual(node2?["groupId"] as? String, groupId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGroupNodesEmptyList() async throws {
        let storage = InMemoryStorage()
        let handler = CanvasHandlerImpl()

        let result = try await handler.groupNodes(
            input: CanvasGroupNodesInput(nodeIds: "[]"),
            storage: storage
        )

        if case .ok(let groupId) = result {
            XCTAssertFalse(groupId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
