// generated: View/Types.swift

import Foundation

struct ViewCreateInput: Codable {
    let view: String
    let dataSource: String
    let layout: String
}

enum ViewCreateOutput: Codable {
    case ok(view: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewSetFilterInput: Codable {
    let view: String
    let filter: String
}

enum ViewSetFilterOutput: Codable {
    case ok(view: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewSetSortInput: Codable {
    let view: String
    let sort: String
}

enum ViewSetSortOutput: Codable {
    case ok(view: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewSetGroupInput: Codable {
    let view: String
    let group: String
}

enum ViewSetGroupOutput: Codable {
    case ok(view: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewSetVisibleFieldsInput: Codable {
    let view: String
    let fields: String
}

enum ViewSetVisibleFieldsOutput: Codable {
    case ok(view: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewChangeLayoutInput: Codable {
    let view: String
    let layout: String
}

enum ViewChangeLayoutOutput: Codable {
    case ok(view: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case view
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                view: try container.decode(String.self, forKey: .view)
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
        case .ok(let view):
            try container.encode("ok", forKey: .variant)
            try container.encode(view, forKey: .view)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewDuplicateInput: Codable {
    let view: String
}

enum ViewDuplicateOutput: Codable {
    case ok(newView: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case newView
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                newView: try container.decode(String.self, forKey: .newView)
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
        case .ok(let newView):
            try container.encode("ok", forKey: .variant)
            try container.encode(newView, forKey: .newView)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewEmbedInput: Codable {
    let view: String
}

enum ViewEmbedOutput: Codable {
    case ok(embedCode: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case embedCode
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                embedCode: try container.decode(String.self, forKey: .embedCode)
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
        case .ok(let embedCode):
            try container.encode("ok", forKey: .variant)
            try container.encode(embedCode, forKey: .embedCode)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

