// ControlTests.swift — Tests for Control concept

import XCTest
@testable import Clef

final class ControlTests: XCTestCase {

    // MARK: - create

    func testCreate() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let result = try await handler.create(
            input: ControlCreateInput(
                controlType: "button",
                label: "Submit",
                value: "",
                binding: "form.submit",
                action: "submitForm"
            ),
            storage: storage
        )

        if case .ok(let controlId) = result {
            XCTAssertFalse(controlId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let result = try await handler.create(
            input: ControlCreateInput(
                controlType: "toggle",
                label: "Dark Mode",
                value: "false",
                binding: "settings.darkMode",
                action: "toggleTheme"
            ),
            storage: storage
        )

        if case .ok(let controlId) = result {
            let record = try await storage.get(relation: "control", key: controlId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["controlType"] as? String, "toggle")
            XCTAssertEqual(record?["label"] as? String, "Dark Mode")
            XCTAssertEqual(record?["value"] as? String, "false")
            XCTAssertEqual(record?["binding"] as? String, "settings.darkMode")
            XCTAssertEqual(record?["action"] as? String, "toggleTheme")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleControls() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let r1 = try await handler.create(
            input: ControlCreateInput(controlType: "button", label: "Save", value: "", binding: "", action: "save"),
            storage: storage
        )
        let r2 = try await handler.create(
            input: ControlCreateInput(controlType: "input", label: "Name", value: "", binding: "name", action: ""),
            storage: storage
        )

        guard case .ok(let id1) = r1, case .ok(let id2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - interact

    func testInteract() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let createResult = try await handler.create(
            input: ControlCreateInput(
                controlType: "button",
                label: "Submit",
                value: "",
                binding: "",
                action: "submitForm"
            ),
            storage: storage
        )
        guard case .ok(let controlId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.interact(
            input: ControlInteractInput(controlId: controlId),
            storage: storage
        )

        if case .ok(let returnedId, let actionTriggered) = result {
            XCTAssertEqual(returnedId, controlId)
            XCTAssertEqual(actionTriggered, "submitForm")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testInteractNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let result = try await handler.interact(
            input: ControlInteractInput(controlId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testInteractReturnsEmptyActionWhenNoneSet() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let createResult = try await handler.create(
            input: ControlCreateInput(controlType: "label", label: "Info", value: "text", binding: "", action: ""),
            storage: storage
        )
        guard case .ok(let controlId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.interact(
            input: ControlInteractInput(controlId: controlId),
            storage: storage
        )

        if case .ok(_, let actionTriggered) = result {
            XCTAssertEqual(actionTriggered, "")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - getValue

    func testGetValue() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let createResult = try await handler.create(
            input: ControlCreateInput(
                controlType: "slider",
                label: "Volume",
                value: "75",
                binding: "audio.volume",
                action: ""
            ),
            storage: storage
        )
        guard case .ok(let controlId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.getValue(
            input: ControlGetValueInput(controlId: controlId),
            storage: storage
        )

        if case .ok(let returnedId, let value) = result {
            XCTAssertEqual(returnedId, controlId)
            XCTAssertEqual(value, "75")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetValueNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let result = try await handler.getValue(
            input: ControlGetValueInput(controlId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - setValue

    func testSetValue() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let createResult = try await handler.create(
            input: ControlCreateInput(
                controlType: "slider",
                label: "Volume",
                value: "50",
                binding: "audio.volume",
                action: ""
            ),
            storage: storage
        )
        guard case .ok(let controlId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.setValue(
            input: ControlSetValueInput(controlId: controlId, value: "100"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, controlId)
            let record = try await storage.get(relation: "control", key: controlId)
            XCTAssertEqual(record?["value"] as? String, "100")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetValueNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let result = try await handler.setValue(
            input: ControlSetValueInput(controlId: "nonexistent", value: "42"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testSetValueMultipleTimes() async throws {
        let storage = InMemoryStorage()
        let handler = ControlHandlerImpl()

        let createResult = try await handler.create(
            input: ControlCreateInput(controlType: "input", label: "Name", value: "", binding: "name", action: ""),
            storage: storage
        )
        guard case .ok(let controlId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.setValue(
            input: ControlSetValueInput(controlId: controlId, value: "Alice"),
            storage: storage
        )
        _ = try await handler.setValue(
            input: ControlSetValueInput(controlId: controlId, value: "Bob"),
            storage: storage
        )

        let getResult = try await handler.getValue(
            input: ControlGetValueInput(controlId: controlId),
            storage: storage
        )

        if case .ok(_, let value) = getResult {
            XCTAssertEqual(value, "Bob")
        } else {
            XCTFail("Expected .ok but got \(getResult)")
        }
    }
}
