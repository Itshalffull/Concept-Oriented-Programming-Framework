// generated: FormBuilder/Types.swift

import Foundation

struct FormBuilderBuildFormInput: Codable {
    let form: String
    let schema: String
}

enum FormBuilderBuildFormOutput: Codable {
    case ok(definition: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case definition
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                definition: try container.decode(String.self, forKey: .definition)
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
        case .ok(let definition):
            try container.encode("ok", forKey: .variant)
            try container.encode(definition, forKey: .definition)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FormBuilderValidateInput: Codable {
    let form: String
    let data: String
}

enum FormBuilderValidateOutput: Codable {
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

struct FormBuilderProcessSubmissionInput: Codable {
    let form: String
    let data: String
}

enum FormBuilderProcessSubmissionOutput: Codable {
    case ok(result: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case result
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                result: try container.decode(String.self, forKey: .result)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FormBuilderRegisterWidgetInput: Codable {
    let form: String
    let type: String
    let widget: String
}

enum FormBuilderRegisterWidgetOutput: Codable {
    case ok(form: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case form
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                form: try container.decode(String.self, forKey: .form)
            )
        case "exists":
            self = .exists(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let form):
            try container.encode("ok", forKey: .variant)
            try container.encode(form, forKey: .form)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FormBuilderGetWidgetInput: Codable {
    let form: String
    let type: String
}

enum FormBuilderGetWidgetOutput: Codable {
    case ok(widget: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case widget
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                widget: try container.decode(String.self, forKey: .widget)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let widget):
            try container.encode("ok", forKey: .variant)
            try container.encode(widget, forKey: .widget)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

