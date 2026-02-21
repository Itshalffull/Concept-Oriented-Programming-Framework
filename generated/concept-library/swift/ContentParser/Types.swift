// generated: ContentParser/Types.swift

import Foundation

struct ContentParserRegisterFormatInput: Codable {
    let name: String
    let grammar: String
}

enum ContentParserRegisterFormatOutput: Codable {
    case ok(name: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case name
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                name: try container.decode(String.self, forKey: .name)
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
        case .ok(let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(name, forKey: .name)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserRegisterExtractorInput: Codable {
    let name: String
    let pattern: String
}

enum ContentParserRegisterExtractorOutput: Codable {
    case ok(name: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case name
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                name: try container.decode(String.self, forKey: .name)
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
        case .ok(let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(name, forKey: .name)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserParseInput: Codable {
    let content: String
    let text: String
    let format: String
}

enum ContentParserParseOutput: Codable {
    case ok(ast: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case ast
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                ast: try container.decode(String.self, forKey: .ast)
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
        case .ok(let ast):
            try container.encode("ok", forKey: .variant)
            try container.encode(ast, forKey: .ast)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserExtractRefsInput: Codable {
    let content: String
}

enum ContentParserExtractRefsOutput: Codable {
    case ok(refs: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case refs
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                refs: try container.decode(String.self, forKey: .refs)
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
        case .ok(let refs):
            try container.encode("ok", forKey: .variant)
            try container.encode(refs, forKey: .refs)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserExtractTagsInput: Codable {
    let content: String
}

enum ContentParserExtractTagsOutput: Codable {
    case ok(tags: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tags
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tags: try container.decode(String.self, forKey: .tags)
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
        case .ok(let tags):
            try container.encode("ok", forKey: .variant)
            try container.encode(tags, forKey: .tags)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserExtractPropertiesInput: Codable {
    let content: String
}

enum ContentParserExtractPropertiesOutput: Codable {
    case ok(properties: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case properties
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                properties: try container.decode(String.self, forKey: .properties)
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
        case .ok(let properties):
            try container.encode("ok", forKey: .variant)
            try container.encode(properties, forKey: .properties)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentParserSerializeInput: Codable {
    let content: String
    let format: String
}

enum ContentParserSerializeOutput: Codable {
    case ok(text: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case text
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                text: try container.decode(String.self, forKey: .text)
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
        case .ok(let text):
            try container.encode("ok", forKey: .variant)
            try container.encode(text, forKey: .text)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

