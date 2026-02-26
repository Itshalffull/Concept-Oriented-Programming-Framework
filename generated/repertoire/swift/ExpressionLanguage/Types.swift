// generated: ExpressionLanguage/Types.swift

import Foundation

struct ExpressionLanguageRegisterLanguageInput: Codable {
    let name: String
    let grammar: String
}

enum ExpressionLanguageRegisterLanguageOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

struct ExpressionLanguageRegisterFunctionInput: Codable {
    let name: String
    let implementation: String
}

enum ExpressionLanguageRegisterFunctionOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

struct ExpressionLanguageRegisterOperatorInput: Codable {
    let name: String
    let implementation: String
}

enum ExpressionLanguageRegisterOperatorOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

struct ExpressionLanguageParseInput: Codable {
    let expression: String
    let text: String
    let language: String
}

enum ExpressionLanguageParseOutput: Codable {
    case ok(ast: String)
    case error

    enum CodingKeys: String, CodingKey {
        case variant
        case ast
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                ast: try container.decode(String.self, forKey: .ast)
            )
        case "error": self = .error
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let ast):
            try container.encode("ok", forKey: .variant)
            try container.encode(ast, forKey: .ast)
        case .error:
            try container.encode("error", forKey: .variant)
        }
    }
}

struct ExpressionLanguageEvaluateInput: Codable {
    let expression: String
}

enum ExpressionLanguageEvaluateOutput: Codable {
    case ok(result: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case result
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                result: try container.decode(String.self, forKey: .result)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct ExpressionLanguageTypeCheckInput: Codable {
    let expression: String
}

enum ExpressionLanguageTypeCheckOutput: Codable {
    case ok(valid: Bool, errors: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case errors
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid),
                errors: try container.decode(String.self, forKey: .errors)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let valid, let errors):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
            try container.encode(errors, forKey: .errors)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct ExpressionLanguageGetCompletionsInput: Codable {
    let expression: String
    let cursor: Int
}

enum ExpressionLanguageGetCompletionsOutput: Codable {
    case ok(completions: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case completions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                completions: try container.decode(String.self, forKey: .completions)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let completions):
            try container.encode("ok", forKey: .variant)
            try container.encode(completions, forKey: .completions)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

