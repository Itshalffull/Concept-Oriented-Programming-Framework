// generated: JWT/ConformanceTests.swift

import XCTest
@testable import COPF

final class JWTConformanceTests: XCTestCase {

    func testJWTInvariant1() async throws {
        // invariant 1: after generate, verify behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let t = "u-test-invariant-002"

        // --- AFTER clause ---
        // generate(user: x) -> ok(token: t)
        let step1 = try await handler.generate(
            input: JWTGenerateInput(user: x),
            storage: storage
        )
        if case .ok(let token) = step1 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // verify(token: t) -> ok(user: x)
        let step2 = try await handler.verify(
            input: JWTVerifyInput(token: t),
            storage: storage
        )
        if case .ok(let user) = step2 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
