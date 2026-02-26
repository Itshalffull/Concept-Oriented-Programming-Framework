// generated: User/ConformanceTests.swift

import XCTest
@testable import Clef

final class UserConformanceTests: XCTestCase {

    func testUserInvariant1() async throws {
        // invariant 1: after register, register behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let y = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
        let step1 = try await handler.register(
            input: UserRegisterInput(user: x, name: "alice", email: "a@b.com"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // register(user: y, name: "alice", email: "c@d.com") -> error(message: "name already taken")
        let step2 = try await handler.register(
            input: UserRegisterInput(user: y, name: "alice", email: "c@d.com"),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, "name already taken")
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
