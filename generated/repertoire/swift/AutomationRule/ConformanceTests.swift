// generated: AutomationRule/ConformanceTests.swift

import XCTest
@testable import COPF

final class AutomationRuleConformanceTests: XCTestCase {

    func testAutomationRuleInvariant1() async throws {
        // invariant 1: after define, enable, evaluate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"

        // --- AFTER clause ---
        // define(rule: r, trigger: "on_save", conditions: "status == draft", actions: "notify_reviewer") -> ok()
        let step1 = try await handler.define(
            input: AutomationRuleDefineInput(rule: r, trigger: "on_save", conditions: "status == draft", actions: "notify_reviewer"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // enable(rule: r) -> ok()
        let step2 = try await handler.enable(
            input: AutomationRuleEnableInput(rule: r),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // evaluate(rule: r, event: "on_save") -> ok(matched: true)
        let step3 = try await handler.evaluate(
            input: AutomationRuleEvaluateInput(rule: r, event: "on_save"),
            storage: storage
        )
        if case .ok(let matched) = step3 {
            XCTAssertEqual(matched, true)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
