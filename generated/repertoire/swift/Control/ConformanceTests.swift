// generated: Control/ConformanceTests.swift

import XCTest
@testable import Clef

final class ControlConformanceTests: XCTestCase {

    func testControlInvariant1() async throws {
        // invariant 1: after create, setValue, getValue behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let k = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(control: k, type: "slider", binding: "volume") -> ok()
        let step1 = try await handler.create(
            input: ControlCreateInput(control: k, type: "slider", binding: "volume"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // setValue(control: k, value: "75") -> ok()
        let step2 = try await handler.setValue(
            input: ControlSetValueInput(control: k, value: "75"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // getValue(control: k) -> ok(value: "75")
        let step3 = try await handler.getValue(
            input: ControlGetValueInput(control: k),
            storage: storage
        )
        if case .ok(let value) = step3 {
            XCTAssertEqual(value, "75")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
