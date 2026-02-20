// generated: Echo/ConformanceTests.swift

import XCTest
@testable import COPF

final class EchoConformanceTests: XCTestCase {

    func testEchoInvariant1() async throws {
        // invariant 1: after send, send behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let m = "u-test-invariant-001"

        // --- AFTER clause ---
        // send(id: m, text: "hello") -> ok(id: m, echo: "hello")
        let step1 = try await handler.send(
            input: EchoSendInput(id: m, text: "hello"),
            storage: storage
        )
        if case .ok(let id, let echo) = step1 {
            XCTAssertEqual(id, m)
            XCTAssertEqual(echo, "hello")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // send(id: m, text: "hello") -> ok(id: m, echo: "hello")
        let step2 = try await handler.send(
            input: EchoSendInput(id: m, text: "hello"),
            storage: storage
        )
        if case .ok(let id, let echo) = step2 {
            XCTAssertEqual(id, m)
            XCTAssertEqual(echo, "hello")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
