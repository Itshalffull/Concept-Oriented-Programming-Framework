// generated: Registry/ConformanceTests.swift

import XCTest
@testable import Clef

final class RegistryConformanceTests: XCTestCase {

    func testRegistryInvariant1() async throws {
        // invariant 1: after register, heartbeat behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"

        // --- AFTER clause ---
        // register(uri: "test://concept-a", transport: "in-process") -> ok(concept: c)
        let step1 = try await handler.register(
            input: RegistryRegisterInput(uri: "test://concept-a", transport: "in-process"),
            storage: storage
        )
        if case .ok(let concept) = step1 {
            XCTAssertEqual(concept, c)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // heartbeat(uri: "test://concept-a") -> ok(available: true)
        let step2 = try await handler.heartbeat(
            input: RegistryHeartbeatInput(uri: "test://concept-a"),
            storage: storage
        )
        if case .ok(let available) = step2 {
            XCTAssertEqual(available, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
