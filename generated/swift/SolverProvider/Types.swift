// generated: SolverProvider/Types.swift

import Foundation

struct SolverProviderRegisterInput: Codable {
    let provider_id: String
    let supported_languages: [String]
    let supported_kinds: [String]
    let capabilities: Set<String>
    let priority: Int
}

enum SolverProviderRegisterOutput: Codable {
    case ok(provider: String)
    case duplicate(provider_id: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case provider
        case provider_id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                provider: try container.decode(String.self, forKey: .provider)
            )
        case "duplicate":
            self = .duplicate(
                provider_id: try container.decode(String.self, forKey: .provider_id)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let provider):
            try container.encode("ok", forKey: .variant)
            try container.encode(provider, forKey: .provider)
        case .duplicate(let provider_id):
            try container.encode("duplicate", forKey: .variant)
            try container.encode(provider_id, forKey: .provider_id)
        }
    }
}

struct SolverProviderDispatchInput: Codable {
    let property_ref: String
    let formal_language: String
    let kind: String
    let timeout_ms: Int
}

enum SolverProviderDispatchOutput: Codable {
    case ok(provider: String, run_ref: String)
    case no_provider(formal_language: String, kind: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case provider
        case run_ref
        case formal_language
        case kind
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                provider: try container.decode(String.self, forKey: .provider),
                run_ref: try container.decode(String.self, forKey: .run_ref)
            )
        case "no_provider":
            self = .no_provider(
                formal_language: try container.decode(String.self, forKey: .formal_language),
                kind: try container.decode(String.self, forKey: .kind)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let provider, let run_ref):
            try container.encode("ok", forKey: .variant)
            try container.encode(provider, forKey: .provider)
            try container.encode(run_ref, forKey: .run_ref)
        case .no_provider(let formal_language, let kind):
            try container.encode("no_provider", forKey: .variant)
            try container.encode(formal_language, forKey: .formal_language)
            try container.encode(kind, forKey: .kind)
        }
    }
}

struct SolverProviderDispatch_batchInput: Codable {
    let properties: [String]
    let timeout_ms: Int
}

enum SolverProviderDispatch_batchOutput: Codable {
    case ok(assignments: [(property_ref: String, provider: String)])
    case partial(assigned: [String], unassigned: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case assignments
        case assigned
        case unassigned
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                assignments: try container.decode([(property_ref: String, provider: String)].self, forKey: .assignments)
            )
        case "partial":
            self = .partial(
                assigned: try container.decode([String].self, forKey: .assigned),
                unassigned: try container.decode([String].self, forKey: .unassigned)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let assignments):
            try container.encode("ok", forKey: .variant)
            try container.encode(assignments, forKey: .assignments)
        case .partial(let assigned, let unassigned):
            try container.encode("partial", forKey: .variant)
            try container.encode(assigned, forKey: .assigned)
            try container.encode(unassigned, forKey: .unassigned)
        }
    }
}

struct SolverProviderHealth_checkInput: Codable {
    let provider: String
}

enum SolverProviderHealth_checkOutput: Codable {
    case ok(provider: String, status: String, latency_ms: Int)
    case unavailable(provider: String, message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case provider
        case status
        case latency_ms
        case provider
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                provider: try container.decode(String.self, forKey: .provider),
                status: try container.decode(String.self, forKey: .status),
                latency_ms: try container.decode(Int.self, forKey: .latency_ms)
            )
        case "unavailable":
            self = .unavailable(
                provider: try container.decode(String.self, forKey: .provider),
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let provider, let status, let latency_ms):
            try container.encode("ok", forKey: .variant)
            try container.encode(provider, forKey: .provider)
            try container.encode(status, forKey: .status)
            try container.encode(latency_ms, forKey: .latency_ms)
        case .unavailable(let provider, let message):
            try container.encode("unavailable", forKey: .variant)
            try container.encode(provider, forKey: .provider)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SolverProviderListInput: Codable {
}

enum SolverProviderListOutput: Codable {
    case ok(providers: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case providers
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                providers: try container.decode([String].self, forKey: .providers)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let providers):
            try container.encode("ok", forKey: .variant)
            try container.encode(providers, forKey: .providers)
        }
    }
}

struct SolverProviderUnregisterInput: Codable {
    let provider_id: String
}

enum SolverProviderUnregisterOutput: Codable {
    case ok
    case notfound(provider_id: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case provider_id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound":
            self = .notfound(
                provider_id: try container.decode(String.self, forKey: .provider_id)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let provider_id):
            try container.encode("notfound", forKey: .variant)
            try container.encode(provider_id, forKey: .provider_id)
        }
    }
}
