// ProfileTests.swift — Tests for Profile concept

import XCTest
@testable import Clef

final class ProfileTests: XCTestCase {

    // MARK: - update

    func testUpdateProfile() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        let result = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "Swift developer", image: "alice.jpg"),
            storage: storage
        )

        if case .ok(let user, let bio, let image) = result {
            XCTAssertEqual(user, "alice")
            XCTAssertEqual(bio, "Swift developer")
            XCTAssertEqual(image, "alice.jpg")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUpdateProfileStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        _ = try await handler.update(
            input: ProfileUpdateInput(user: "bob", bio: "Rustacean", image: "bob.png"),
            storage: storage
        )

        let record = try await storage.get(relation: "profile", key: "bob")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["bio"] as? String, "Rustacean")
        XCTAssertEqual(record?["image"] as? String, "bob.png")
    }

    func testUpdateProfileOverwrites() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        _ = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "Old bio", image: "old.jpg"),
            storage: storage
        )
        _ = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "New bio", image: "new.jpg"),
            storage: storage
        )

        let record = try await storage.get(relation: "profile", key: "alice")
        XCTAssertEqual(record?["bio"] as? String, "New bio")
        XCTAssertEqual(record?["image"] as? String, "new.jpg")
    }

    // MARK: - get

    func testGetProfile() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        _ = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "Developer", image: "avatar.jpg"),
            storage: storage
        )

        let result = try await handler.get(
            input: ProfileGetInput(user: "alice"),
            storage: storage
        )

        if case .ok(let user, let bio, let image) = result {
            XCTAssertEqual(user, "alice")
            XCTAssertEqual(bio, "Developer")
            XCTAssertEqual(image, "avatar.jpg")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetProfileNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        let result = try await handler.get(
            input: ProfileGetInput(user: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testGetProfileAfterUpdate() async throws {
        let storage = InMemoryStorage()
        let handler = ProfileHandlerImpl()

        _ = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "v1", image: "a.jpg"),
            storage: storage
        )
        _ = try await handler.update(
            input: ProfileUpdateInput(user: "alice", bio: "v2", image: "b.jpg"),
            storage: storage
        )

        let result = try await handler.get(
            input: ProfileGetInput(user: "alice"),
            storage: storage
        )

        if case .ok(_, let bio, let image) = result {
            XCTAssertEqual(bio, "v2")
            XCTAssertEqual(image, "b.jpg")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
