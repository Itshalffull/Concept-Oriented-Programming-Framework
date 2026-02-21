// generated: Template/ConformanceTests.swift

import XCTest
@testable import COPF

final class TemplateConformanceTests: XCTestCase {

    func testTemplateInvariant1() async throws {
        // invariant 1: after define, instantiate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // define(template: t, body: "Hello {{name}}", variables: "name") -> ok()
        let step1 = try await handler.define(
            input: TemplateDefineInput(template: t, body: "Hello {{name}}", variables: "name"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // instantiate(template: t, values: "name=World") -> ok(content: "Hello World")
        let step2 = try await handler.instantiate(
            input: TemplateInstantiateInput(template: t, values: "name=World"),
            storage: storage
        )
        if case .ok(let content) = step2 {
            XCTAssertEqual(content, "Hello World")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
