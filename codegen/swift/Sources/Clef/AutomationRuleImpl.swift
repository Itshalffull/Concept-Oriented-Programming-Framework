// AutomationRuleImpl.swift — AutomationRule concept implementation

import Foundation

// MARK: - Types

public struct AutomationRuleDefineInput: Codable {
    public let trigger: String
    public let conditions: String
    public let actions: String
    public let enabled: Bool

    public init(trigger: String, conditions: String, actions: String, enabled: Bool) {
        self.trigger = trigger
        self.conditions = conditions
        self.actions = actions
        self.enabled = enabled
    }
}

public enum AutomationRuleDefineOutput: Codable {
    case ok(ruleId: String)

    enum CodingKeys: String, CodingKey {
        case variant, ruleId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(ruleId: try container.decode(String.self, forKey: .ruleId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let ruleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(ruleId, forKey: .ruleId)
        }
    }
}

public struct AutomationRuleEnableInput: Codable {
    public let ruleId: String

    public init(ruleId: String) {
        self.ruleId = ruleId
    }
}

public enum AutomationRuleEnableOutput: Codable {
    case ok(ruleId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, ruleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(ruleId: try container.decode(String.self, forKey: .ruleId))
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
        case .ok(let ruleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(ruleId, forKey: .ruleId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationRuleDisableInput: Codable {
    public let ruleId: String

    public init(ruleId: String) {
        self.ruleId = ruleId
    }
}

public enum AutomationRuleDisableOutput: Codable {
    case ok(ruleId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, ruleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(ruleId: try container.decode(String.self, forKey: .ruleId))
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
        case .ok(let ruleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(ruleId, forKey: .ruleId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationRuleEvaluateInput: Codable {
    public let ruleId: String
    public let event: String

    public init(ruleId: String, event: String) {
        self.ruleId = ruleId
        self.event = event
    }
}

public enum AutomationRuleEvaluateOutput: Codable {
    case ok(ruleId: String, matched: Bool)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, ruleId, matched, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                ruleId: try container.decode(String.self, forKey: .ruleId),
                matched: try container.decode(Bool.self, forKey: .matched)
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
        case .ok(let ruleId, let matched):
            try container.encode("ok", forKey: .variant)
            try container.encode(ruleId, forKey: .ruleId)
            try container.encode(matched, forKey: .matched)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol AutomationRuleHandler {
    func define(input: AutomationRuleDefineInput, storage: ConceptStorage) async throws -> AutomationRuleDefineOutput
    func enable(input: AutomationRuleEnableInput, storage: ConceptStorage) async throws -> AutomationRuleEnableOutput
    func disable(input: AutomationRuleDisableInput, storage: ConceptStorage) async throws -> AutomationRuleDisableOutput
    func evaluate(input: AutomationRuleEvaluateInput, storage: ConceptStorage) async throws -> AutomationRuleEvaluateOutput
}

// MARK: - Implementation

public struct AutomationRuleHandlerImpl: AutomationRuleHandler {
    public init() {}

    public func define(
        input: AutomationRuleDefineInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleDefineOutput {
        let ruleId = UUID().uuidString
        try await storage.put(
            relation: "automation_rule",
            key: ruleId,
            value: [
                "ruleId": ruleId,
                "trigger": input.trigger,
                "conditions": input.conditions,
                "actions": input.actions,
                "enabled": input.enabled,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(ruleId: ruleId)
    }

    public func enable(
        input: AutomationRuleEnableInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleEnableOutput {
        guard var record = try await storage.get(relation: "automation_rule", key: input.ruleId) else {
            return .notfound(message: "Rule \(input.ruleId) not found")
        }
        record["enabled"] = true
        try await storage.put(relation: "automation_rule", key: input.ruleId, value: record)
        return .ok(ruleId: input.ruleId)
    }

    public func disable(
        input: AutomationRuleDisableInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleDisableOutput {
        guard var record = try await storage.get(relation: "automation_rule", key: input.ruleId) else {
            return .notfound(message: "Rule \(input.ruleId) not found")
        }
        record["enabled"] = false
        try await storage.put(relation: "automation_rule", key: input.ruleId, value: record)
        return .ok(ruleId: input.ruleId)
    }

    public func evaluate(
        input: AutomationRuleEvaluateInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleEvaluateOutput {
        guard let record = try await storage.get(relation: "automation_rule", key: input.ruleId) else {
            return .notfound(message: "Rule \(input.ruleId) not found")
        }
        let enabled = record["enabled"] as? Bool ?? false
        let trigger = record["trigger"] as? String ?? ""
        let matched = enabled && input.event.contains(trigger)
        return .ok(ruleId: input.ruleId, matched: matched)
    }
}
