// JWTTests.swift — Tests for JWT concept

import XCTest
@testable import COPF

final class JWTTests: XCTestCase {

    // MARK: - generate

    func testGenerate() async throws {
        let storage = InMemoryStorage()
        let handler = JWTHandlerImpl()

        let result = try await handler.generate(
            input: JWTGenerateInput(user: "alice"),
            storage: storage
        )

        if case .ok(let token) = result {
            XCTAssertFalse(token.isEmpty)
            // JWT has 3 parts separated by dots
            let parts = token.split(separator: ".")
            XCTAssertEqual(parts.count, 3)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGenerateDifferentUsers() async throws {
        let storage = InMemoryStorage()
        let handler = JWTHandlerImpl()

        let r1 = try await handler.generate(
            input: JWTGenerateInput(user: "alice"),
            storage: storage
        )
        let r2 = try await handler.generate(
            input: JWTGenerateInput(user: "bob"),
            storage: storage
        )

        if case .ok(let token1) = r1, case .ok(let token2) = r2 {
            XCTAssertNotEqual(token1, token2)
        } else {
            XCTFail("Expected .ok for both tokens")
        }
    }

    // MARK: - verify

    func testVerifyValidToken() async throws {
        let storage = InMemoryStorage()
        let handler = JWTHandlerImpl()

        let generateResult = try await handler.generate(
            input: JWTGenerateInput(user: "alice"),
            storage: storage
        )
        guard case .ok(let token) = generateResult else {
            XCTFail("Expected .ok for generate"); return
        }

        let result = try await handler.verify(
            input: JWTVerifyInput(token: token),
            storage: storage
        )

        if case .ok(let user) = result {
            XCTAssertEqual(user, "alice")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testVerifyInvalidFormat() async throws {
        let storage = InMemoryStorage()
        let handler = JWTHandlerImpl()

        let result = try await handler.verify(
            input: JWTVerifyInput(token: "not-a-valid-token"),
            storage: storage
        )

        if case .error(let message) = result {
            XCTAssertTrue(message.contains("Invalid"))
        } else {
            XCTFail("Expected .error but got \(result)")
        }
    }

    func testVerifyTamperedToken() async throws {
        let storage = InMemoryStorage()
        let handler = JWTHandlerImpl()

        let generateResult = try await handler.generate(
            input: JWTGenerateInput(user: "alice"),
            storage: storage
        )
        guard case .ok(let token) = generateResult else {
            XCTFail("Expected .ok for generate"); return
        }

        // Tamper with the signature by changing a character
        let parts = token.split(separator: ".")
        let tamperedToken = "\(parts[0]).\(parts[1]).tampered_signature"

        let result = try await handler.verify(
            input: JWTVerifyInput(token: tamperedToken),
            storage: storage
        )

        if case .error(let message) = result {
            XCTAssertTrue(message.contains("signature") || message.contains("Invalid"))
        } else {
            XCTFail("Expected .error but got \(result)")
        }
    }

    func testVerifyDifferentSecretFails() async throws {
        let storage = InMemoryStorage()
        let handler1 = JWTHandlerImpl(secret: "secret-key-1")
        let handler2 = JWTHandlerImpl(secret: "secret-key-2")

        let generateResult = try await handler1.generate(
            input: JWTGenerateInput(user: "alice"),
            storage: storage
        )
        guard case .ok(let token) = generateResult else {
            XCTFail("Expected .ok for generate"); return
        }

        let result = try await handler2.verify(
            input: JWTVerifyInput(token: token),
            storage: storage
        )

        if case .error(let message) = result {
            XCTAssertTrue(message.contains("signature") || message.contains("Invalid"))
        } else {
            XCTFail("Expected .error but got \(result)")
        }
    }
}
