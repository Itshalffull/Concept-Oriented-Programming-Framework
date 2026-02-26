// generated: Validator/ConformanceTests.swift

import XCTest
@testable import Clef

final class ValidatorConformanceTests: XCTestCase {

    func testValidatorInvariant1() async throws {
        // invariant 1: after registerConstraint, addRule, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerConstraint(validator: v, constraint: "required") -> ok()
        let step1 = try await handler.registerConstraint(
            input: ValidatorRegisterConstraintInput(validator: v, constraint: "required"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addRule(validator: v, field: "email", rule: "required|email") -> ok()
        let step2 = try await handler.addRule(
            input: ValidatorAddRuleInput(validator: v, field: "email", rule: "required|email"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // validate(validator: v, data: "{"email":""}") -> ok(valid: false, errors: "email is required")
        let step3 = try await handler.validate(
            input: ValidatorValidateInput(validator: v, data: "{"email":""}"),
            storage: storage
        )
        if case .ok(let valid, let errors) = step3 {
            XCTAssertEqual(valid, false)
            XCTAssertEqual(errors, "email is required")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
