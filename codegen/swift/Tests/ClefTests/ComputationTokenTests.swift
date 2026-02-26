// ComputationTokenTests.swift — Tests for ComputationToken concept

import XCTest
@testable import Clef

final class ComputationTokenTests: XCTestCase {

    // MARK: - registerProvider

    func testRegisterProvider() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        let result = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{\"format\":\"ISO\"}"),
            storage: storage
        )

        if case .ok(let tokenType) = result {
            XCTAssertEqual(tokenType, "date")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterProviderStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "user", resolverConfig: "{\"field\":\"name\"}"),
            storage: storage
        )

        let record = try await storage.get(relation: "token_type", key: "user")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["tokenType"] as? String, "user")
        XCTAssertEqual(record?["resolverConfig"] as? String, "{\"field\":\"name\"}")
    }

    func testRegisterMultipleProviders() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )
        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "user", resolverConfig: "{}"),
            storage: storage
        )

        let date = try await storage.get(relation: "token_type", key: "date")
        let user = try await storage.get(relation: "token_type", key: "user")
        XCTAssertNotNil(date)
        XCTAssertNotNil(user)
    }

    // MARK: - replace

    func testReplace() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )

        let result = try await handler.replace(
            input: ComputationTokenReplaceInput(text: "Today is [date:now]", context: "page"),
            storage: storage
        )

        if case .ok(let resultText) = result {
            XCTAssertTrue(resultText.contains("resolved(date, context=page)"))
            XCTAssertFalse(resultText.contains("[date:"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReplaceNoTokensRegistered() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        let result = try await handler.replace(
            input: ComputationTokenReplaceInput(text: "No tokens here", context: "page"),
            storage: storage
        )

        if case .ok(let resultText) = result {
            XCTAssertEqual(resultText, "No tokens here")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReplaceNoMatchingTokens() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )

        let result = try await handler.replace(
            input: ComputationTokenReplaceInput(text: "Hello [user:name]", context: "page"),
            storage: storage
        )

        if case .ok(let resultText) = result {
            XCTAssertEqual(resultText, "Hello [user:name]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - getAvailableTokens

    func testGetAvailableTokens() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )
        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "user", resolverConfig: "{}"),
            storage: storage
        )

        let result = try await handler.getAvailableTokens(
            input: ComputationTokenGetAvailableTokensInput(context: "page"),
            storage: storage
        )

        if case .ok(let tokens) = result {
            XCTAssertTrue(tokens.contains("date"))
            XCTAssertTrue(tokens.contains("user"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetAvailableTokensEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        let result = try await handler.getAvailableTokens(
            input: ComputationTokenGetAvailableTokensInput(context: "page"),
            storage: storage
        )

        if case .ok(let tokens) = result {
            XCTAssertEqual(tokens, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - scan

    func testScan() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )
        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "user", resolverConfig: "{}"),
            storage: storage
        )

        let result = try await handler.scan(
            input: ComputationTokenScanInput(text: "Hello [date:now] and [user:name]"),
            storage: storage
        )

        if case .ok(let matches) = result {
            XCTAssertTrue(matches.contains("date"))
            XCTAssertTrue(matches.contains("user"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testScanNoMatches() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        _ = try await handler.registerProvider(
            input: ComputationTokenRegisterProviderInput(tokenType: "date", resolverConfig: "{}"),
            storage: storage
        )

        let result = try await handler.scan(
            input: ComputationTokenScanInput(text: "No tokens here"),
            storage: storage
        )

        if case .ok(let matches) = result {
            XCTAssertEqual(matches, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testScanEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ComputationTokenHandlerImpl()

        let result = try await handler.scan(
            input: ComputationTokenScanInput(text: ""),
            storage: storage
        )

        if case .ok(let matches) = result {
            XCTAssertEqual(matches, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
