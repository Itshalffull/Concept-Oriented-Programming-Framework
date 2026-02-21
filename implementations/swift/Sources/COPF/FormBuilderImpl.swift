// FormBuilderImpl.swift — FormBuilder concept implementation

import Foundation

// MARK: - Types

public struct FormBuilderBuildFormInput: Codable {
    public let schemaId: String
    public let mode: String
    public let entityId: String

    public init(schemaId: String, mode: String, entityId: String) {
        self.schemaId = schemaId
        self.mode = mode
        self.entityId = entityId
    }
}

public enum FormBuilderBuildFormOutput: Codable {
    case ok(formId: String, fields: String)
    case schemaNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case formId
        case fields
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                formId: try container.decode(String.self, forKey: .formId),
                fields: try container.decode(String.self, forKey: .fields)
            )
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
        case .ok(let formId, let fields):
            try container.encode("ok", forKey: .variant)
            try container.encode(formId, forKey: .formId)
            try container.encode(fields, forKey: .fields)
        case .schemaNotfound(let message):
            try container.encode("schemaNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FormBuilderValidateFormInput: Codable {
    public let formData: String
    public let schemaId: String

    public init(formData: String, schemaId: String) {
        self.formData = formData
        self.schemaId = schemaId
    }
}

public enum FormBuilderValidateFormOutput: Codable {
    case ok(valid: Bool)
    case invalid(errors: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case errors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(valid: try container.decode(Bool.self, forKey: .valid))
        case "invalid":
            self = .invalid(errors: try container.decode(String.self, forKey: .errors))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
        case .invalid(let errors):
            try container.encode("invalid", forKey: .variant)
            try container.encode(errors, forKey: .errors)
        }
    }
}

public struct FormBuilderProcessSubmissionInput: Codable {
    public let formData: String
    public let nodeId: String

    public init(formData: String, nodeId: String) {
        self.formData = formData
        self.nodeId = nodeId
    }
}

public enum FormBuilderProcessSubmissionOutput: Codable {
    case ok(nodeId: String)
    case validationFailed(errors: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case errors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        case "validationFailed":
            self = .validationFailed(errors: try container.decode(String.self, forKey: .errors))
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
        case .validationFailed(let errors):
            try container.encode("validationFailed", forKey: .variant)
            try container.encode(errors, forKey: .errors)
        }
    }
}

public struct FormBuilderRegisterWidgetInput: Codable {
    public let fieldType: String
    public let widgetId: String

    public init(fieldType: String, widgetId: String) {
        self.fieldType = fieldType
        self.widgetId = widgetId
    }
}

public enum FormBuilderRegisterWidgetOutput: Codable {
    case ok(fieldType: String, widgetId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case fieldType
        case widgetId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                fieldType: try container.decode(String.self, forKey: .fieldType),
                widgetId: try container.decode(String.self, forKey: .widgetId)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let fieldType, let widgetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(fieldType, forKey: .fieldType)
            try container.encode(widgetId, forKey: .widgetId)
        }
    }
}

// MARK: - Handler Protocol

public protocol FormBuilderHandler {
    func buildForm(input: FormBuilderBuildFormInput, storage: ConceptStorage) async throws -> FormBuilderBuildFormOutput
    func validateForm(input: FormBuilderValidateFormInput, storage: ConceptStorage) async throws -> FormBuilderValidateFormOutput
    func processSubmission(input: FormBuilderProcessSubmissionInput, storage: ConceptStorage) async throws -> FormBuilderProcessSubmissionOutput
    func registerWidget(input: FormBuilderRegisterWidgetInput, storage: ConceptStorage) async throws -> FormBuilderRegisterWidgetOutput
}

// MARK: - Implementation

public struct FormBuilderHandlerImpl: FormBuilderHandler {
    public init() {}

    public func buildForm(
        input: FormBuilderBuildFormInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderBuildFormOutput {
        guard let schema = try await storage.get(relation: "schema", key: input.schemaId) else {
            return .schemaNotfound(message: "Schema '\(input.schemaId)' not found")
        }

        let formId = UUID().uuidString
        let fields = schema["fields"] as? String ?? "[]"

        try await storage.put(
            relation: "form_def",
            key: formId,
            value: [
                "id": formId,
                "schemaId": input.schemaId,
                "mode": input.mode,
                "entityId": input.entityId,
                "fields": fields,
            ]
        )

        return .ok(formId: formId, fields: fields)
    }

    public func validateForm(
        input: FormBuilderValidateFormInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderValidateFormOutput {
        // Basic validation: check that formData is valid JSON
        guard let data = input.formData.data(using: .utf8),
              let _ = try? JSONSerialization.jsonObject(with: data) else {
            return .invalid(errors: "[\"Invalid JSON in form data\"]")
        }

        return .ok(valid: true)
    }

    public func processSubmission(
        input: FormBuilderProcessSubmissionInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderProcessSubmissionOutput {
        // Validate the form data
        guard let data = input.formData.data(using: .utf8),
              let _ = try? JSONSerialization.jsonObject(with: data) else {
            return .validationFailed(errors: "[\"Invalid JSON in form data\"]")
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        try await storage.put(
            relation: "form_def",
            key: "submission:\(input.nodeId)",
            value: [
                "nodeId": input.nodeId,
                "formData": input.formData,
                "submittedAt": now,
            ]
        )

        return .ok(nodeId: input.nodeId)
    }

    public func registerWidget(
        input: FormBuilderRegisterWidgetInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderRegisterWidgetOutput {
        try await storage.put(
            relation: "widget_registry",
            key: input.fieldType,
            value: [
                "fieldType": input.fieldType,
                "widgetId": input.widgetId,
            ]
        )
        return .ok(fieldType: input.fieldType, widgetId: input.widgetId)
    }
}
