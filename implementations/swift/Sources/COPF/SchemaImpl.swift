// SchemaImpl.swift — Schema concept implementation

import Foundation

// MARK: - Types

public struct SchemaDefineSchemaInput: Codable {
    public let name: String
    public let fields: String

    public init(name: String, fields: String) {
        self.name = name
        self.fields = fields
    }
}

public enum SchemaDefineSchemaOutput: Codable {
    case ok(schemaId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case schemaId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(schemaId: try container.decode(String.self, forKey: .schemaId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let schemaId):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemaId, forKey: .schemaId)
        }
    }
}

public struct SchemaAddFieldInput: Codable {
    public let schemaId: String
    public let fieldDef: String

    public init(schemaId: String, fieldDef: String) {
        self.schemaId = schemaId
        self.fieldDef = fieldDef
    }
}

public enum SchemaAddFieldOutput: Codable {
    case ok(schemaId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case schemaId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(schemaId: try container.decode(String.self, forKey: .schemaId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let schemaId):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemaId, forKey: .schemaId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SchemaExtendSchemaInput: Codable {
    public let childId: String
    public let parentId: String

    public init(childId: String, parentId: String) {
        self.childId = childId
        self.parentId = parentId
    }
}

public enum SchemaExtendSchemaOutput: Codable {
    case ok(childId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case childId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(childId: try container.decode(String.self, forKey: .childId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let childId):
            try container.encode("ok", forKey: .variant)
            try container.encode(childId, forKey: .childId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SchemaApplyToInput: Codable {
    public let nodeId: String
    public let schemaId: String

    public init(nodeId: String, schemaId: String) {
        self.nodeId = nodeId
        self.schemaId = schemaId
    }
}

public enum SchemaApplyToOutput: Codable {
    case ok(nodeId: String)
    case schemaNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        case "schemaNotfound":
            self = .schemaNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .schemaNotfound(let message):
            try container.encode("schemaNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SchemaRemoveFromInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum SchemaRemoveFromOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SchemaGetEffectiveFieldsInput: Codable {
    public let schemaId: String

    public init(schemaId: String) {
        self.schemaId = schemaId
    }
}

public enum SchemaGetEffectiveFieldsOutput: Codable {
    case ok(schemaId: String, fields: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case schemaId
        case fields
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schemaId: try container.decode(String.self, forKey: .schemaId),
                fields: try container.decode(String.self, forKey: .fields)
            )
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let schemaId, let fields):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemaId, forKey: .schemaId)
            try container.encode(fields, forKey: .fields)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol SchemaHandler {
    func defineSchema(input: SchemaDefineSchemaInput, storage: ConceptStorage) async throws -> SchemaDefineSchemaOutput
    func addField(input: SchemaAddFieldInput, storage: ConceptStorage) async throws -> SchemaAddFieldOutput
    func extendSchema(input: SchemaExtendSchemaInput, storage: ConceptStorage) async throws -> SchemaExtendSchemaOutput
    func applyTo(input: SchemaApplyToInput, storage: ConceptStorage) async throws -> SchemaApplyToOutput
    func removeFrom(input: SchemaRemoveFromInput, storage: ConceptStorage) async throws -> SchemaRemoveFromOutput
    func getEffectiveFields(input: SchemaGetEffectiveFieldsInput, storage: ConceptStorage) async throws -> SchemaGetEffectiveFieldsOutput
}

// MARK: - Implementation

public struct SchemaHandlerImpl: SchemaHandler {
    public init() {}

    public func defineSchema(
        input: SchemaDefineSchemaInput,
        storage: ConceptStorage
    ) async throws -> SchemaDefineSchemaOutput {
        let schemaId = UUID().uuidString
        try await storage.put(
            relation: "schema",
            key: schemaId,
            value: [
                "id": schemaId,
                "name": input.name,
                "fields": input.fields,
                "parentId": "",
            ]
        )
        return .ok(schemaId: schemaId)
    }

    public func addField(
        input: SchemaAddFieldInput,
        storage: ConceptStorage
    ) async throws -> SchemaAddFieldOutput {
        guard let existing = try await storage.get(relation: "schema", key: input.schemaId) else {
            return .notfound(message: "Schema '\(input.schemaId)' not found")
        }

        let currentFields = existing["fields"] as? String ?? "[]"
        // Append field definition to existing fields JSON
        var fieldsArray: [String] = []
        if let data = currentFields.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            fieldsArray = parsed
        }
        fieldsArray.append(input.fieldDef)

        let jsonData = try JSONSerialization.data(withJSONObject: fieldsArray, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        var updated = existing
        updated["fields"] = jsonString
        try await storage.put(relation: "schema", key: input.schemaId, value: updated)

        return .ok(schemaId: input.schemaId)
    }

    public func extendSchema(
        input: SchemaExtendSchemaInput,
        storage: ConceptStorage
    ) async throws -> SchemaExtendSchemaOutput {
        guard let child = try await storage.get(relation: "schema", key: input.childId) else {
            return .notfound(message: "Child schema '\(input.childId)' not found")
        }
        guard try await storage.get(relation: "schema", key: input.parentId) != nil else {
            return .notfound(message: "Parent schema '\(input.parentId)' not found")
        }

        var updated = child
        updated["parentId"] = input.parentId
        try await storage.put(relation: "schema", key: input.childId, value: updated)

        return .ok(childId: input.childId)
    }

    public func applyTo(
        input: SchemaApplyToInput,
        storage: ConceptStorage
    ) async throws -> SchemaApplyToOutput {
        guard try await storage.get(relation: "schema", key: input.schemaId) != nil else {
            return .schemaNotfound(message: "Schema '\(input.schemaId)' not found")
        }

        try await storage.put(
            relation: "schema_assignment",
            key: input.nodeId,
            value: [
                "nodeId": input.nodeId,
                "schemaId": input.schemaId,
            ]
        )

        return .ok(nodeId: input.nodeId)
    }

    public func removeFrom(
        input: SchemaRemoveFromInput,
        storage: ConceptStorage
    ) async throws -> SchemaRemoveFromOutput {
        guard try await storage.get(relation: "schema_assignment", key: input.nodeId) != nil else {
            return .notfound(message: "Schema assignment for node '\(input.nodeId)' not found")
        }

        try await storage.del(relation: "schema_assignment", key: input.nodeId)
        return .ok(nodeId: input.nodeId)
    }

    public func getEffectiveFields(
        input: SchemaGetEffectiveFieldsInput,
        storage: ConceptStorage
    ) async throws -> SchemaGetEffectiveFieldsOutput {
        guard let schema = try await storage.get(relation: "schema", key: input.schemaId) else {
            return .notfound(message: "Schema '\(input.schemaId)' not found")
        }

        var allFields: [String] = []

        // Walk up the inheritance chain
        var currentSchema: [String: Any]? = schema
        while let s = currentSchema {
            let fields = s["fields"] as? String ?? "[]"
            if let data = fields.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
                allFields.insert(contentsOf: parsed, at: 0)
            }
            let parentId = s["parentId"] as? String ?? ""
            if parentId.isEmpty {
                currentSchema = nil
            } else {
                currentSchema = try await storage.get(relation: "schema", key: parentId)
            }
        }

        let jsonData = try JSONSerialization.data(withJSONObject: allFields, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(schemaId: input.schemaId, fields: jsonString)
    }
}
