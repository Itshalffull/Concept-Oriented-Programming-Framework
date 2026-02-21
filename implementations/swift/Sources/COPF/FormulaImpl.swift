// FormulaImpl.swift — Formula concept implementation

import Foundation

// MARK: - Types

public struct FormulaEvaluateInput: Codable {
    public let formulaId: String
    public let context: String

    public init(formulaId: String, context: String) {
        self.formulaId = formulaId
        self.context = context
    }
}

public enum FormulaEvaluateOutput: Codable {
    case ok(formulaId: String, result: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, formulaId, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                formulaId: try container.decode(String.self, forKey: .formulaId),
                result: try container.decode(String.self, forKey: .result)
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
        case .ok(let formulaId, let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(formulaId, forKey: .formulaId)
            try container.encode(result, forKey: .result)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FormulaGetDependenciesInput: Codable {
    public let formulaId: String

    public init(formulaId: String) {
        self.formulaId = formulaId
    }
}

public enum FormulaGetDependenciesOutput: Codable {
    case ok(formulaId: String, dependencies: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, formulaId, dependencies, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                formulaId: try container.decode(String.self, forKey: .formulaId),
                dependencies: try container.decode(String.self, forKey: .dependencies)
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
        case .ok(let formulaId, let dependencies):
            try container.encode("ok", forKey: .variant)
            try container.encode(formulaId, forKey: .formulaId)
            try container.encode(dependencies, forKey: .dependencies)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FormulaInvalidateInput: Codable {
    public let formulaId: String

    public init(formulaId: String) {
        self.formulaId = formulaId
    }
}

public enum FormulaInvalidateOutput: Codable {
    case ok(formulaId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, formulaId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(formulaId: try container.decode(String.self, forKey: .formulaId))
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
        case .ok(let formulaId):
            try container.encode("ok", forKey: .variant)
            try container.encode(formulaId, forKey: .formulaId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FormulaSetExpressionInput: Codable {
    public let formulaId: String
    public let expression: String

    public init(formulaId: String, expression: String) {
        self.formulaId = formulaId
        self.expression = expression
    }
}

public enum FormulaSetExpressionOutput: Codable {
    case ok(formulaId: String)

    enum CodingKeys: String, CodingKey {
        case variant, formulaId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(formulaId: try container.decode(String.self, forKey: .formulaId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let formulaId):
            try container.encode("ok", forKey: .variant)
            try container.encode(formulaId, forKey: .formulaId)
        }
    }
}

// MARK: - Handler Protocol

public protocol FormulaHandler {
    func evaluate(input: FormulaEvaluateInput, storage: ConceptStorage) async throws -> FormulaEvaluateOutput
    func getDependencies(input: FormulaGetDependenciesInput, storage: ConceptStorage) async throws -> FormulaGetDependenciesOutput
    func invalidate(input: FormulaInvalidateInput, storage: ConceptStorage) async throws -> FormulaInvalidateOutput
    func setExpression(input: FormulaSetExpressionInput, storage: ConceptStorage) async throws -> FormulaSetExpressionOutput
}

// MARK: - Implementation

public struct FormulaHandlerImpl: FormulaHandler {
    public init() {}

    public func evaluate(
        input: FormulaEvaluateInput,
        storage: ConceptStorage
    ) async throws -> FormulaEvaluateOutput {
        guard let record = try await storage.get(relation: "formula", key: input.formulaId) else {
            return .notfound(message: "Formula \(input.formulaId) not found")
        }
        let expression = record["expression"] as? String ?? ""
        let result = "evaluated(\(expression), context=\(input.context))"
        return .ok(formulaId: input.formulaId, result: result)
    }

    public func getDependencies(
        input: FormulaGetDependenciesInput,
        storage: ConceptStorage
    ) async throws -> FormulaGetDependenciesOutput {
        guard let record = try await storage.get(relation: "formula", key: input.formulaId) else {
            return .notfound(message: "Formula \(input.formulaId) not found")
        }
        let dependencies = record["dependencies"] as? String ?? "[]"
        return .ok(formulaId: input.formulaId, dependencies: dependencies)
    }

    public func invalidate(
        input: FormulaInvalidateInput,
        storage: ConceptStorage
    ) async throws -> FormulaInvalidateOutput {
        guard let record = try await storage.get(relation: "formula", key: input.formulaId) else {
            return .notfound(message: "Formula \(input.formulaId) not found")
        }
        var updated = record
        updated["cached"] = false
        try await storage.put(relation: "formula", key: input.formulaId, value: updated)
        return .ok(formulaId: input.formulaId)
    }

    public func setExpression(
        input: FormulaSetExpressionInput,
        storage: ConceptStorage
    ) async throws -> FormulaSetExpressionOutput {
        let existing = try await storage.get(relation: "formula", key: input.formulaId)
        var record = existing ?? [:]
        record["formulaId"] = input.formulaId
        record["expression"] = input.expression
        record["cached"] = false
        try await storage.put(relation: "formula", key: input.formulaId, value: record)
        return .ok(formulaId: input.formulaId)
    }
}
