// FollowTests.swift — Tests for Follow concept

import XCTest
@testable import Clef

final class FollowTests: XCTestCase {

    // MARK: - follow

    func testFollow() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        let result = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        if case .ok(let user, let target) = result {
            XCTAssertEqual(user, "u1")
            XCTAssertEqual(target, "u2")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testFollowStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let record = try await storage.get(relation: "follow", key: "u1")
        XCTAssertNotNil(record)
        let following = record?["following"] as? [String]
        XCTAssertTrue(following?.contains("u2") ?? false)
    }

    func testFollowMultipleTargets() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )
        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u3"),
            storage: storage
        )

        let record = try await storage.get(relation: "follow", key: "u1")
        let following = record?["following"] as? [String]
        XCTAssertEqual(following?.count, 2)
    }

    func testFollowDuplicateIgnored() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )
        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let record = try await storage.get(relation: "follow", key: "u1")
        let following = record?["following"] as? [String]
        XCTAssertEqual(following?.count, 1)
    }

    // MARK: - unfollow

    func testUnfollow() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let result = try await handler.unfollow(
            input: FollowUnfollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        if case .ok(let user, let target) = result {
            XCTAssertEqual(user, "u1")
            XCTAssertEqual(target, "u2")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnfollowRemovesFromList() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )
        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u3"),
            storage: storage
        )

        _ = try await handler.unfollow(
            input: FollowUnfollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let record = try await storage.get(relation: "follow", key: "u1")
        let following = record?["following"] as? [String]
        XCTAssertEqual(following?.count, 1)
        XCTAssertTrue(following?.contains("u3") ?? false)
    }

    // MARK: - isFollowing

    func testIsFollowingTrue() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let result = try await handler.isFollowing(
            input: FollowIsFollowingInput(user: "u1", target: "u2"),
            storage: storage
        )

        if case .ok(let following) = result {
            XCTAssertTrue(following)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testIsFollowingFalse() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        let result = try await handler.isFollowing(
            input: FollowIsFollowingInput(user: "u1", target: "u2"),
            storage: storage
        )

        if case .ok(let following) = result {
            XCTAssertFalse(following)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testIsFollowingAfterUnfollow() async throws {
        let storage = InMemoryStorage()
        let handler = FollowHandlerImpl()

        _ = try await handler.follow(
            input: FollowFollowInput(user: "u1", target: "u2"),
            storage: storage
        )
        _ = try await handler.unfollow(
            input: FollowUnfollowInput(user: "u1", target: "u2"),
            storage: storage
        )

        let result = try await handler.isFollowing(
            input: FollowIsFollowingInput(user: "u1", target: "u2"),
            storage: storage
        )

        if case .ok(let following) = result {
            XCTAssertFalse(following)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
