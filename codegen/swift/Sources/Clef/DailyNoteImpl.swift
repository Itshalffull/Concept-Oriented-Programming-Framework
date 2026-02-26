// DailyNoteImpl.swift — DailyNote concept implementation

import Foundation

// MARK: - Types

public struct DailyNoteGetOrCreateTodayInput: Codable {
    public init() {}
}

public enum DailyNoteGetOrCreateTodayOutput: Codable {
    case ok(pageId: String, date: String, created: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case date
        case created
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pageId: try container.decode(String.self, forKey: .pageId),
                date: try container.decode(String.self, forKey: .date),
                created: try container.decode(Bool.self, forKey: .created)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pageId, let date, let created):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
            try container.encode(date, forKey: .date)
            try container.encode(created, forKey: .created)
        }
    }
}

public struct DailyNoteNavigateToDateInput: Codable {
    public let date: String

    public init(date: String) {
        self.date = date
    }
}

public enum DailyNoteNavigateToDateOutput: Codable {
    case ok(pageId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(pageId: try container.decode(String.self, forKey: .pageId))
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
        case .ok(let pageId):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DailyNoteListRecentInput: Codable {
    public let count: Int

    public init(count: Int) {
        self.count = count
    }
}

public enum DailyNoteListRecentOutput: Codable {
    case ok(notes: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case notes
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(notes: try container.decode(String.self, forKey: .notes))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let notes):
            try container.encode("ok", forKey: .variant)
            try container.encode(notes, forKey: .notes)
        }
    }
}

// MARK: - Handler Protocol

public protocol DailyNoteHandler {
    func getOrCreateToday(input: DailyNoteGetOrCreateTodayInput, storage: ConceptStorage) async throws -> DailyNoteGetOrCreateTodayOutput
    func navigateToDate(input: DailyNoteNavigateToDateInput, storage: ConceptStorage) async throws -> DailyNoteNavigateToDateOutput
    func listRecent(input: DailyNoteListRecentInput, storage: ConceptStorage) async throws -> DailyNoteListRecentOutput
}

// MARK: - Implementation

public struct DailyNoteHandlerImpl: DailyNoteHandler {
    public init() {}

    private func todayDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: Date())
    }

    public func getOrCreateToday(
        input: DailyNoteGetOrCreateTodayInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteGetOrCreateTodayOutput {
        let dateStr = todayDateString()

        // Check if today's note already exists
        if let existing = try await storage.get(relation: "daily_note", key: dateStr) {
            let pageId = existing["pageId"] as? String ?? ""
            return .ok(pageId: pageId, date: dateStr, created: false)
        }

        // Create new daily note
        let pageId = UUID().uuidString
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        try await storage.put(
            relation: "daily_note",
            key: dateStr,
            value: [
                "pageId": pageId,
                "date": dateStr,
                "createdAt": now,
            ]
        )

        return .ok(pageId: pageId, date: dateStr, created: true)
    }

    public func navigateToDate(
        input: DailyNoteNavigateToDateInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteNavigateToDateOutput {
        guard let existing = try await storage.get(relation: "daily_note", key: input.date) else {
            return .notfound(message: "Daily note for '\(input.date)' not found")
        }

        let pageId = existing["pageId"] as? String ?? ""
        return .ok(pageId: pageId)
    }

    public func listRecent(
        input: DailyNoteListRecentInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteListRecentOutput {
        let allNotes = try await storage.find(relation: "daily_note", criteria: nil)

        // Sort by date descending and take the requested count
        let sorted = allNotes.sorted { a, b in
            let dateA = a["date"] as? String ?? ""
            let dateB = b["date"] as? String ?? ""
            return dateA > dateB
        }

        let limited = Array(sorted.prefix(input.count))
        let noteDicts: [[String: String]] = limited.map { note in
            [
                "pageId": note["pageId"] as? String ?? "",
                "date": note["date"] as? String ?? "",
            ]
        }

        let jsonData = try JSONSerialization.data(withJSONObject: noteDicts, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(notes: jsonString)
    }
}
