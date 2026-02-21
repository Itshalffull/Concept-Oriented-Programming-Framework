// AccessControlTests.swift — Tests for AccessControl concept

import XCTest
@testable import COPF

final class AccessControlTests: XCTestCase {

    // MARK: - check

    func testCheckReturnsNeutralByDefault() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.check(
            input: AccessControlCheckInput(entityId: "doc1", operation: "read", userId: "user1"),
            storage: storage
        )

        if case .ok(let resultStr, let cacheTags) = result {
            XCTAssertEqual(resultStr, "neutral")
            XCTAssertFalse(cacheTags.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckReturnsCacheTagsWithEntityInfo() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.check(
            input: AccessControlCheckInput(entityId: "doc1", operation: "write", userId: "user2"),
            storage: storage
        )

        if case .ok(_, let cacheTags) = result {
            XCTAssertTrue(cacheTags.contains("entity:doc1"))
            XCTAssertTrue(cacheTags.contains("user:user2"))
            XCTAssertTrue(cacheTags.contains("op:write"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckWithDifferentOperations() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let r1 = try await handler.check(
            input: AccessControlCheckInput(entityId: "doc1", operation: "read", userId: "user1"),
            storage: storage
        )
        let r2 = try await handler.check(
            input: AccessControlCheckInput(entityId: "doc1", operation: "delete", userId: "user1"),
            storage: storage
        )

        if case .ok(let result1, _) = r1, case .ok(let result2, _) = r2 {
            XCTAssertEqual(result1, "neutral")
            XCTAssertEqual(result2, "neutral")
        } else {
            XCTFail("Expected .ok for both")
        }
    }

    // MARK: - orIf

    func testOrIfAllowedWins() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.orIf(
            input: AccessControlOrIfInput(resultA: "allowed", resultB: "forbidden"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "allowed")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testOrIfNeutralWhenNoAllowed() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.orIf(
            input: AccessControlOrIfInput(resultA: "neutral", resultB: "forbidden"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "neutral")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testOrIfForbiddenWhenBothForbidden() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.orIf(
            input: AccessControlOrIfInput(resultA: "forbidden", resultB: "forbidden"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "forbidden")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - andIf

    func testAndIfForbiddenWins() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.andIf(
            input: AccessControlAndIfInput(resultA: "allowed", resultB: "forbidden"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "forbidden")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAndIfNeutralWhenNoForbidden() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.andIf(
            input: AccessControlAndIfInput(resultA: "allowed", resultB: "neutral"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "neutral")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAndIfAllowedWhenBothAllowed() async throws {
        let storage = InMemoryStorage()
        let handler = AccessControlHandlerImpl()

        let result = try await handler.andIf(
            input: AccessControlAndIfInput(resultA: "allowed", resultB: "allowed"),
            storage: storage
        )

        if case .ok(let resultStr) = result {
            XCTAssertEqual(resultStr, "allowed")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
