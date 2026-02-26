// generated: FormBuilder/ConformanceTests.swift

import XCTest
@testable import Clef

final class FormBuilderConformanceTests: XCTestCase {

    func testFormBuilderInvariant1() async throws {
        // invariant 1: after buildForm, registerWidget behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"

        // --- AFTER clause ---
        // buildForm(form: f, schema: "user-profile") -> ok(definition: _)
        let step1 = try await handler.buildForm(
            input: FormBuilderBuildFormInput(form: f, schema: "user-profile"),
            storage: storage
        )
        if case .ok(let definition) = step1 {
            XCTAssertEqual(definition, _)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
        let step2 = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(form: f, type: "date", widget: "datepicker"),
            storage: storage
        )
        if case .ok(let form) = step2 {
            XCTAssertEqual(form, f)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testFormBuilderInvariant2() async throws {
        // invariant 2: after registerWidget, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
        let step1 = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(form: f, type: "date", widget: "datepicker"),
            storage: storage
        )
        if case .ok(let form) = step1 {
            XCTAssertEqual(form, f)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // validate(form: f, data: "name=Alice&dob=2000-01-01") -> ok(valid: true, errors: "")
        let step2 = try await handler.validate(
            input: FormBuilderValidateInput(form: f, data: "name=Alice&dob=2000-01-01"),
            storage: storage
        )
        if case .ok(let valid, let errors) = step2 {
            XCTAssertEqual(valid, true)
            XCTAssertEqual(errors, "")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
