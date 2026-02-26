// SchemaTests.swift — Tests for Schema concept

import XCTest
@testable import Clef

final class SchemaTests: XCTestCase {

    // MARK: - defineSchema

    func testDefineSchema() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[\"title\",\"body\"]"),
            storage: storage
        )

        if case .ok(let schemaId) = result {
            XCTAssertFalse(schemaId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineSchemaStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Page", fields: "[\"title\"]"),
            storage: storage
        )

        if case .ok(let schemaId) = result {
            let record = try await storage.get(relation: "schema", key: schemaId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "Page")
            XCTAssertEqual(record?["fields"] as? String, "[\"title\"]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineMultipleSchemas() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let r1 = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[]"),
            storage: storage
        )
        let r2 = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Event", fields: "[]"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertNotEqual(id1, id2)
        } else {
            XCTFail("Expected .ok for both schemas")
        }
    }

    // MARK: - addField

    func testAddField() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let defineResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[]"),
            storage: storage
        )
        guard case .ok(let schemaId) = defineResult else {
            XCTFail("Expected .ok for define"); return
        }

        let result = try await handler.addField(
            input: SchemaAddFieldInput(schemaId: schemaId, fieldDef: "summary"),
            storage: storage
        )

        if case .ok(let sid) = result {
            XCTAssertEqual(sid, schemaId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddFieldNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.addField(
            input: SchemaAddFieldInput(schemaId: "nonexistent", fieldDef: "title"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testAddMultipleFields() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let defineResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[]"),
            storage: storage
        )
        guard case .ok(let schemaId) = defineResult else {
            XCTFail("Expected .ok for define"); return
        }

        _ = try await handler.addField(
            input: SchemaAddFieldInput(schemaId: schemaId, fieldDef: "title"),
            storage: storage
        )
        _ = try await handler.addField(
            input: SchemaAddFieldInput(schemaId: schemaId, fieldDef: "body"),
            storage: storage
        )

        let fieldsResult = try await handler.getEffectiveFields(
            input: SchemaGetEffectiveFieldsInput(schemaId: schemaId),
            storage: storage
        )

        if case .ok(_, let fields) = fieldsResult {
            XCTAssertTrue(fields.contains("title"))
            XCTAssertTrue(fields.contains("body"))
        } else {
            XCTFail("Expected .ok but got \(fieldsResult)")
        }
    }

    // MARK: - extendSchema

    func testExtendSchema() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let parentResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "ContentBase", fields: "[\"title\"]"),
            storage: storage
        )
        guard case .ok(let parentId) = parentResult else {
            XCTFail("Expected .ok for parent"); return
        }

        let childResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[\"body\"]"),
            storage: storage
        )
        guard case .ok(let childId) = childResult else {
            XCTFail("Expected .ok for child"); return
        }

        let result = try await handler.extendSchema(
            input: SchemaExtendSchemaInput(childId: childId, parentId: parentId),
            storage: storage
        )

        if case .ok(let cid) = result {
            XCTAssertEqual(cid, childId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExtendSchemaNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.extendSchema(
            input: SchemaExtendSchemaInput(childId: "missing-child", parentId: "missing-parent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - applyTo

    func testApplyTo() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let defineResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[]"),
            storage: storage
        )
        guard case .ok(let schemaId) = defineResult else {
            XCTFail("Expected .ok for define"); return
        }

        let result = try await handler.applyTo(
            input: SchemaApplyToInput(nodeId: "node-1", schemaId: schemaId),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "node-1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testApplyToSchemaNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.applyTo(
            input: SchemaApplyToInput(nodeId: "node-1", schemaId: "nonexistent"),
            storage: storage
        )

        if case .schemaNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .schemaNotfound but got \(result)")
        }
    }

    // MARK: - removeFrom

    func testRemoveFrom() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let defineResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[]"),
            storage: storage
        )
        guard case .ok(let schemaId) = defineResult else {
            XCTFail("Expected .ok for define"); return
        }

        _ = try await handler.applyTo(
            input: SchemaApplyToInput(nodeId: "node-1", schemaId: schemaId),
            storage: storage
        )

        let result = try await handler.removeFrom(
            input: SchemaRemoveFromInput(nodeId: "node-1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "node-1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRemoveFromNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.removeFrom(
            input: SchemaRemoveFromInput(nodeId: "unassigned"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("unassigned"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getEffectiveFields

    func testGetEffectiveFields() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let defineResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[\"title\",\"body\"]"),
            storage: storage
        )
        guard case .ok(let schemaId) = defineResult else {
            XCTFail("Expected .ok for define"); return
        }

        let result = try await handler.getEffectiveFields(
            input: SchemaGetEffectiveFieldsInput(schemaId: schemaId),
            storage: storage
        )

        if case .ok(let sid, let fields) = result {
            XCTAssertEqual(sid, schemaId)
            XCTAssertTrue(fields.contains("title"))
            XCTAssertTrue(fields.contains("body"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetEffectiveFieldsWithInheritance() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let parentResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Base", fields: "[\"id\",\"createdAt\"]"),
            storage: storage
        )
        guard case .ok(let parentId) = parentResult else {
            XCTFail("Expected .ok for parent"); return
        }

        let childResult = try await handler.defineSchema(
            input: SchemaDefineSchemaInput(name: "Article", fields: "[\"title\",\"body\"]"),
            storage: storage
        )
        guard case .ok(let childId) = childResult else {
            XCTFail("Expected .ok for child"); return
        }

        _ = try await handler.extendSchema(
            input: SchemaExtendSchemaInput(childId: childId, parentId: parentId),
            storage: storage
        )

        let result = try await handler.getEffectiveFields(
            input: SchemaGetEffectiveFieldsInput(schemaId: childId),
            storage: storage
        )

        if case .ok(_, let fields) = result {
            // Should include both parent and child fields
            XCTAssertTrue(fields.contains("id"))
            XCTAssertTrue(fields.contains("createdAt"))
            XCTAssertTrue(fields.contains("title"))
            XCTAssertTrue(fields.contains("body"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetEffectiveFieldsNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SchemaHandlerImpl()

        let result = try await handler.getEffectiveFields(
            input: SchemaGetEffectiveFieldsInput(schemaId: "missing"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
