// ComponentImpl.swift — Component concept implementation

import Foundation

// MARK: - Types

public struct ComponentRegisterInput: Codable {
    public let componentId: String
    public let config: String

    public init(componentId: String, config: String) {
        self.componentId = componentId
        self.config = config
    }
}

public enum ComponentRegisterOutput: Codable {
    case ok(componentId: String)

    enum CodingKeys: String, CodingKey {
        case variant, componentId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(componentId: try container.decode(String.self, forKey: .componentId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let componentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(componentId, forKey: .componentId)
        }
    }
}

public struct ComponentPlaceInput: Codable {
    public let componentId: String
    public let region: String
    public let weight: Int

    public init(componentId: String, region: String, weight: Int) {
        self.componentId = componentId
        self.region = region
        self.weight = weight
    }
}

public enum ComponentPlaceOutput: Codable {
    case ok(placementId: String)

    enum CodingKeys: String, CodingKey {
        case variant, placementId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(placementId: try container.decode(String.self, forKey: .placementId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let placementId):
            try container.encode("ok", forKey: .variant)
            try container.encode(placementId, forKey: .placementId)
        }
    }
}

public struct ComponentSetVisibilityInput: Codable {
    public let placementId: String
    public let conditions: String

    public init(placementId: String, conditions: String) {
        self.placementId = placementId
        self.conditions = conditions
    }
}

public enum ComponentSetVisibilityOutput: Codable {
    case ok(placementId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, placementId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(placementId: try container.decode(String.self, forKey: .placementId))
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
        case .ok(let placementId):
            try container.encode("ok", forKey: .variant)
            try container.encode(placementId, forKey: .placementId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ComponentEvaluateVisibilityInput: Codable {
    public let placementId: String
    public let context: String

    public init(placementId: String, context: String) {
        self.placementId = placementId
        self.context = context
    }
}

public enum ComponentEvaluateVisibilityOutput: Codable {
    case ok(placementId: String, visible: Bool)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, placementId, visible, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                placementId: try container.decode(String.self, forKey: .placementId),
                visible: try container.decode(Bool.self, forKey: .visible)
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
        case .ok(let placementId, let visible):
            try container.encode("ok", forKey: .variant)
            try container.encode(placementId, forKey: .placementId)
            try container.encode(visible, forKey: .visible)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ComponentRenderInput: Codable {
    public let componentId: String
    public let context: String

    public init(componentId: String, context: String) {
        self.componentId = componentId
        self.context = context
    }
}

public enum ComponentRenderOutput: Codable {
    case ok(componentId: String, output: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, componentId, output, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                componentId: try container.decode(String.self, forKey: .componentId),
                output: try container.decode(String.self, forKey: .output)
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
        case .ok(let componentId, let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(componentId, forKey: .componentId)
            try container.encode(output, forKey: .output)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ComponentHandler {
    func register(input: ComponentRegisterInput, storage: ConceptStorage) async throws -> ComponentRegisterOutput
    func place(input: ComponentPlaceInput, storage: ConceptStorage) async throws -> ComponentPlaceOutput
    func setVisibility(input: ComponentSetVisibilityInput, storage: ConceptStorage) async throws -> ComponentSetVisibilityOutput
    func evaluateVisibility(input: ComponentEvaluateVisibilityInput, storage: ConceptStorage) async throws -> ComponentEvaluateVisibilityOutput
    func render(input: ComponentRenderInput, storage: ConceptStorage) async throws -> ComponentRenderOutput
}

// MARK: - Implementation

public struct ComponentHandlerImpl: ComponentHandler {
    public init() {}

    public func register(
        input: ComponentRegisterInput,
        storage: ConceptStorage
    ) async throws -> ComponentRegisterOutput {
        try await storage.put(
            relation: "component",
            key: input.componentId,
            value: [
                "componentId": input.componentId,
                "config": input.config,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(componentId: input.componentId)
    }

    public func place(
        input: ComponentPlaceInput,
        storage: ConceptStorage
    ) async throws -> ComponentPlaceOutput {
        let placementId = UUID().uuidString
        try await storage.put(
            relation: "placement",
            key: placementId,
            value: [
                "placementId": placementId,
                "componentId": input.componentId,
                "region": input.region,
                "weight": input.weight,
                "conditions": "",
            ]
        )
        return .ok(placementId: placementId)
    }

    public func setVisibility(
        input: ComponentSetVisibilityInput,
        storage: ConceptStorage
    ) async throws -> ComponentSetVisibilityOutput {
        guard var record = try await storage.get(relation: "placement", key: input.placementId) else {
            return .notfound(message: "Placement \(input.placementId) not found")
        }
        record["conditions"] = input.conditions
        try await storage.put(relation: "placement", key: input.placementId, value: record)
        return .ok(placementId: input.placementId)
    }

    public func evaluateVisibility(
        input: ComponentEvaluateVisibilityInput,
        storage: ConceptStorage
    ) async throws -> ComponentEvaluateVisibilityOutput {
        guard let record = try await storage.get(relation: "placement", key: input.placementId) else {
            return .notfound(message: "Placement \(input.placementId) not found")
        }
        let conditions = record["conditions"] as? String ?? ""
        // Simple visibility evaluation: visible if no conditions or context contains condition
        let visible = conditions.isEmpty || input.context.contains(conditions)
        return .ok(placementId: input.placementId, visible: visible)
    }

    public func render(
        input: ComponentRenderInput,
        storage: ConceptStorage
    ) async throws -> ComponentRenderOutput {
        guard let record = try await storage.get(relation: "component", key: input.componentId) else {
            return .notfound(message: "Component \(input.componentId) not found")
        }
        let config = record["config"] as? String ?? ""
        let output = "rendered(\(input.componentId), config=\(config), context=\(input.context))"
        return .ok(componentId: input.componentId, output: output)
    }
}
