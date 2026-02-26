// TypeSystemImpl.swift — TypeSystem concept implementation

import Foundation

// MARK: - Types

public struct TypeSystemRegisterTypeInput: Codable {
    public let typeId: String
    public let definition: String

    public init(typeId: String, definition: String) {
        self.typeId = typeId
        self.definition = definition
    }
}

public enum TypeSystemRegisterTypeOutput: Codable {
    case ok(typeId: String)
    case alreadyExists(typeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, typeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(typeId: try container.decode(String.self, forKey: .typeId))
        case "alreadyExists":
            self = .alreadyExists(typeId: try container.decode(String.self, forKey: .typeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let typeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
        case .alreadyExists(let typeId):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
        }
    }
}

public struct TypeSystemResolveInput: Codable {
    public let typePath: String

    public init(typePath: String) {
        self.typePath = typePath
    }
}

public enum TypeSystemResolveOutput: Codable {
    case ok(typeId: String, definition: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, typeId, definition, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                typeId: try container.decode(String.self, forKey: .typeId),
                definition: try container.decode(String.self, forKey: .definition)
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
        case .ok(let typeId, let definition):
            try container.encode("ok", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
            try container.encode(definition, forKey: .definition)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TypeSystemValidateInput: Codable {
    public let value: String
    public let typeId: String

    public init(value: String, typeId: String) {
        self.value = value
        self.typeId = typeId
    }
}

public enum TypeSystemValidateOutput: Codable {
    case ok(valid: Bool)
    case invalid(typeId: String, errors: String)

    enum CodingKeys: String, CodingKey {
        case variant, valid, typeId, errors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(valid: try container.decode(Bool.self, forKey: .valid))
        case "invalid":
            self = .invalid(
                typeId: try container.decode(String.self, forKey: .typeId),
                errors: try container.decode(String.self, forKey: .errors)
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
        case .ok(let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
        case .invalid(let typeId, let errors):
            try container.encode("invalid", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
            try container.encode(errors, forKey: .errors)
        }
    }
}

// MARK: - Handler Protocol

public protocol TypeSystemHandler {
    func registerType(input: TypeSystemRegisterTypeInput, storage: ConceptStorage) async throws -> TypeSystemRegisterTypeOutput
    func resolve(input: TypeSystemResolveInput, storage: ConceptStorage) async throws -> TypeSystemResolveOutput
    func validate(input: TypeSystemValidateInput, storage: ConceptStorage) async throws -> TypeSystemValidateOutput
}

// MARK: - Implementation

public struct TypeSystemHandlerImpl: TypeSystemHandler {
    public init() {}

    public func registerType(
        input: TypeSystemRegisterTypeInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemRegisterTypeOutput {
        if let _ = try await storage.get(relation: "type_def", key: input.typeId) {
            return .alreadyExists(typeId: input.typeId)
        }
        try await storage.put(
            relation: "type_def",
            key: input.typeId,
            value: [
                "typeId": input.typeId,
                "definition": input.definition,
            ]
        )
        return .ok(typeId: input.typeId)
    }

    public func resolve(
        input: TypeSystemResolveInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemResolveOutput {
        // Resolve by typePath: try direct lookup first
        if let record = try await storage.get(relation: "type_def", key: input.typePath) {
            let definition = record["definition"] as? String ?? ""
            return .ok(typeId: input.typePath, definition: definition)
        }
        return .notfound(message: "Type '\(input.typePath)' not found")
    }

    public func validate(
        input: TypeSystemValidateInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemValidateOutput {
        guard let record = try await storage.get(relation: "type_def", key: input.typeId) else {
            return .invalid(typeId: input.typeId, errors: "Type '\(input.typeId)' not registered")
        }
        // Basic validation: check the value is non-empty when a type definition exists
        let definition = record["definition"] as? String ?? ""
        if !definition.isEmpty && input.value.isEmpty {
            return .invalid(typeId: input.typeId, errors: "Value is empty but type requires content")
        }
        return .ok(valid: true)
    }
}
