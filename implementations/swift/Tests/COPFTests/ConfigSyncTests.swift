// ConfigSyncTests.swift — Tests for ConfigSync concept

import XCTest
@testable import COPF

final class ConfigSyncTests: XCTestCase {

    // MARK: - overrideConfig

    func testOverrideConfig() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        let result = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "site.name", value: "My Site", layer: "production"),
            storage: storage
        )

        if case .ok(let key) = result {
            XCTAssertEqual(key, "site.name")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testOverrideConfigStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "db.host", value: "localhost", layer: "dev"),
            storage: storage
        )

        let record = try await storage.get(relation: "config", key: "db.host")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["value"] as? String, "localhost")
        XCTAssertEqual(record?["layer"] as? String, "dev")
    }

    func testOverrideConfigOverwritesExisting() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "k1", value: "old", layer: "dev"),
            storage: storage
        )
        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "k1", value: "new", layer: "staging"),
            storage: storage
        )

        let record = try await storage.get(relation: "config", key: "k1")
        XCTAssertEqual(record?["value"] as? String, "new")
        XCTAssertEqual(record?["layer"] as? String, "staging")
    }

    // MARK: - exportConfig

    func testExportConfigEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        let result = try await handler.exportConfig(
            input: ConfigSyncExportConfigInput(),
            storage: storage
        )

        if case .ok(let data) = result {
            XCTAssertEqual(data, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExportConfigWithData() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "theme", value: "dark", layer: "default"),
            storage: storage
        )

        let result = try await handler.exportConfig(
            input: ConfigSyncExportConfigInput(),
            storage: storage
        )

        if case .ok(let data) = result {
            XCTAssertTrue(data.contains("theme"))
            XCTAssertTrue(data.contains("dark"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - importConfig

    func testImportConfig() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        let jsonData = #"[{"key":"site.name","value":"Test","layer":"default"}]"#
        let result = try await handler.importConfig(
            input: ConfigSyncImportConfigInput(data: jsonData),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "config", key: "site.name")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["value"] as? String, "Test")
    }

    func testImportConfigInvalidJSON() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        let result = try await handler.importConfig(
            input: ConfigSyncImportConfigInput(data: "not-json"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok with count 0 but got \(result)")
        }
    }

    // MARK: - diff

    func testDiffNoOverrides() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "k1", value: "v1", layer: "default"),
            storage: storage
        )

        let result = try await handler.diff(
            input: ConfigSyncDiffInput(),
            storage: storage
        )

        if case .ok(let changes) = result {
            XCTAssertEqual(changes, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDiffWithOverrides() async throws {
        let storage = InMemoryStorage()
        let handler = ConfigSyncHandlerImpl()

        _ = try await handler.overrideConfig(
            input: ConfigSyncOverrideConfigInput(key: "k1", value: "v1", layer: "production"),
            storage: storage
        )

        let result = try await handler.diff(
            input: ConfigSyncDiffInput(),
            storage: storage
        )

        if case .ok(let changes) = result {
            XCTAssertTrue(changes.contains("overridden"))
            XCTAssertTrue(changes.contains("k1"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
