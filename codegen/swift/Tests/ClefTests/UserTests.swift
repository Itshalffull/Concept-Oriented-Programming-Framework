// UserTests.swift — Tests for User concept

import XCTest
@testable import Clef

final class UserTests: XCTestCase {

    func testRegisterSuccess() async throws {
        let storage = InMemoryStorage()
        let handler = UserHandlerImpl()

        let result = try await handler.register(
            input: UserRegisterInput(user: "u1", name: "alice", email: "alice@example.com"),
            storage: storage
        )

        if case .ok(let user) = result {
            XCTAssertEqual(user, "u1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterDuplicateName() async throws {
        let storage = InMemoryStorage()
        let handler = UserHandlerImpl()

        // Register first user
        _ = try await handler.register(
            input: UserRegisterInput(user: "u1", name: "alice", email: "alice@example.com"),
            storage: storage
        )

        // Try to register with same name
        let result = try await handler.register(
            input: UserRegisterInput(user: "u2", name: "alice", email: "alice2@example.com"),
            storage: storage
        )

        if case .error(let message) = result {
            XCTAssertTrue(message.contains("name"), "Error message should mention 'name': \(message)")
        } else {
            XCTFail("Expected .error but got \(result)")
        }
    }

    func testRegisterDuplicateEmail() async throws {
        let storage = InMemoryStorage()
        let handler = UserHandlerImpl()

        // Register first user
        _ = try await handler.register(
            input: UserRegisterInput(user: "u1", name: "alice", email: "alice@example.com"),
            storage: storage
        )

        // Try to register with same email
        let result = try await handler.register(
            input: UserRegisterInput(user: "u2", name: "bob", email: "alice@example.com"),
            storage: storage
        )

        if case .error(let message) = result {
            XCTAssertTrue(message.contains("email"), "Error message should mention 'email': \(message)")
        } else {
            XCTFail("Expected .error but got \(result)")
        }
    }

    func testRegisterMultipleUsersSuccess() async throws {
        let storage = InMemoryStorage()
        let handler = UserHandlerImpl()

        let result1 = try await handler.register(
            input: UserRegisterInput(user: "u1", name: "alice", email: "alice@example.com"),
            storage: storage
        )
        let result2 = try await handler.register(
            input: UserRegisterInput(user: "u2", name: "bob", email: "bob@example.com"),
            storage: storage
        )

        if case .ok(let user1) = result1 {
            XCTAssertEqual(user1, "u1")
        } else {
            XCTFail("Expected .ok for first user")
        }

        if case .ok(let user2) = result2 {
            XCTAssertEqual(user2, "u2")
        } else {
            XCTFail("Expected .ok for second user")
        }
    }

    func testRegisterStoresUserInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = UserHandlerImpl()

        _ = try await handler.register(
            input: UserRegisterInput(user: "u1", name: "alice", email: "alice@example.com"),
            storage: storage
        )

        // Verify the user is actually stored
        let record = try await storage.get(relation: "user", key: "u1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["name"] as? String, "alice")
        XCTAssertEqual(record?["email"] as? String, "alice@example.com")
    }
}
