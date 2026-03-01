// generated: Timer/Types.swift

import Foundation

struct TimerSetTimerInput: Codable {
    let runRef: String
    let timerType: String
    let specification: String
    let purposeTag: String
    let contextRef: String
}

enum TimerSetTimerOutput: Codable {
    case ok(timer: String, runRef: String, nextFireAt: String)
    case invalidSpec(specification: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case timer
        case runRef
        case nextFireAt
        case specification
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                timer: try container.decode(String.self, forKey: .timer),
                runRef: try container.decode(String.self, forKey: .runRef),
                nextFireAt: try container.decode(String.self, forKey: .nextFireAt)
            )
        case "invalidSpec":
            self = .invalidSpec(
                specification: try container.decode(String.self, forKey: .specification)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let timer, let runRef, let nextFireAt):
            try container.encode("ok", forKey: .variant)
            try container.encode(timer, forKey: .timer)
            try container.encode(runRef, forKey: .runRef)
            try container.encode(nextFireAt, forKey: .nextFireAt)
        case .invalidSpec(let specification):
            try container.encode("invalidSpec", forKey: .variant)
            try container.encode(specification, forKey: .specification)
        }
    }
}

struct TimerFireInput: Codable {
    let timer: String
}

enum TimerFireOutput: Codable {
    case ok(timer: String, runRef: String, purposeTag: String, contextRef: String)
    case notActive(timer: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case timer
        case runRef
        case purposeTag
        case contextRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                timer: try container.decode(String.self, forKey: .timer),
                runRef: try container.decode(String.self, forKey: .runRef),
                purposeTag: try container.decode(String.self, forKey: .purposeTag),
                contextRef: try container.decode(String.self, forKey: .contextRef)
            )
        case "notActive":
            self = .notActive(
                timer: try container.decode(String.self, forKey: .timer)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let timer, let runRef, let purposeTag, let contextRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(timer, forKey: .timer)
            try container.encode(runRef, forKey: .runRef)
            try container.encode(purposeTag, forKey: .purposeTag)
            try container.encode(contextRef, forKey: .contextRef)
        case .notActive(let timer):
            try container.encode("notActive", forKey: .variant)
            try container.encode(timer, forKey: .timer)
        }
    }
}

struct TimerCancelInput: Codable {
    let timer: String
}

enum TimerCancelOutput: Codable {
    case ok(timer: String)
    case notActive(timer: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case timer
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                timer: try container.decode(String.self, forKey: .timer)
            )
        case "notActive":
            self = .notActive(
                timer: try container.decode(String.self, forKey: .timer)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let timer):
            try container.encode("ok", forKey: .variant)
            try container.encode(timer, forKey: .timer)
        case .notActive(let timer):
            try container.encode("notActive", forKey: .variant)
            try container.encode(timer, forKey: .timer)
        }
    }
}

struct TimerResetInput: Codable {
    let timer: String
    let specification: String
}

enum TimerResetOutput: Codable {
    case ok(timer: String, nextFireAt: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case timer
        case nextFireAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                timer: try container.decode(String.self, forKey: .timer),
                nextFireAt: try container.decode(String.self, forKey: .nextFireAt)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let timer, let nextFireAt):
            try container.encode("ok", forKey: .variant)
            try container.encode(timer, forKey: .timer)
            try container.encode(nextFireAt, forKey: .nextFireAt)
        }
    }
}
