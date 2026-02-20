// generated: Telemetry/ConformanceTests.swift

import XCTest
@testable import COPF

final class TelemetryConformanceTests: XCTestCase {

    func testTelemetryInvariant1() async throws {
        // invariant 1: after configure, configure behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        // configure(exporter: "stdout") -> ok()
        let step1 = try await handler.configure(
            input: TelemetryConfigureInput(exporter: "stdout"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // configure(exporter: "stdout") -> ok()
        let step2 = try await handler.configure(
            input: TelemetryConfigureInput(exporter: "stdout"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
    }

}
