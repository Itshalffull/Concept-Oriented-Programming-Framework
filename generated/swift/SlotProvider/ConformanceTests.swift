// generated: SlotProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class SlotProviderConformanceTests: XCTestCase {

    func testSlotProviderInitializeIdempotent() async throws {
        // invariant: calling initialize twice returns alreadyInitialized on second call
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:slot"

        // --- AFTER clause ---
        let step1 = try await handler.initialize(
            input: SlotProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .ok(let ref) = step1 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.initialize(
            input: SlotProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .alreadyInitialized(let ref) = step2 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .alreadyInitialized, got \(step2)")
        }
    }

    func testSlotProviderDefineAndFill() async throws {
        // invariant: after define, fill succeeds; after clear, slot is empty
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let slotName = "header"

        // --- AFTER clause ---
        let step1 = try await handler.define(
            input: SlotProviderDefineInput(slotName: slotName, description: "Page header slot"),
            storage: storage
        )
        if case .ok(let name) = step1 {
            XCTAssertEqual(name, slotName)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // fill the slot
        let step2 = try await handler.fill(
            input: SlotProviderFillInput(slotName: slotName, content: "<h1>Hello</h1>"),
            storage: storage
        )
        if case .ok(let name) = step2 {
            XCTAssertEqual(name, slotName)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // clear the slot
        let step3 = try await handler.clear(
            input: SlotProviderClearInput(slotName: slotName),
            storage: storage
        )
        if case .ok(let name) = step3 {
            XCTAssertEqual(name, slotName)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testSlotProviderGetSlotsReflectsDefine() async throws {
        // invariant: getSlots returns all defined slot names
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let _ = try await handler.define(
            input: SlotProviderDefineInput(slotName: "sidebar", description: "Sidebar content area"),
            storage: storage
        )
        let _ = try await handler.define(
            input: SlotProviderDefineInput(slotName: "footer", description: "Footer content area"),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.getSlots(
            input: SlotProviderGetSlotsInput(),
            storage: storage
        )
        if case .ok(let slotNames) = step3 {
            XCTAssertTrue(slotNames.contains("sidebar"))
            XCTAssertTrue(slotNames.contains("footer"))
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
