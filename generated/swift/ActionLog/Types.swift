// generated: ActionLog/Types.swift

import Foundation

struct ActionLogAppendInput: Codable {
    let record: Any
}

enum ActionLogAppendOutput: Codable {
    case ok(id: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                id: try container.decode(String.self, forKey: .id)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        }
    }
}

struct ActionLogAddEdgeInput: Codable {
    let from: String
    let to: String
    let sync: String
}

enum ActionLogAddEdgeOutput: Codable {
    case ok

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        }
    }
}

struct ActionLogQueryInput: Codable {
    let flow: String
}

enum ActionLogQueryOutput: Codable {
    case ok(records: [Any])

    enum CodingKeys: String, CodingKey {
        case variant
        case records
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                records: try container.decode([Any].self, forKey: .records)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let records):
            try container.encode("ok", forKey: .variant)
            try container.encode(records, forKey: .records)
        }
    }
}

