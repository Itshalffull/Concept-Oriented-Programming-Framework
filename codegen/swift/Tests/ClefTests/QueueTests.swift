// QueueTests.swift — Tests for Queue concept

import XCTest
@testable import Clef

final class QueueTests: XCTestCase {

    // MARK: - enqueue

    func testEnqueue() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let result = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "{\"task\":\"process\"}"),
            storage: storage
        )

        if case .ok(let itemId) = result {
            XCTAssertFalse(itemId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEnqueueStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let result = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "job_data"),
            storage: storage
        )

        if case .ok(let itemId) = result {
            let record = try await storage.get(relation: "queue_item", key: itemId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["queueId"] as? String, "q1")
            XCTAssertEqual(record?["data"] as? String, "job_data")
            XCTAssertEqual(record?["status"] as? String, "pending")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEnqueueMultipleItems() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let r1 = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "item1"),
            storage: storage
        )
        let r2 = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "item2"),
            storage: storage
        )

        guard case .ok(let id1) = r1, case .ok(let id2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - claim

    func testClaim() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        _ = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "my_job"),
            storage: storage
        )

        let result = try await handler.claim(
            input: QueueClaimInput(queueId: "q1"),
            storage: storage
        )

        if case .ok(let itemId, let data) = result {
            XCTAssertFalse(itemId.isEmpty)
            XCTAssertEqual(data, "my_job")
            // Verify status changed to claimed
            let record = try await storage.get(relation: "queue_item", key: itemId)
            XCTAssertEqual(record?["status"] as? String, "claimed")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testClaimEmptyQueue() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let result = try await handler.claim(
            input: QueueClaimInput(queueId: "q1"),
            storage: storage
        )

        if case .empty(let queueId) = result {
            XCTAssertEqual(queueId, "q1")
        } else {
            XCTFail("Expected .empty but got \(result)")
        }
    }

    func testClaimDoesNotReturnAlreadyClaimed() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        _ = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "only_item"),
            storage: storage
        )

        // Claim the item
        _ = try await handler.claim(
            input: QueueClaimInput(queueId: "q1"),
            storage: storage
        )

        // Try to claim again - should be empty since the item is now claimed
        let result = try await handler.claim(
            input: QueueClaimInput(queueId: "q1"),
            storage: storage
        )

        if case .empty(let queueId) = result {
            XCTAssertEqual(queueId, "q1")
        } else {
            XCTFail("Expected .empty but got \(result)")
        }
    }

    // MARK: - release

    func testRelease() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let enqueueResult = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "task"),
            storage: storage
        )
        guard case .ok(let itemId) = enqueueResult else {
            return XCTFail("Expected .ok on enqueue")
        }

        // Claim the item
        _ = try await handler.claim(
            input: QueueClaimInput(queueId: "q1"),
            storage: storage
        )

        // Release it
        let result = try await handler.release(
            input: QueueReleaseInput(itemId: itemId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, itemId)
            let record = try await storage.get(relation: "queue_item", key: itemId)
            XCTAssertEqual(record?["status"] as? String, "pending")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReleaseNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let result = try await handler.release(
            input: QueueReleaseInput(itemId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - deleteItem

    func testDeleteItem() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let enqueueResult = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "to_delete"),
            storage: storage
        )
        guard case .ok(let itemId) = enqueueResult else {
            return XCTFail("Expected .ok on enqueue")
        }

        let result = try await handler.deleteItem(
            input: QueueDeleteItemInput(itemId: itemId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, itemId)
            let record = try await storage.get(relation: "queue_item", key: itemId)
            XCTAssertNil(record)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDeleteItemNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let result = try await handler.deleteItem(
            input: QueueDeleteItemInput(itemId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testDeleteItemAfterClaim() async throws {
        let storage = InMemoryStorage()
        let handler = QueueHandlerImpl()

        let enqueueResult = try await handler.enqueue(
            input: QueueEnqueueInput(queueId: "q1", data: "data"),
            storage: storage
        )
        guard case .ok(let itemId) = enqueueResult else {
            return XCTFail("Expected .ok on enqueue")
        }

        _ = try await handler.claim(input: QueueClaimInput(queueId: "q1"), storage: storage)

        let result = try await handler.deleteItem(
            input: QueueDeleteItemInput(itemId: itemId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, itemId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
