// AutomationScopeImpl.swift — AutomationScope concept implementation

import Foundation

// MARK: - Types

public struct AutomationScopeConfigureInput: Codable {
    public let scope: String
    public let mode: String

    public init(scope: String, mode: String) {
        self.scope = scope
        self.mode = mode
    }
}

public enum AutomationScopeConfigureOutput: Codable {
    case ok(scope: String, mode: String)
    case invalidMode(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, scope, mode, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                scope: try container.decode(String.self, forKey: .scope),
                mode: try container.decode(String.self, forKey: .mode)
            )
        case "invalidMode":
            self = .invalidMode(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let scope, let mode):
            try container.encode("ok", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(mode, forKey: .mode)
        case .invalidMode(let message):
            try container.encode("invalidMode", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationScopeAddRuleInput: Codable {
    public let scope: String
    public let actionPattern: String
    public let category: String

    public init(scope: String, actionPattern: String, category: String) {
        self.scope = scope
        self.actionPattern = actionPattern
        self.category = category
    }
}

public enum AutomationScopeAddRuleOutput: Codable {
    case ok(scope: String, ruleId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, scope, ruleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                scope: try container.decode(String.self, forKey: .scope),
                ruleId: try container.decode(String.self, forKey: .ruleId)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let scope, let ruleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(ruleId, forKey: .ruleId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationScopeRemoveRuleInput: Codable {
    public let scope: String
    public let actionPattern: String

    public init(scope: String, actionPattern: String) {
        self.scope = scope
        self.actionPattern = actionPattern
    }
}

public enum AutomationScopeRemoveRuleOutput: Codable {
    case ok(scope: String, actionPattern: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, scope, actionPattern, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                scope: try container.decode(String.self, forKey: .scope),
                actionPattern: try container.decode(String.self, forKey: .actionPattern)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let scope, let actionPattern):
            try container.encode("ok", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(actionPattern, forKey: .actionPattern)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationScopeCheckInput: Codable {
    public let scope: String
    public let actionRef: String

    public init(scope: String, actionRef: String) {
        self.scope = scope
        self.actionRef = actionRef
    }
}

public enum AutomationScopeCheckOutput: Codable {
    case allowed(scope: String, actionRef: String)
    case denied(scope: String, actionRef: String, reason: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, scope, actionRef, reason, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "allowed":
            self = .allowed(
                scope: try container.decode(String.self, forKey: .scope),
                actionRef: try container.decode(String.self, forKey: .actionRef)
            )
        case "denied":
            self = .denied(
                scope: try container.decode(String.self, forKey: .scope),
                actionRef: try container.decode(String.self, forKey: .actionRef),
                reason: try container.decode(String.self, forKey: .reason)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .allowed(let scope, let actionRef):
            try container.encode("allowed", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(actionRef, forKey: .actionRef)
        case .denied(let scope, let actionRef, let reason):
            try container.encode("denied", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(actionRef, forKey: .actionRef)
            try container.encode(reason, forKey: .reason)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationScopeListRulesInput: Codable {
    public let scope: String

    public init(scope: String) {
        self.scope = scope
    }
}

public enum AutomationScopeListRulesOutput: Codable {
    case ok(scope: String, rules: [String])
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, scope, rules, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                scope: try container.decode(String.self, forKey: .scope),
                rules: try container.decode([String].self, forKey: .rules)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let scope, let rules):
            try container.encode("ok", forKey: .variant)
            try container.encode(scope, forKey: .scope)
            try container.encode(rules, forKey: .rules)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol AutomationScopeHandler {
    func configure(input: AutomationScopeConfigureInput, storage: ConceptStorage) async throws -> AutomationScopeConfigureOutput
    func addRule(input: AutomationScopeAddRuleInput, storage: ConceptStorage) async throws -> AutomationScopeAddRuleOutput
    func removeRule(input: AutomationScopeRemoveRuleInput, storage: ConceptStorage) async throws -> AutomationScopeRemoveRuleOutput
    func check(input: AutomationScopeCheckInput, storage: ConceptStorage) async throws -> AutomationScopeCheckOutput
    func listRules(input: AutomationScopeListRulesInput, storage: ConceptStorage) async throws -> AutomationScopeListRulesOutput
}

// MARK: - Implementation

public struct AutomationScopeHandlerImpl: AutomationScopeHandler {
    public init() {}

    private static let validModes: Set<String> = ["allowlist", "denylist"]

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    /// Matches an actionRef against a glob pattern containing `*` wildcards.
    private func globMatch(pattern: String, value: String) -> Bool {
        let parts = pattern.split(separator: "*", omittingEmptySubsequences: false).map(String.init)
        if parts.count == 1 {
            return pattern == value
        }
        var remaining = value[value.startIndex...]
        for (index, part) in parts.enumerated() {
            if part.isEmpty { continue }
            guard let range = remaining.range(of: part) else {
                return false
            }
            if index == 0 && range.lowerBound != remaining.startIndex {
                return false
            }
            remaining = remaining[range.upperBound...]
        }
        if let last = parts.last, !last.isEmpty {
            return remaining.isEmpty
        }
        return true
    }

    public func configure(
        input: AutomationScopeConfigureInput,
        storage: ConceptStorage
    ) async throws -> AutomationScopeConfigureOutput {
        guard Self.validModes.contains(input.mode) else {
            return .invalidMode(message: "Mode must be 'allowlist' or 'denylist', got '\(input.mode)'")
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "automationScope",
            key: input.scope,
            value: [
                "scope": input.scope,
                "mode": input.mode,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(scope: input.scope, mode: input.mode)
    }

    public func addRule(
        input: AutomationScopeAddRuleInput,
        storage: ConceptStorage
    ) async throws -> AutomationScopeAddRuleOutput {
        guard let _ = try await storage.get(relation: "automationScope", key: input.scope) else {
            return .notFound(message: "Scope '\(input.scope)' not found")
        }
        let ruleId = UUID().uuidString
        let now = iso8601Now()
        try await storage.put(
            relation: "automationScopeRule",
            key: ruleId,
            value: [
                "ruleId": ruleId,
                "scope": input.scope,
                "actionPattern": input.actionPattern,
                "category": input.category,
                "createdAt": now,
            ]
        )
        return .ok(scope: input.scope, ruleId: ruleId)
    }

    public func removeRule(
        input: AutomationScopeRemoveRuleInput,
        storage: ConceptStorage
    ) async throws -> AutomationScopeRemoveRuleOutput {
        guard let _ = try await storage.get(relation: "automationScope", key: input.scope) else {
            return .notFound(message: "Scope '\(input.scope)' not found")
        }
        let rules = try await storage.find(
            relation: "automationScopeRule",
            criteria: ["scope": input.scope, "actionPattern": input.actionPattern]
        )
        guard let rule = rules.first, let ruleId = rule["ruleId"] as? String else {
            return .notFound(message: "Rule with pattern '\(input.actionPattern)' not found in scope '\(input.scope)'")
        }
        try await storage.del(relation: "automationScopeRule", key: ruleId)
        return .ok(scope: input.scope, actionPattern: input.actionPattern)
    }

    public func check(
        input: AutomationScopeCheckInput,
        storage: ConceptStorage
    ) async throws -> AutomationScopeCheckOutput {
        guard let scopeRecord = try await storage.get(relation: "automationScope", key: input.scope) else {
            return .notFound(message: "Scope '\(input.scope)' not found")
        }
        let mode = scopeRecord["mode"] as? String ?? "denylist"
        let rules = try await storage.find(
            relation: "automationScopeRule",
            criteria: ["scope": input.scope]
        )
        let patterns = rules.compactMap { $0["actionPattern"] as? String }
        let matched = patterns.contains { globMatch(pattern: $0, value: input.actionRef) }

        switch mode {
        case "allowlist":
            if matched {
                return .allowed(scope: input.scope, actionRef: input.actionRef)
            } else {
                return .denied(scope: input.scope, actionRef: input.actionRef, reason: "Action not in allowlist")
            }
        case "denylist":
            if matched {
                return .denied(scope: input.scope, actionRef: input.actionRef, reason: "Action matches denylist pattern")
            } else {
                return .allowed(scope: input.scope, actionRef: input.actionRef)
            }
        default:
            return .denied(scope: input.scope, actionRef: input.actionRef, reason: "Unknown mode '\(mode)'")
        }
    }

    public func listRules(
        input: AutomationScopeListRulesInput,
        storage: ConceptStorage
    ) async throws -> AutomationScopeListRulesOutput {
        guard let _ = try await storage.get(relation: "automationScope", key: input.scope) else {
            return .notFound(message: "Scope '\(input.scope)' not found")
        }
        let rules = try await storage.find(
            relation: "automationScopeRule",
            criteria: ["scope": input.scope]
        )
        let patterns = rules.compactMap { $0["actionPattern"] as? String }
        return .ok(scope: input.scope, rules: patterns)
    }
}
