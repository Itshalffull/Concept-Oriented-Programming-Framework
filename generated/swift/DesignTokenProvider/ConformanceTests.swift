// generated: DesignTokenProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class DesignTokenProviderConformanceTests: XCTestCase {

    func testDesignTokenProviderInitializeIdempotent() async throws {
        // invariant: calling initialize twice returns alreadyInitialized on second call
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:design-token"

        // --- AFTER clause ---
        let step1 = try await handler.initialize(
            input: DesignTokenProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .ok(let ref) = step1 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.initialize(
            input: DesignTokenProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .alreadyInitialized(let ref) = step2 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .alreadyInitialized, got \(step2)")
        }
    }

    func testDesignTokenProviderResolveNotFound() async throws {
        // invariant: resolving a non-existent token returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.resolve(
            input: DesignTokenProviderResolveInput(tokenName: "color-primary", themeName: "light"),
            storage: storage
        )
        if case .notFound(let name) = step1 {
            XCTAssertEqual(name, "color-primary")
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }
    }

    func testDesignTokenProviderGetTokensAndExport() async throws {
        // invariant: getTokens returns empty/notFound when no tokens exist for theme
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.getTokens(
            input: DesignTokenProviderGetTokensInput(themeName: "dark"),
            storage: storage
        )
        if case .notFound(let message) = step1 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }

        // invariant: export returns notFound when no tokens to export
        let step2 = try await handler.export(
            input: DesignTokenProviderExportInput(themeName: "dark", format: "css"),
            storage: storage
        )
        if case .notFound(let message) = step2 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step2)")
        }
    }

}
