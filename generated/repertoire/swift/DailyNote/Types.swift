// generated: DailyNote/Types.swift

import Foundation

struct DailyNoteGetOrCreateTodayInput: Codable {
    let note: String
}

enum DailyNoteGetOrCreateTodayOutput: Codable {
    case ok(note: String, created: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case note
        case created
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                note: try container.decode(String.self, forKey: .note),
                created: try container.decode(Bool.self, forKey: .created)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let note, let created):
            try container.encode("ok", forKey: .variant)
            try container.encode(note, forKey: .note)
            try container.encode(created, forKey: .created)
        }
    }
}

struct DailyNoteNavigateToDateInput: Codable {
    let date: String
}

enum DailyNoteNavigateToDateOutput: Codable {
    case ok(note: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case note
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                note: try container.decode(String.self, forKey: .note)
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
        case .ok(let note):
            try container.encode("ok", forKey: .variant)
            try container.encode(note, forKey: .note)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DailyNoteListRecentInput: Codable {
    let count: Int
}

enum DailyNoteListRecentOutput: Codable {
    case ok(notes: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case notes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                notes: try container.decode(String.self, forKey: .notes)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let notes):
            try container.encode("ok", forKey: .variant)
            try container.encode(notes, forKey: .notes)
        }
    }
}

