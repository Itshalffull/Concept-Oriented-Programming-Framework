// generated: Profile/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProfileConformanceTests: XCTestCase {

    func testProfileInvariant1() async throws {
        // invariant 1: after update, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let u = "u-test-invariant-001"

        // --- AFTER clause ---
        // update(user: u, bio: "Hello world", image: "http://img.png") -> ok(user: u, bio: "Hello world", image: "http://img.png")
        let step1 = try await handler.update(
            input: ProfileUpdateInput(user: u, bio: "Hello world", image: "http://img.png"),
            storage: storage
        )
        if case .ok(let user, let bio, let image) = step1 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(bio, "Hello world")
            XCTAssertEqual(image, "http://img.png")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // get(user: u) -> ok(user: u, bio: "Hello world", image: "http://img.png")
        let step2 = try await handler.get(
            input: ProfileGetInput(user: u),
            storage: storage
        )
        if case .ok(let user, let bio, let image) = step2 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(bio, "Hello world")
            XCTAssertEqual(image, "http://img.png")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
