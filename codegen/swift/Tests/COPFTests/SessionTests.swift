// SessionTests.swift — Tests for Session concept

import XCTest
@testable import Clef

final class SessionTests: XCTestCase {

    // MARK: - create

    func testCreateReturnsSessionId() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "macOS"),
            storage: storage
        )

        if case .ok(let sessionId) = result {
            XCTAssertFalse(sessionId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateStoresSession() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "iOS"),
            storage: storage
        )

        if case .ok(let sessionId) = result {
            let record = try await storage.get(relation: "session", key: sessionId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["userId"] as? String, "user1")
            XCTAssertEqual(record?["deviceInfo"] as? String, "iOS")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleSessions() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let r1 = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "device1"),
            storage: storage
        )
        let r2 = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "device2"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertNotEqual(id1, id2)
        } else {
            XCTFail("Expected .ok for both")
        }
    }

    // MARK: - validate

    func testValidateActiveSessionReturnsValid() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let createResult = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "macOS"),
            storage: storage
        )

        guard case .ok(let sessionId) = createResult else {
            return XCTFail("Expected session creation to succeed")
        }

        let result = try await handler.validate(
            input: SessionValidateInput(sessionId: sessionId),
            storage: storage
        )

        if case .ok(let sid, let userId, let valid) = result {
            XCTAssertEqual(sid, sessionId)
            XCTAssertEqual(userId, "user1")
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateMissingSessionReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.validate(
            input: SessionValidateInput(sessionId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - refresh

    func testRefreshActiveSessionReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let createResult = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "macOS"),
            storage: storage
        )

        guard case .ok(let sessionId) = createResult else {
            return XCTFail("Expected session creation to succeed")
        }

        let result = try await handler.refresh(
            input: SessionRefreshInput(sessionId: sessionId),
            storage: storage
        )

        if case .ok(let sid) = result {
            XCTAssertEqual(sid, sessionId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRefreshMissingSessionReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.refresh(
            input: SessionRefreshInput(sessionId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - destroy

    func testDestroyExistingSessionReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let createResult = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "macOS"),
            storage: storage
        )

        guard case .ok(let sessionId) = createResult else {
            return XCTFail("Expected session creation to succeed")
        }

        let result = try await handler.destroy(
            input: SessionDestroyInput(sessionId: sessionId),
            storage: storage
        )

        if case .ok(let sid) = result {
            XCTAssertEqual(sid, sessionId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "session", key: sessionId)
        XCTAssertNil(record)
    }

    func testDestroyMissingSessionReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.destroy(
            input: SessionDestroyInput(sessionId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - destroyAll

    func testDestroyAllRemovesUserSessions() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        _ = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "device1"),
            storage: storage
        )
        _ = try await handler.create(
            input: SessionCreateInput(userId: "user1", deviceInfo: "device2"),
            storage: storage
        )

        let result = try await handler.destroyAll(
            input: SessionDestroyAllInput(userId: "user1"),
            storage: storage
        )

        if case .ok(let userId, let count) = result {
            XCTAssertEqual(userId, "user1")
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDestroyAllWithNoSessionsReturnsZeroCount() async throws {
        let storage = InMemoryStorage()
        let handler = SessionHandlerImpl()

        let result = try await handler.destroyAll(
            input: SessionDestroyAllInput(userId: "user1"),
            storage: storage
        )

        if case .ok(let userId, let count) = result {
            XCTAssertEqual(userId, "user1")
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
