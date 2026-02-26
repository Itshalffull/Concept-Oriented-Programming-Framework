// generated: Token/ConformanceTests.swift

import XCTest
@testable import Clef

final class TokenConformanceTests: XCTestCase {

    func testTokenInvariant1() async throws {
        // invariant 1: after registerProvider, replace behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerProvider(token: t, provider: "userMailProvider") -> ok()
        let step1 = try await handler.registerProvider(
            input: TokenRegisterProviderInput(token: t, provider: "userMailProvider"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // replace(text: "Contact [user:mail]", context: "user") -> ok(result: "Contact user@example.com")
        let step2 = try await handler.replace(
            input: TokenReplaceInput(text: "Contact [user:mail]", context: "user"),
            storage: storage
        )
        if case .ok(let result) = step2 {
            XCTAssertEqual(result, "Contact user@example.com")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
