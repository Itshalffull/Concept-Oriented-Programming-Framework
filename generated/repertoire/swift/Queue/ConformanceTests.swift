// generated: Queue/ConformanceTests.swift

import XCTest
@testable import COPF

final class QueueConformanceTests: XCTestCase {

    func testQueueInvariant1() async throws {
        // invariant 1: after enqueue, claim, process behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let q = "u-test-invariant-001"

        // --- AFTER clause ---
        // enqueue(queue: q, item: "send_email", priority: 1) -> ok(itemId: "item-1")
        let step1 = try await handler.enqueue(
            input: QueueEnqueueInput(queue: q, item: "send_email", priority: 1),
            storage: storage
        )
        if case .ok(let itemId) = step1 {
            XCTAssertEqual(itemId, "item-1")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // claim(queue: q, worker: "worker-a") -> ok(item: "send_email")
        let step2 = try await handler.claim(
            input: QueueClaimInput(queue: q, worker: "worker-a"),
            storage: storage
        )
        if case .ok(let item) = step2 {
            XCTAssertEqual(item, "send_email")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // process(queue: q, itemId: "item-1", result: "sent") -> ok()
        let step3 = try await handler.process(
            input: QueueProcessInput(queue: q, itemId: "item-1", result: "sent"),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
    }

}
