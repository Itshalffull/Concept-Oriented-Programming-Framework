// TemplateImpl.swift — Template concept implementation

import Foundation

// MARK: - Types

public struct TemplateDefineInput: Codable {
    public let templateId: String
    public let blockTree: String
    public let variables: String

    public init(templateId: String, blockTree: String, variables: String) {
        self.templateId = templateId
        self.blockTree = blockTree
        self.variables = variables
    }
}

public enum TemplateDefineOutput: Codable {
    case ok(templateId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case templateId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(templateId: try container.decode(String.self, forKey: .templateId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let templateId):
            try container.encode("ok", forKey: .variant)
            try container.encode(templateId, forKey: .templateId)
        }
    }
}

public struct TemplateInstantiateInput: Codable {
    public let templateId: String
    public let targetLocation: String
    public let bindings: String

    public init(templateId: String, targetLocation: String, bindings: String) {
        self.templateId = templateId
        self.targetLocation = targetLocation
        self.bindings = bindings
    }
}

public enum TemplateInstantiateOutput: Codable {
    case ok(instanceId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case instanceId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(instanceId: try container.decode(String.self, forKey: .instanceId))
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
        case .ok(let instanceId):
            try container.encode("ok", forKey: .variant)
            try container.encode(instanceId, forKey: .instanceId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TemplateRegisterTriggerInput: Codable {
    public let templateId: String
    public let condition: String

    public init(templateId: String, condition: String) {
        self.templateId = templateId
        self.condition = condition
    }
}

public enum TemplateRegisterTriggerOutput: Codable {
    case ok(templateId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case templateId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(templateId: try container.decode(String.self, forKey: .templateId))
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
        case .ok(let templateId):
            try container.encode("ok", forKey: .variant)
            try container.encode(templateId, forKey: .templateId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol TemplateHandler {
    func define(input: TemplateDefineInput, storage: ConceptStorage) async throws -> TemplateDefineOutput
    func instantiate(input: TemplateInstantiateInput, storage: ConceptStorage) async throws -> TemplateInstantiateOutput
    func registerTrigger(input: TemplateRegisterTriggerInput, storage: ConceptStorage) async throws -> TemplateRegisterTriggerOutput
}

// MARK: - Implementation

public struct TemplateHandlerImpl: TemplateHandler {
    public init() {}

    public func define(
        input: TemplateDefineInput,
        storage: ConceptStorage
    ) async throws -> TemplateDefineOutput {
        try await storage.put(
            relation: "template",
            key: input.templateId,
            value: [
                "id": input.templateId,
                "blockTree": input.blockTree,
                "variables": input.variables,
                "trigger": "",
            ]
        )
        return .ok(templateId: input.templateId)
    }

    public func instantiate(
        input: TemplateInstantiateInput,
        storage: ConceptStorage
    ) async throws -> TemplateInstantiateOutput {
        guard try await storage.get(relation: "template", key: input.templateId) != nil else {
            return .notfound(message: "Template '\(input.templateId)' not found")
        }

        let instanceId = UUID().uuidString

        try await storage.put(
            relation: "template",
            key: "instance:\(instanceId)",
            value: [
                "instanceId": instanceId,
                "templateId": input.templateId,
                "targetLocation": input.targetLocation,
                "bindings": input.bindings,
            ]
        )

        return .ok(instanceId: instanceId)
    }

    public func registerTrigger(
        input: TemplateRegisterTriggerInput,
        storage: ConceptStorage
    ) async throws -> TemplateRegisterTriggerOutput {
        guard let existing = try await storage.get(relation: "template", key: input.templateId) else {
            return .notfound(message: "Template '\(input.templateId)' not found")
        }

        var updated = existing
        updated["trigger"] = input.condition
        try await storage.put(relation: "template", key: input.templateId, value: updated)

        return .ok(templateId: input.templateId)
    }
}
