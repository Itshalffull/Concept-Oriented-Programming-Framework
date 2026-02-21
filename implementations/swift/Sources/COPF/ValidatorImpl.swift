// ValidatorImpl.swift — Validator concept implementation

import Foundation

// MARK: - Types

public struct ValidatorRegisterConstraintInput: Codable {
    public let constraintId: String
    public let evaluatorConfig: String

    public init(constraintId: String, evaluatorConfig: String) {
        self.constraintId = constraintId
        self.evaluatorConfig = evaluatorConfig
    }
}

public enum ValidatorRegisterConstraintOutput: Codable {
    case ok(constraintId: String)

    enum CodingKeys: String, CodingKey {
        case variant, constraintId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(constraintId: try container.decode(String.self, forKey: .constraintId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let constraintId):
            try container.encode("ok", forKey: .variant)
            try container.encode(constraintId, forKey: .constraintId)
        }
    }
}

public struct ValidatorAddRuleInput: Codable {
    public let schemaId: String
    public let fieldId: String
    public let constraintId: String
    public let params: String

    public init(schemaId: String, fieldId: String, constraintId: String, params: String) {
        self.schemaId = schemaId
        self.fieldId = fieldId
        self.constraintId = constraintId
        self.params = params
    }
}

public enum ValidatorAddRuleOutput: Codable {
    case ok(schemaId: String, fieldId: String)

    enum CodingKeys: String, CodingKey {
        case variant, schemaId, fieldId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schemaId: try container.decode(String.self, forKey: .schemaId),
                fieldId: try container.decode(String.self, forKey: .fieldId)
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
        case .ok(let schemaId, let fieldId):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemaId, forKey: .schemaId)
            try container.encode(fieldId, forKey: .fieldId)
        }
    }
}

public struct ValidatorValidateInput: Codable {
    public let nodeId: String
    public let proposedChanges: String

    public init(nodeId: String, proposedChanges: String) {
        self.nodeId = nodeId
        self.proposedChanges = proposedChanges
    }
}

public enum ValidatorValidateOutput: Codable {
    case ok(valid: Bool)
    case invalid(errors: String)

    enum CodingKeys: String, CodingKey {
        case variant, valid, errors
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

public struct ValidatorValidateFieldInput: Codable {
    public let value: String
    public let fieldType: String
    public let constraints: String

    public init(value: String, fieldType: String, constraints: String) {
        self.value = value
        self.fieldType = fieldType
        self.constraints = constraints
    }
}

public enum ValidatorValidateFieldOutput: Codable {
    case ok(valid: Bool)
    case invalid(errors: String)

    enum CodingKeys: String, CodingKey {
        case variant, valid, errors
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

// MARK: - Handler Protocol

public protocol ValidatorHandler {
    func registerConstraint(input: ValidatorRegisterConstraintInput, storage: ConceptStorage) async throws -> ValidatorRegisterConstraintOutput
    func addRule(input: ValidatorAddRuleInput, storage: ConceptStorage) async throws -> ValidatorAddRuleOutput
    func validate(input: ValidatorValidateInput, storage: ConceptStorage) async throws -> ValidatorValidateOutput
    func validateField(input: ValidatorValidateFieldInput, storage: ConceptStorage) async throws -> ValidatorValidateFieldOutput
}

// MARK: - Implementation

public struct ValidatorHandlerImpl: ValidatorHandler {
    public init() {}

    public func registerConstraint(
        input: ValidatorRegisterConstraintInput,
        storage: ConceptStorage
    ) async throws -> ValidatorRegisterConstraintOutput {
        try await storage.put(
            relation: "constraint",
            key: input.constraintId,
            value: [
                "constraintId": input.constraintId,
                "evaluatorConfig": input.evaluatorConfig,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(constraintId: input.constraintId)
    }

    public func addRule(
        input: ValidatorAddRuleInput,
        storage: ConceptStorage
    ) async throws -> ValidatorAddRuleOutput {
        let ruleKey = "\(input.schemaId):\(input.fieldId):\(input.constraintId)"
        try await storage.put(
            relation: "validation_rule",
            key: ruleKey,
            value: [
                "schemaId": input.schemaId,
                "fieldId": input.fieldId,
                "constraintId": input.constraintId,
                "params": input.params,
            ]
        )
        return .ok(schemaId: input.schemaId, fieldId: input.fieldId)
    }

    public func validate(
        input: ValidatorValidateInput,
        storage: ConceptStorage
    ) async throws -> ValidatorValidateOutput {
        let allRules = try await storage.find(relation: "validation_rule", criteria: nil)
        if allRules.isEmpty {
            return .ok(valid: true)
        }
        // Simple validation: check if proposedChanges is not empty
        if input.proposedChanges.isEmpty {
            return .invalid(errors: "[\"Proposed changes cannot be empty\"]")
        }
        return .ok(valid: true)
    }

    public func validateField(
        input: ValidatorValidateFieldInput,
        storage: ConceptStorage
    ) async throws -> ValidatorValidateFieldOutput {
        // Simple built-in validation based on field type
        var errors: [String] = []
        if input.fieldType == "required" && input.value.isEmpty {
            errors.append("Field is required")
        }
        if input.fieldType == "email" && !input.value.contains("@") {
            errors.append("Invalid email format")
        }
        if errors.isEmpty {
            return .ok(valid: true)
        }
        let jsonData = try JSONSerialization.data(withJSONObject: errors, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .invalid(errors: jsonString)
    }
}
