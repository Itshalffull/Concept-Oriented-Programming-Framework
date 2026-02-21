// generated: PageAsRecord/Types.swift

import Foundation

struct PageAsRecordCreateInput: Codable {
    let page: String
    let schema: String
}

enum PageAsRecordCreateOutput: Codable {
    case ok(page: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case page
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                page: try container.decode(String.self, forKey: .page)
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
        case .ok(let page):
            try container.encode("ok", forKey: .variant)
            try container.encode(page, forKey: .page)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PageAsRecordSetPropertyInput: Codable {
    let page: String
    let key: String
    let value: String
}

enum PageAsRecordSetPropertyOutput: Codable {
    case ok(page: String)
    case notfound(message: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case page
        case message
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                page: try container.decode(String.self, forKey: .page)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let page):
            try container.encode("ok", forKey: .variant)
            try container.encode(page, forKey: .page)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PageAsRecordGetPropertyInput: Codable {
    let page: String
    let key: String
}

enum PageAsRecordGetPropertyOutput: Codable {
    case ok(value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case value
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                value: try container.decode(String.self, forKey: .value)
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
        case .ok(let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PageAsRecordAppendToBodyInput: Codable {
    let page: String
    let content: String
}

enum PageAsRecordAppendToBodyOutput: Codable {
    case ok(page: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case page
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                page: try container.decode(String.self, forKey: .page)
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
        case .ok(let page):
            try container.encode("ok", forKey: .variant)
            try container.encode(page, forKey: .page)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PageAsRecordAttachToSchemaInput: Codable {
    let page: String
    let schema: String
}

enum PageAsRecordAttachToSchemaOutput: Codable {
    case ok(page: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case page
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                page: try container.decode(String.self, forKey: .page)
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
        case .ok(let page):
            try container.encode("ok", forKey: .variant)
            try container.encode(page, forKey: .page)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PageAsRecordConvertFromFreeformInput: Codable {
    let page: String
    let schema: String
}

enum PageAsRecordConvertFromFreeformOutput: Codable {
    case ok(page: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case page
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                page: try container.decode(String.self, forKey: .page)
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
        case .ok(let page):
            try container.encode("ok", forKey: .variant)
            try container.encode(page, forKey: .page)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

