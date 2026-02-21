// CollaborationFlagTests.swift — Tests for CollaborationFlag concept

import XCTest
@testable import COPF

final class CollaborationFlagTests: XCTestCase {

    // MARK: - flag

    func testFlag() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        let result = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "bookmark"),
            storage: storage
        )

        if case .ok(let userId, let entityId, let flagType) = result {
            XCTAssertEqual(userId, "u1")
            XCTAssertEqual(entityId, "e1")
            XCTAssertEqual(flagType, "bookmark")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testFlagAlreadyFlagged() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        _ = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        let result = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .alreadyFlagged(let message) = result {
            XCTAssertTrue(message.contains("u1"))
        } else {
            XCTFail("Expected .alreadyFlagged but got \(result)")
        }
    }

    func testFlagDifferentTypes() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        let r1 = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )
        let r2 = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "bookmark"),
            storage: storage
        )

        if case .ok = r1 {} else { XCTFail("Expected .ok for first flag") }
        if case .ok = r2 {} else { XCTFail("Expected .ok for second flag") }
    }

    // MARK: - unflag

    func testUnflag() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        _ = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        let result = try await handler.unflag(
            input: CollaborationFlagUnflagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .ok(let userId, let entityId, let flagType) = result {
            XCTAssertEqual(userId, "u1")
            XCTAssertEqual(entityId, "e1")
            XCTAssertEqual(flagType, "like")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnflagNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        let result = try await handler.unflag(
            input: CollaborationFlagUnflagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("u1"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - isFlagged

    func testIsFlaggedTrue() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        _ = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        let result = try await handler.isFlagged(
            input: CollaborationFlagIsFlaggedInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .ok(let flagged) = result {
            XCTAssertTrue(flagged)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testIsFlaggedFalse() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        let result = try await handler.isFlagged(
            input: CollaborationFlagIsFlaggedInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .ok(let flagged) = result {
            XCTAssertFalse(flagged)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - getCount

    func testGetCount() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        _ = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u1", entityId: "e1", flagType: "like"),
            storage: storage
        )
        _ = try await handler.flag(
            input: CollaborationFlagFlagInput(userId: "u2", entityId: "e1", flagType: "like"),
            storage: storage
        )

        let result = try await handler.getCount(
            input: CollaborationFlagGetCountInput(entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .ok(let entityId, let count) = result {
            XCTAssertEqual(entityId, "e1")
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetCountZero() async throws {
        let storage = InMemoryStorage()
        let handler = CollaborationFlagHandlerImpl()

        let result = try await handler.getCount(
            input: CollaborationFlagGetCountInput(entityId: "e1", flagType: "like"),
            storage: storage
        )

        if case .ok(_, let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
