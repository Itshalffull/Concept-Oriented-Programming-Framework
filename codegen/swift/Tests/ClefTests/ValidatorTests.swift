// ValidatorTests.swift — Tests for Validator concept

import XCTest
@testable import Clef

final class ValidatorTests: XCTestCase {

    // MARK: - registerConstraint

    func testRegisterConstraint() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.registerConstraint(
            input: ValidatorRegisterConstraintInput(constraintId: "not_empty", evaluatorConfig: "{\"type\":\"not_empty\"}"),
            storage: storage
        )

        if case .ok(let constraintId) = result {
            XCTAssertEqual(constraintId, "not_empty")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterConstraintStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        _ = try await handler.registerConstraint(
            input: ValidatorRegisterConstraintInput(constraintId: "max_length", evaluatorConfig: "{\"max\":255}"),
            storage: storage
        )

        let record = try await storage.get(relation: "constraint", key: "max_length")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["constraintId"] as? String, "max_length")
    }

    // MARK: - addRule

    func testAddRule() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.addRule(
            input: ValidatorAddRuleInput(schemaId: "article", fieldId: "title", constraintId: "not_empty", params: "{}"),
            storage: storage
        )

        if case .ok(let schemaId, let fieldId) = result {
            XCTAssertEqual(schemaId, "article")
            XCTAssertEqual(fieldId, "title")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddRuleStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        _ = try await handler.addRule(
            input: ValidatorAddRuleInput(schemaId: "s1", fieldId: "f1", constraintId: "c1", params: "{\"min\":1}"),
            storage: storage
        )

        let record = try await storage.get(relation: "validation_rule", key: "s1:f1:c1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["schemaId"] as? String, "s1")
    }

    // MARK: - validate

    func testValidateNoRules() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.validate(
            input: ValidatorValidateInput(nodeId: "n1", proposedChanges: "{\"title\":\"Hello\"}"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateWithRulesAndValidData() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        _ = try await handler.addRule(
            input: ValidatorAddRuleInput(schemaId: "s1", fieldId: "f1", constraintId: "c1", params: "{}"),
            storage: storage
        )

        let result = try await handler.validate(
            input: ValidatorValidateInput(nodeId: "n1", proposedChanges: "{\"title\":\"Hello\"}"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateWithRulesAndEmptyChanges() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        _ = try await handler.addRule(
            input: ValidatorAddRuleInput(schemaId: "s1", fieldId: "f1", constraintId: "c1", params: "{}"),
            storage: storage
        )

        let result = try await handler.validate(
            input: ValidatorValidateInput(nodeId: "n1", proposedChanges: ""),
            storage: storage
        )

        if case .invalid(let errors) = result {
            XCTAssertTrue(errors.contains("empty"))
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    // MARK: - validateField

    func testValidateFieldRequired() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.validateField(
            input: ValidatorValidateFieldInput(value: "", fieldType: "required", constraints: "{}"),
            storage: storage
        )

        if case .invalid(let errors) = result {
            XCTAssertTrue(errors.contains("required"))
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    func testValidateFieldRequiredWithValue() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.validateField(
            input: ValidatorValidateFieldInput(value: "hello", fieldType: "required", constraints: "{}"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateFieldInvalidEmail() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.validateField(
            input: ValidatorValidateFieldInput(value: "notanemail", fieldType: "email", constraints: "{}"),
            storage: storage
        )

        if case .invalid(let errors) = result {
            XCTAssertTrue(errors.contains("email"))
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    func testValidateFieldValidEmail() async throws {
        let storage = InMemoryStorage()
        let handler = ValidatorHandlerImpl()

        let result = try await handler.validateField(
            input: ValidatorValidateFieldInput(value: "user@example.com", fieldType: "email", constraints: "{}"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
