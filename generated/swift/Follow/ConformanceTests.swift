// generated: Follow/ConformanceTests.swift

import XCTest
@testable import COPF

final class FollowConformanceTests: XCTestCase {

    func testFollowInvariant1() async throws {
        // invariant 1: after follow, isFollowing, unfollow behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let u = "u-test-invariant-001"

        // --- AFTER clause ---
        // follow(user: u, target: "u2") -> ok(user: u, target: "u2")
        let step1 = try await handler.follow(
            input: FollowFollowInput(user: u, target: "u2"),
            storage: storage
        )
        if case .ok(let user, let target) = step1 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(target, "u2")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // isFollowing(user: u, target: "u2") -> ok(following: true)
        let step2 = try await handler.isFollowing(
            input: FollowIsFollowingInput(user: u, target: "u2"),
            storage: storage
        )
        if case .ok(let following) = step2 {
            XCTAssertEqual(following, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // unfollow(user: u, target: "u2") -> ok(user: u, target: "u2")
        let step3 = try await handler.unfollow(
            input: FollowUnfollowInput(user: u, target: "u2"),
            storage: storage
        )
        if case .ok(let user, let target) = step3 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(target, "u2")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
