// generated: Component/ConformanceTests.swift

import XCTest
@testable import COPF

final class ComponentConformanceTests: XCTestCase {

    func testComponentInvariant1() async throws {
        // invariant 1: after register, place, render behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"

        // --- AFTER clause ---
        // register(component: c, config: "hero-banner") -> ok()
        let step1 = try await handler.register(
            input: ComponentRegisterInput(component: c, config: "hero-banner"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // place(component: c, region: "header") -> ok()
        let step2 = try await handler.place(
            input: ComponentPlaceInput(component: c, region: "header"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // render(component: c, context: "homepage") -> ok(output: "hero-banner:header:homepage")
        let step3 = try await handler.render(
            input: ComponentRenderInput(component: c, context: "homepage"),
            storage: storage
        )
        if case .ok(let output) = step3 {
            XCTAssertEqual(output, "hero-banner:header:homepage")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
