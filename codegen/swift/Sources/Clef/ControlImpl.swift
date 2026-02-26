// ControlImpl.swift — Control concept implementation

import Foundation

// MARK: - Types

public struct ControlCreateInput: Codable {
    public let controlType: String
    public let label: String
    public let value: String
    public let binding: String
    public let action: String

    public init(controlType: String, label: String, value: String, binding: String, action: String) {
        self.controlType = controlType
        self.label = label
        self.value = value
        self.binding = binding
        self.action = action
    }
}

public enum ControlCreateOutput: Codable {
    case ok(controlId: String)

    enum CodingKeys: String, CodingKey {
        case variant, controlId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(controlId: try container.decode(String.self, forKey: .controlId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let controlId):
            try container.encode("ok", forKey: .variant)
            try container.encode(controlId, forKey: .controlId)
        }
    }
}

public struct ControlInteractInput: Codable {
    public let controlId: String

    public init(controlId: String) {
        self.controlId = controlId
    }
}

public enum ControlInteractOutput: Codable {
    case ok(controlId: String, actionTriggered: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, controlId, actionTriggered, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                controlId: try container.decode(String.self, forKey: .controlId),
                actionTriggered: try container.decode(String.self, forKey: .actionTriggered)
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
        case .ok(let controlId, let actionTriggered):
            try container.encode("ok", forKey: .variant)
            try container.encode(controlId, forKey: .controlId)
            try container.encode(actionTriggered, forKey: .actionTriggered)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ControlGetValueInput: Codable {
    public let controlId: String

    public init(controlId: String) {
        self.controlId = controlId
    }
}

public enum ControlGetValueOutput: Codable {
    case ok(controlId: String, value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, controlId, value, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                controlId: try container.decode(String.self, forKey: .controlId),
                value: try container.decode(String.self, forKey: .value)
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
        case .ok(let controlId, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(controlId, forKey: .controlId)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ControlSetValueInput: Codable {
    public let controlId: String
    public let value: String

    public init(controlId: String, value: String) {
        self.controlId = controlId
        self.value = value
    }
}

public enum ControlSetValueOutput: Codable {
    case ok(controlId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, controlId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(controlId: try container.decode(String.self, forKey: .controlId))
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
        case .ok(let controlId):
            try container.encode("ok", forKey: .variant)
            try container.encode(controlId, forKey: .controlId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ControlHandler {
    func create(input: ControlCreateInput, storage: ConceptStorage) async throws -> ControlCreateOutput
    func interact(input: ControlInteractInput, storage: ConceptStorage) async throws -> ControlInteractOutput
    func getValue(input: ControlGetValueInput, storage: ConceptStorage) async throws -> ControlGetValueOutput
    func setValue(input: ControlSetValueInput, storage: ConceptStorage) async throws -> ControlSetValueOutput
}

// MARK: - Implementation

public struct ControlHandlerImpl: ControlHandler {
    public init() {}

    public func create(
        input: ControlCreateInput,
        storage: ConceptStorage
    ) async throws -> ControlCreateOutput {
        let controlId = UUID().uuidString
        try await storage.put(
            relation: "control",
            key: controlId,
            value: [
                "controlId": controlId,
                "controlType": input.controlType,
                "label": input.label,
                "value": input.value,
                "binding": input.binding,
                "action": input.action,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(controlId: controlId)
    }

    public func interact(
        input: ControlInteractInput,
        storage: ConceptStorage
    ) async throws -> ControlInteractOutput {
        guard let record = try await storage.get(relation: "control", key: input.controlId) else {
            return .notfound(message: "Control \(input.controlId) not found")
        }
        let action = record["action"] as? String ?? ""
        return .ok(controlId: input.controlId, actionTriggered: action)
    }

    public func getValue(
        input: ControlGetValueInput,
        storage: ConceptStorage
    ) async throws -> ControlGetValueOutput {
        guard let record = try await storage.get(relation: "control", key: input.controlId) else {
            return .notfound(message: "Control \(input.controlId) not found")
        }
        let value = record["value"] as? String ?? ""
        return .ok(controlId: input.controlId, value: value)
    }

    public func setValue(
        input: ControlSetValueInput,
        storage: ConceptStorage
    ) async throws -> ControlSetValueOutput {
        guard var record = try await storage.get(relation: "control", key: input.controlId) else {
            return .notfound(message: "Control \(input.controlId) not found")
        }
        record["value"] = input.value
        try await storage.put(relation: "control", key: input.controlId, value: record)
        return .ok(controlId: input.controlId)
    }
}
