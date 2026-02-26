// AuthenticationTests.swift — Tests for Authentication concept

import XCTest
@testable import Clef

final class AuthenticationTests: XCTestCase {

    // MARK: - register

    func testRegisterReturnsOkWithUserId() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        let result = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "password123"),
            storage: storage
        )

        if case .ok(let userId) = result {
            XCTAssertEqual(userId, "user1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterDuplicateReturnsAlreadyExists() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "password123"),
            storage: storage
        )

        let result = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "password456"),
            storage: storage
        )

        if case .alreadyExists(let userId) = result {
            XCTAssertEqual(userId, "user1")
        } else {
            XCTFail("Expected .alreadyExists but got \(result)")
        }
    }

    func testRegisterStoresAccount() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        let record = try await storage.get(relation: "account", key: "user1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["userId"] as? String, "user1")
    }

    // MARK: - login

    func testLoginWithCorrectCredentialsReturnsToken() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        let result = try await handler.login(
            input: AuthenticationLoginInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        if case .ok(let userId, let token) = result {
            XCTAssertEqual(userId, "user1")
            XCTAssertFalse(token.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testLoginWithWrongCredentialsReturnsInvalid() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        let result = try await handler.login(
            input: AuthenticationLoginInput(userId: "user1", credentials: "wrong"),
            storage: storage
        )

        if case .invalidCredentials = result {
            // expected
        } else {
            XCTFail("Expected .invalidCredentials but got \(result)")
        }
    }

    func testLoginWithMissingUserReturnsInvalid() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        let result = try await handler.login(
            input: AuthenticationLoginInput(userId: "missing", credentials: "secret"),
            storage: storage
        )

        if case .invalidCredentials = result {
            // expected
        } else {
            XCTFail("Expected .invalidCredentials but got \(result)")
        }
    }

    // MARK: - logout

    func testLogoutRegisteredUserReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        let result = try await handler.logout(
            input: AuthenticationLogoutInput(userId: "user1"),
            storage: storage
        )

        if case .ok(let userId) = result {
            XCTAssertEqual(userId, "user1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testLogoutMissingUserReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        let result = try await handler.logout(
            input: AuthenticationLogoutInput(userId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - resetPassword

    func testResetPasswordReturnsResetToken() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        _ = try await handler.register(
            input: AuthenticationRegisterInput(userId: "user1", credentials: "secret"),
            storage: storage
        )

        let result = try await handler.resetPassword(
            input: AuthenticationResetPasswordInput(userId: "user1"),
            storage: storage
        )

        if case .ok(let userId, let resetToken) = result {
            XCTAssertEqual(userId, "user1")
            XCTAssertFalse(resetToken.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testResetPasswordMissingUserReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AuthenticationHandlerImpl()

        let result = try await handler.resetPassword(
            input: AuthenticationResetPasswordInput(userId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
