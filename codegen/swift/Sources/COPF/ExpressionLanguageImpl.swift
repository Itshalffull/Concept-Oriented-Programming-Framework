// ExpressionLanguageImpl.swift — ExpressionLanguage concept implementation

import Foundation

// MARK: - Types

public struct ExpressionLanguageRegisterLanguageInput: Codable {
    public let languageId: String
    public let grammar: String

    public init(languageId: String, grammar: String) {
        self.languageId = languageId
        self.grammar = grammar
    }
}

public enum ExpressionLanguageRegisterLanguageOutput: Codable {
    case ok(languageId: String)

    enum CodingKeys: String, CodingKey {
        case variant, languageId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(languageId: try container.decode(String.self, forKey: .languageId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let languageId):
            try container.encode("ok", forKey: .variant)
            try container.encode(languageId, forKey: .languageId)
        }
    }
}

public struct ExpressionLanguageRegisterFunctionInput: Codable {
    public let languageId: String
    public let name: String
    public let signature: String

    public init(languageId: String, name: String, signature: String) {
        self.languageId = languageId
        self.name = name
        self.signature = signature
    }
}

public enum ExpressionLanguageRegisterFunctionOutput: Codable {
    case ok(languageId: String, name: String)
    case langNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, languageId, name, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                languageId: try container.decode(String.self, forKey: .languageId),
                name: try container.decode(String.self, forKey: .name)
            )
        case "langNotfound":
            self = .langNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let languageId, let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(languageId, forKey: .languageId)
            try container.encode(name, forKey: .name)
        case .langNotfound(let message):
            try container.encode("langNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ExpressionLanguageParseInput: Codable {
    public let languageId: String
    public let expressionString: String

    public init(languageId: String, expressionString: String) {
        self.languageId = languageId
        self.expressionString = expressionString
    }
}

public enum ExpressionLanguageParseOutput: Codable {
    case ok(ast: String)
    case parseError(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, ast, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(ast: try container.decode(String.self, forKey: .ast))
        case "parseError":
            self = .parseError(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let ast):
            try container.encode("ok", forKey: .variant)
            try container.encode(ast, forKey: .ast)
        case .parseError(let message):
            try container.encode("parseError", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ExpressionLanguageEvaluateInput: Codable {
    public let ast: String
    public let context: String

    public init(ast: String, context: String) {
        self.ast = ast
        self.context = context
    }
}

public enum ExpressionLanguageEvaluateOutput: Codable {
    case ok(result: String)
    case evalError(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
        case "evalError":
            self = .evalError(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .evalError(let message):
            try container.encode("evalError", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ExpressionLanguageHandler {
    func registerLanguage(input: ExpressionLanguageRegisterLanguageInput, storage: ConceptStorage) async throws -> ExpressionLanguageRegisterLanguageOutput
    func registerFunction(input: ExpressionLanguageRegisterFunctionInput, storage: ConceptStorage) async throws -> ExpressionLanguageRegisterFunctionOutput
    func parse(input: ExpressionLanguageParseInput, storage: ConceptStorage) async throws -> ExpressionLanguageParseOutput
    func evaluate(input: ExpressionLanguageEvaluateInput, storage: ConceptStorage) async throws -> ExpressionLanguageEvaluateOutput
}

// MARK: - Implementation

public struct ExpressionLanguageHandlerImpl: ExpressionLanguageHandler {
    public init() {}

    public func registerLanguage(
        input: ExpressionLanguageRegisterLanguageInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageRegisterLanguageOutput {
        try await storage.put(
            relation: "language",
            key: input.languageId,
            value: [
                "languageId": input.languageId,
                "grammar": input.grammar,
            ]
        )
        return .ok(languageId: input.languageId)
    }

    public func registerFunction(
        input: ExpressionLanguageRegisterFunctionInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageRegisterFunctionOutput {
        guard try await storage.get(relation: "language", key: input.languageId) != nil else {
            return .langNotfound(message: "Language \(input.languageId) not found")
        }
        let funcKey = "\(input.languageId):\(input.name)"
        try await storage.put(
            relation: "function_registry",
            key: funcKey,
            value: [
                "languageId": input.languageId,
                "name": input.name,
                "signature": input.signature,
            ]
        )
        return .ok(languageId: input.languageId, name: input.name)
    }

    public func parse(
        input: ExpressionLanguageParseInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageParseOutput {
        guard try await storage.get(relation: "language", key: input.languageId) != nil else {
            return .parseError(message: "Language \(input.languageId) not found")
        }
        if input.expressionString.isEmpty {
            return .parseError(message: "Empty expression string")
        }
        let ast = "{\"type\":\"expression\",\"language\":\"\(input.languageId)\",\"body\":\"\(input.expressionString)\"}"
        return .ok(ast: ast)
    }

    public func evaluate(
        input: ExpressionLanguageEvaluateInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageEvaluateOutput {
        if input.ast.isEmpty {
            return .evalError(message: "Empty AST")
        }
        let result = "evaluated(\(input.ast), context=\(input.context))"
        return .ok(result: result)
    }
}
