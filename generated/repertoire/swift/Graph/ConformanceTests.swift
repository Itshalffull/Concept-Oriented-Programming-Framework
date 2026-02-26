// generated: Graph/ConformanceTests.swift

import XCTest
@testable import COPF

final class GraphConformanceTests: XCTestCase {

    func testGraphInvariant1() async throws {
        // invariant 1: after addNode, addNode, addEdge, getNeighbors behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let g = "u-test-invariant-001"

        // --- AFTER clause ---
        // addNode(graph: g, node: "A") -> ok()
        let step1 = try await handler.addNode(
            input: GraphAddNodeInput(graph: g, node: "A"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addNode(graph: g, node: "B") -> ok()
        let step2 = try await handler.addNode(
            input: GraphAddNodeInput(graph: g, node: "B"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // addEdge(graph: g, source: "A", target: "B") -> ok()
        let step3 = try await handler.addEdge(
            input: GraphAddEdgeInput(graph: g, source: "A", target: "B"),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
        // getNeighbors(graph: g, node: "A", depth: 1) -> ok(neighbors: "B")
        let step4 = try await handler.getNeighbors(
            input: GraphGetNeighborsInput(graph: g, node: "A", depth: 1),
            storage: storage
        )
        if case .ok(let neighbors) = step4 {
            XCTAssertEqual(neighbors, "B")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

}
