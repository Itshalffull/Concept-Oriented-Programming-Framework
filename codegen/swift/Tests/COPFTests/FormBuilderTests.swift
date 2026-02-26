// FormBuilderTests.swift — Tests for FormBuilder concept

import XCTest
@testable import Clef

final class FormBuilderTests: XCTestCase {

    // MARK: - buildForm

    func testBuildForm() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        // Pre-populate a schema in storage
        try await storage.put(
            relation: "schema",
            key: "s1",
            value: ["id": "s1", "fields": "[\"title\",\"body\"]"]
        )

        let result = try await handler.buildForm(
            input: FormBuilderBuildFormInput(schemaId: "s1", mode: "create", entityId: "e1"),
            storage: storage
        )

        if case .ok(let formId, let fields) = result {
            XCTAssertFalse(formId.isEmpty)
            XCTAssertEqual(fields, "[\"title\",\"body\"]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testBuildFormSchemaNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.buildForm(
            input: FormBuilderBuildFormInput(schemaId: "nonexistent", mode: "edit", entityId: "e1"),
            storage: storage
        )

        if case .schemaNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .schemaNotfound but got \(result)")
        }
    }

    func testBuildFormStoresFormDefinition() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        try await storage.put(
            relation: "schema",
            key: "s1",
            value: ["id": "s1", "fields": "[]"]
        )

        let result = try await handler.buildForm(
            input: FormBuilderBuildFormInput(schemaId: "s1", mode: "create", entityId: "e1"),
            storage: storage
        )

        if case .ok(let formId, _) = result {
            let record = try await storage.get(relation: "form_def", key: formId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["schemaId"] as? String, "s1")
            XCTAssertEqual(record?["mode"] as? String, "create")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - validateForm

    func testValidateFormWithValidJSON() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.validateForm(
            input: FormBuilderValidateFormInput(formData: "{\"title\":\"Hello\"}", schemaId: "s1"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateFormWithInvalidJSON() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.validateForm(
            input: FormBuilderValidateFormInput(formData: "not valid json", schemaId: "s1"),
            storage: storage
        )

        if case .invalid(let errors) = result {
            XCTAssertTrue(errors.contains("Invalid JSON"))
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    func testValidateFormWithEmptyObject() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.validateForm(
            input: FormBuilderValidateFormInput(formData: "{}", schemaId: "s1"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - processSubmission

    func testProcessSubmission() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.processSubmission(
            input: FormBuilderProcessSubmissionInput(formData: "{\"title\":\"Test\"}", nodeId: "n1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testProcessSubmissionInvalidJSON() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.processSubmission(
            input: FormBuilderProcessSubmissionInput(formData: "bad json", nodeId: "n1"),
            storage: storage
        )

        if case .validationFailed(let errors) = result {
            XCTAssertTrue(errors.contains("Invalid JSON"))
        } else {
            XCTFail("Expected .validationFailed but got \(result)")
        }
    }

    func testProcessSubmissionStoresData() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        _ = try await handler.processSubmission(
            input: FormBuilderProcessSubmissionInput(formData: "{\"name\":\"Alice\"}", nodeId: "n1"),
            storage: storage
        )

        let record = try await storage.get(relation: "form_def", key: "submission:n1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["nodeId"] as? String, "n1")
        XCTAssertEqual(record?["formData"] as? String, "{\"name\":\"Alice\"}")
    }

    // MARK: - registerWidget

    func testRegisterWidget() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        let result = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(fieldType: "text", widgetId: "textarea"),
            storage: storage
        )

        if case .ok(let fieldType, let widgetId) = result {
            XCTAssertEqual(fieldType, "text")
            XCTAssertEqual(widgetId, "textarea")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterWidgetStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        _ = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(fieldType: "date", widgetId: "datepicker"),
            storage: storage
        )

        let record = try await storage.get(relation: "widget_registry", key: "date")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["widgetId"] as? String, "datepicker")
    }

    func testRegisterWidgetOverwritesSameType() async throws {
        let storage = InMemoryStorage()
        let handler = FormBuilderHandlerImpl()

        _ = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(fieldType: "text", widgetId: "input"),
            storage: storage
        )
        _ = try await handler.registerWidget(
            input: FormBuilderRegisterWidgetInput(fieldType: "text", widgetId: "textarea"),
            storage: storage
        )

        let record = try await storage.get(relation: "widget_registry", key: "text")
        XCTAssertEqual(record?["widgetId"] as? String, "textarea")
    }
}
