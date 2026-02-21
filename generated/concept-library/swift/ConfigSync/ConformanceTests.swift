// generated: ConfigSync/ConformanceTests.swift

import XCTest
@testable import COPF

final class ConfigSyncConformanceTests: XCTestCase {

    func testConfigSyncInvariant1() async throws {
        // invariant 1: after export, import, export behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let d = "u-test-invariant-002"

        // --- AFTER clause ---
        // export(config: c) -> ok(data: d)
        let step1 = try await handler.export(
            input: ConfigSyncExportInput(config: c),
            storage: storage
        )
        if case .ok(let data) = step1 {
            XCTAssertEqual(data, d)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // import(config: c, data: d) -> ok()
        let step2 = try await handler.import(
            input: ConfigSyncImportInput(config: c, data: d),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // export(config: c) -> ok(data: d)
        let step3 = try await handler.export(
            input: ConfigSyncExportInput(config: c),
            storage: storage
        )
        if case .ok(let data) = step3 {
            XCTAssertEqual(data, d)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testConfigSyncInvariant2() async throws {
        // invariant 2: after override, export behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let d = "u-test-invariant-002"

        // --- AFTER clause ---
        // override(config: c, layer: "production", values: "debug=false") -> ok()
        let step1 = try await handler.override(
            input: ConfigSyncOverrideInput(config: c, layer: "production", values: "debug=false"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // export(config: c) -> ok(data: d)
        let step2 = try await handler.export(
            input: ConfigSyncExportInput(config: c),
            storage: storage
        )
        if case .ok(let data) = step2 {
            XCTAssertEqual(data, d)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
