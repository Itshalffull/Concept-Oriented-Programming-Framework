// generated: Password/ConformanceTests.swift

import XCTest
@testable import COPF

final class PasswordConformanceTests: XCTestCase {

    func testPasswordInvariant1() async throws {
        // invariant 1: after set, check, check behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(user: x, password: "secret123") -> ok(user: x)
        let step1 = try await handler.set(
            input: PasswordSetInput(user: x, password: "secret123"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // check(user: x, password: "secret123") -> ok(valid: true)
        let step2 = try await handler.check(
            input: PasswordCheckInput(user: x, password: "secret123"),
            storage: storage
        )
        if case .ok(let valid) = step2 {
            XCTAssertEqual(valid, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // check(user: x, password: "wrongpass") -> ok(valid: false)
        let step3 = try await handler.check(
            input: PasswordCheckInput(user: x, password: "wrongpass"),
            storage: storage
        )
        if case .ok(let valid) = step3 {
            XCTAssertEqual(valid, false)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
