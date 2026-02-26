// generated: Schema/ConformanceTests.swift

import XCTest
@testable import Clef

final class SchemaConformanceTests: XCTestCase {

    func testSchemaInvariant1() async throws {
        // invariant 1: after defineSchema, addField, applyTo behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"

        // --- AFTER clause ---
        // defineSchema(schema: s, fields: "title,body") -> ok()
        let step1 = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(schema: s, fields: "title,body"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addField(schema: s, field: "author") -> ok()
        let step2 = try await handler.addField(
            input: SchemaAddFieldInput(schema: s, field: "author"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // applyTo(entity: "page-1", schema: s) -> ok()
        let step3 = try await handler.applyTo(
            input: SchemaApplyToInput(entity: "page-1", schema: s),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
    }

}
