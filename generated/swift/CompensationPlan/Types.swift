// generated: CompensationPlan/Types.swift

import Foundation

struct CompensationPlanRegisterInput: Codable {
    let runRef: String
    let stepKey: String
    let actionDescriptor: String
}

enum CompensationPlanRegisterOutput: Codable {
    case ok(plan: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case plan
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plan: try container.decode(String.self, forKey: .plan)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plan):
            try container.encode("ok", forKey: .variant)
            try container.encode(plan, forKey: .plan)
        }
    }
}

struct CompensationPlanTriggerInput: Codable {
    let runRef: String
}

enum CompensationPlanTriggerOutput: Codable {
    case ok(plan: String)
    case empty(runRef: String)
    case alreadyTriggered(runRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case plan
        case runRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plan: try container.decode(String.self, forKey: .plan)
            )
        case "empty":
            self = .empty(
                runRef: try container.decode(String.self, forKey: .runRef)
            )
        case "alreadyTriggered":
            self = .alreadyTriggered(
                runRef: try container.decode(String.self, forKey: .runRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plan):
            try container.encode("ok", forKey: .variant)
            try container.encode(plan, forKey: .plan)
        case .empty(let runRef):
            try container.encode("empty", forKey: .variant)
            try container.encode(runRef, forKey: .runRef)
        case .alreadyTriggered(let runRef):
            try container.encode("alreadyTriggered", forKey: .variant)
            try container.encode(runRef, forKey: .runRef)
        }
    }
}

struct CompensationPlanExecuteNextInput: Codable {
    let plan: String
}

enum CompensationPlanExecuteNextOutput: Codable {
    case ok(plan: String, stepKey: String, actionDescriptor: String)
    case allDone(plan: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case plan
        case stepKey
        case actionDescriptor
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plan: try container.decode(String.self, forKey: .plan),
                stepKey: try container.decode(String.self, forKey: .stepKey),
                actionDescriptor: try container.decode(String.self, forKey: .actionDescriptor)
            )
        case "allDone":
            self = .allDone(
                plan: try container.decode(String.self, forKey: .plan)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plan, let stepKey, let actionDescriptor):
            try container.encode("ok", forKey: .variant)
            try container.encode(plan, forKey: .plan)
            try container.encode(stepKey, forKey: .stepKey)
            try container.encode(actionDescriptor, forKey: .actionDescriptor)
        case .allDone(let plan):
            try container.encode("allDone", forKey: .variant)
            try container.encode(plan, forKey: .plan)
        }
    }
}

struct CompensationPlanMarkCompensationFailedInput: Codable {
    let plan: String
    let stepKey: String
    let error: String
}

enum CompensationPlanMarkCompensationFailedOutput: Codable {
    case ok(plan: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case plan
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plan: try container.decode(String.self, forKey: .plan)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plan):
            try container.encode("ok", forKey: .variant)
            try container.encode(plan, forKey: .plan)
        }
    }
}
