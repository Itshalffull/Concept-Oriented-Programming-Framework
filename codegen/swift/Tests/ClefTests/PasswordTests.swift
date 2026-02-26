// PasswordTests.swift — Tests for Password concept

import XCTest
@testable import Clef

final class PasswordTests: XCTestCase {

    func testSetPasswordSuccess() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "securepassword123"),
            storage: storage
        )

        if case .ok(let user) = result {
            XCTAssertEqual(user, "u1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetPasswordTooShort() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "short"),
            storage: storage
        )

        if case .invalid(let message) = result {
            XCTAssertTrue(message.contains("8"), "Error should mention minimum length: \(message)")
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    func testSetPasswordExactlyEightChars() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "12345678"),
            storage: storage
        )

        if case .ok(let user) = result {
            XCTAssertEqual(user, "u1")
        } else {
            XCTFail("Expected .ok for 8-char password but got \(result)")
        }
    }

    func testCheckPasswordCorrect() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        _ = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "securepassword123"),
            storage: storage
        )

        let result = try await handler.check(
            input: PasswordCheckInput(user: "u1", password: "securepassword123"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid, "Correct password should validate to true")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckPasswordIncorrect() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        _ = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "securepassword123"),
            storage: storage
        )

        let result = try await handler.check(
            input: PasswordCheckInput(user: "u1", password: "wrongpassword"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertFalse(valid, "Wrong password should validate to false")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckPasswordNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.check(
            input: PasswordCheckInput(user: "nonexistent", password: "password123"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"), "Error should mention the user: \(message)")
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testValidatePasswordValid() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.validate(
            input: PasswordValidateInput(password: "longpassword"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidatePasswordInvalid() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        let result = try await handler.validate(
            input: PasswordValidateInput(password: "short"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertFalse(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetPasswordOverwritesPrevious() async throws {
        let storage = InMemoryStorage()
        let handler = PasswordHandlerImpl()

        _ = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "firstpassword"),
            storage: storage
        )

        _ = try await handler.set(
            input: PasswordSetInput(user: "u1", password: "secondpassword"),
            storage: storage
        )

        // Old password should no longer work
        let result1 = try await handler.check(
            input: PasswordCheckInput(user: "u1", password: "firstpassword"),
            storage: storage
        )
        if case .ok(let valid) = result1 {
            XCTAssertFalse(valid, "Old password should not be valid after reset")
        }

        // New password should work
        let result2 = try await handler.check(
            input: PasswordCheckInput(user: "u1", password: "secondpassword"),
            storage: storage
        )
        if case .ok(let valid) = result2 {
            XCTAssertTrue(valid, "New password should be valid")
        }
    }
}
