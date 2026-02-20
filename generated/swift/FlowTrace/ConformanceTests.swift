// generated: FlowTrace/ConformanceTests.swift

import XCTest
@testable import COPF

final class FlowTraceConformanceTests: XCTestCase {

    func testFlowTraceInvariant1() async throws {
        // invariant 1: after render, build behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let o = "u-test-invariant-001"
        let e = "u-test-invariant-002"

        // --- AFTER clause ---
        // render(trace: ["flowId": "f1", "status": "ok", "durationMs": 100, "root": ["action": "Test/ping", "variant": "ok", "durationMs": 50, "fields": [], "children": []]], options: []) -> ok(output: o)
        let step1 = try await handler.render(
            input: FlowTraceRenderInput(trace: ["flowId": "f1", "status": "ok", "durationMs": 100, "root": ["action": "Test/ping", "variant": "ok", "durationMs": 50, "fields": [], "children": []]], options: []),
            storage: storage
        )
        if case .ok(let output) = step1 {
            XCTAssertEqual(output, o)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // build(flowId: "f1") -> error(message: e)
        let step2 = try await handler.build(
            input: FlowTraceBuildInput(flowId: "f1"),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, e)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
