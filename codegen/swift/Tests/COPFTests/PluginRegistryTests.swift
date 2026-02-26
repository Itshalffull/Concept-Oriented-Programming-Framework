// PluginRegistryTests.swift — Tests for PluginRegistry concept

import XCTest
@testable import COPF

final class PluginRegistryTests: XCTestCase {

    // MARK: - registerType

    func testRegisterType() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        let result = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "formatter", definition: "text formatting plugins"),
            storage: storage
        )

        if case .ok(let typeId) = result {
            XCTAssertEqual(typeId, "formatter")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterTypeStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        _ = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "filter", definition: "content filters"),
            storage: storage
        )

        let record = try await storage.get(relation: "plugin_type", key: "filter")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["definition"] as? String, "content filters")
    }

    // MARK: - registerPlugin

    func testRegisterPlugin() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        _ = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "formatter", definition: "formatters"),
            storage: storage
        )

        let result = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "formatter", pluginId: "markdown", config: "{}"),
            storage: storage
        )

        if case .ok(let typeId, let pluginId) = result {
            XCTAssertEqual(typeId, "formatter")
            XCTAssertEqual(pluginId, "markdown")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterPluginTypeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        let result = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "nonexistent", pluginId: "p1", config: "{}"),
            storage: storage
        )

        if case .typeNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .typeNotfound but got \(result)")
        }
    }

    func testRegisterMultiplePlugins() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        _ = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "filter", definition: "filters"),
            storage: storage
        )

        _ = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "filter", pluginId: "html", config: "{}"),
            storage: storage
        )
        _ = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "filter", pluginId: "markdown", config: "{}"),
            storage: storage
        )

        let discoverResult = try await handler.discover(
            input: PluginRegistryDiscoverInput(typeId: "filter"),
            storage: storage
        )

        if case .ok(_, let plugins) = discoverResult {
            XCTAssertTrue(plugins.contains("html"))
            XCTAssertTrue(plugins.contains("markdown"))
        } else {
            XCTFail("Expected .ok but got \(discoverResult)")
        }
    }

    // MARK: - discover

    func testDiscoverPlugins() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        _ = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "widget", definition: "widgets"),
            storage: storage
        )
        _ = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "widget", pluginId: "calendar", config: "{}"),
            storage: storage
        )

        let result = try await handler.discover(
            input: PluginRegistryDiscoverInput(typeId: "widget"),
            storage: storage
        )

        if case .ok(let typeId, let plugins) = result {
            XCTAssertEqual(typeId, "widget")
            XCTAssertTrue(plugins.contains("calendar"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDiscoverPluginsTypeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        let result = try await handler.discover(
            input: PluginRegistryDiscoverInput(typeId: "missing"),
            storage: storage
        )

        if case .typeNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .typeNotfound but got \(result)")
        }
    }

    // MARK: - createInstance

    func testCreateInstance() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        _ = try await handler.registerType(
            input: PluginRegistryRegisterTypeInput(typeId: "formatter", definition: "fmt"),
            storage: storage
        )
        _ = try await handler.registerPlugin(
            input: PluginRegistryRegisterPluginInput(typeId: "formatter", pluginId: "md", config: "{}"),
            storage: storage
        )

        let result = try await handler.createInstance(
            input: PluginRegistryCreateInstanceInput(typeId: "formatter", pluginId: "md", config: "{\"strict\":true}"),
            storage: storage
        )

        if case .ok(let instanceId) = result {
            XCTAssertFalse(instanceId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateInstanceNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = PluginRegistryHandlerImpl()

        let result = try await handler.createInstance(
            input: PluginRegistryCreateInstanceInput(typeId: "missing", pluginId: "p1", config: "{}"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
