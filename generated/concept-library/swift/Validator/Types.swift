// generated: Validator/Types.swift

import Foundation

struct ValidatorRegisterConstraintInput: Codable {
    let validator: String
    let constraint: String
}

enum ValidatorRegisterConstraintOutput: Codable {
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

struct ValidatorAddRuleInput: Codable {
    let validator: String
    let field: String
    let rule: String
}

enum ValidatorAddRuleOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct ValidatorValidateInput: Codable {
    let validator: String
    let data: String
}

enum ValidatorValidateOutput: Codable {
    case ok(valid: Bool, errors: String)

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
        }
    }
}

struct ValidatorValidateFieldInput: Codable {
    let validator: String
    let field: String
    let value: String
}

enum ValidatorValidateFieldOutput: Codable {
    case ok(valid: Bool, errors: String)

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
        }
    }
}

struct ValidatorCoerceInput: Codable {
    let validator: String
    let data: String
}

enum ValidatorCoerceOutput: Codable {
    case ok(coerced: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case coerced
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                coerced: try container.decode(String.self, forKey: .coerced)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let coerced):
            try container.encode("ok", forKey: .variant)
            try container.encode(coerced, forKey: .coerced)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ValidatorAddCustomValidatorInput: Codable {
    let validator: String
    let name: String
    let implementation: String
}

enum ValidatorAddCustomValidatorOutput: Codable {
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

