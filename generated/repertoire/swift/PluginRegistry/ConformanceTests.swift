// generated: PluginRegistry/ConformanceTests.swift

import XCTest
@testable import COPF

final class PluginRegistryConformanceTests: XCTestCase {

    func testPluginRegistryInvariant1() async throws {
        // invariant 1: after discover, createInstance, getDefinitions behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let ps = "u-test-invariant-001"
        let p = "u-test-invariant-002"
        let i = "u-test-invariant-003"
        let ds = "u-test-invariant-004"

        // --- AFTER clause ---
        // discover(type: "formatter") -> ok(plugins: ps)
        let step1 = try await handler.discover(
            input: PluginRegistryDiscoverInput(type: "formatter"),
            storage: storage
        )
        if case .ok(let plugins) = step1 {
            XCTAssertEqual(plugins, ps)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // createInstance(plugin: p, config: "{}") -> ok(instance: i)
        let step2 = try await handler.createInstance(
            input: PluginRegistryCreateInstanceInput(plugin: p, config: "{}"),
            storage: storage
        )
        if case .ok(let instance) = step2 {
            XCTAssertEqual(instance, i)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // getDefinitions(type: "formatter") -> ok(definitions: ds)
        let step3 = try await handler.getDefinitions(
            input: PluginRegistryGetDefinitionsInput(type: "formatter"),
            storage: storage
        )
        if case .ok(let definitions) = step3 {
            XCTAssertEqual(definitions, ds)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
