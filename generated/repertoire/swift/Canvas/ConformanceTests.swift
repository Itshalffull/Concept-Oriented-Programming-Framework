// generated: Canvas/ConformanceTests.swift

import XCTest
@testable import Clef

final class CanvasConformanceTests: XCTestCase {

    func testCanvasInvariant1() async throws {
        // invariant 1: after addNode, moveNode, connectNodes behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v = "u-test-invariant-001"

        // --- AFTER clause ---
        // addNode(canvas: v, node: "a", x: 0, y: 0) -> ok()
        let step1 = try await handler.addNode(
            input: CanvasAddNodeInput(canvas: v, node: "a", x: 0, y: 0),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // moveNode(canvas: v, node: "a", x: 100, y: 200) -> ok()
        let step2 = try await handler.moveNode(
            input: CanvasMoveNodeInput(canvas: v, node: "a", x: 100, y: 200),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // connectNodes(canvas: v, from: "a", to: "b") -> ok()
        let step3 = try await handler.connectNodes(
            input: CanvasConnectNodesInput(canvas: v, from: "a", to: "b"),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
    }

}
