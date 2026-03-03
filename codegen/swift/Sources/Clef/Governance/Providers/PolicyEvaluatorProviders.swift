// PolicyEvaluatorProviders.swift — Governance Policy Evaluator providers: CustomEvaluator, AdicoEvaluator, CedarEvaluator, RegoEvaluator

import Foundation

// MARK: - CustomEvaluator Types

public struct CustomEvaluatorRegisterInput: Codable { public let name: String; public let source: String; public let language: String?; public let sandbox: Bool?; public init(name: String, source: String, language: String? = nil, sandbox: Bool? = nil) { self.name = name; self.source = source; self.language = language; self.sandbox = sandbox } }
public enum CustomEvaluatorRegisterOutput: Codable { case registered(evaluator: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, evaluator, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "registered": self = .registered(evaluator: try c.decode(String.self, forKey: .evaluator)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .registered(let evaluator): try c.encode("registered", forKey: .variant); try c.encode(evaluator, forKey: .evaluator); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct CustomEvaluatorEvaluateInput: Codable { public let evaluator: String; public let context: String; public init(evaluator: String, context: String) { self.evaluator = evaluator; self.context = context } }
public enum CustomEvaluatorEvaluateOutput: Codable { case result(evaluator: String, output: Bool, decision: String); case notFound(evaluator: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, evaluator, output, decision, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "result": self = .result(evaluator: try c.decode(String.self, forKey: .evaluator), output: try c.decode(Bool.self, forKey: .output), decision: try c.decode(String.self, forKey: .decision)); case "not_found": self = .notFound(evaluator: try c.decode(String.self, forKey: .evaluator)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .result(let evaluator, let output, let decision): try c.encode("result", forKey: .variant); try c.encode(evaluator, forKey: .evaluator); try c.encode(output, forKey: .output); try c.encode(decision, forKey: .decision); case .notFound(let evaluator): try c.encode("not_found", forKey: .variant); try c.encode(evaluator, forKey: .evaluator); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct CustomEvaluatorDeregisterInput: Codable { public let evaluator: String; public init(evaluator: String) { self.evaluator = evaluator } }
public enum CustomEvaluatorDeregisterOutput: Codable { case deregistered(evaluator: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, evaluator, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "deregistered": self = .deregistered(evaluator: try c.decode(String.self, forKey: .evaluator)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .deregistered(let evaluator): try c.encode("deregistered", forKey: .variant); try c.encode(evaluator, forKey: .evaluator); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - AdicoEvaluator Types

public struct AdicoEvaluatorParseInput: Codable { public let ruleText: String; public let structured: String?; public init(ruleText: String, structured: String? = nil) { self.ruleText = ruleText; self.structured = structured } }
public enum AdicoEvaluatorParseOutput: Codable { case parsed(rule: String); case parseError(sourceText: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, rule, sourceText, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "parsed": self = .parsed(rule: try c.decode(String.self, forKey: .rule)); case "parse_error": self = .parseError(sourceText: try c.decode(String.self, forKey: .sourceText)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .parsed(let rule): try c.encode("parsed", forKey: .variant); try c.encode(rule, forKey: .rule); case .parseError(let sourceText): try c.encode("parse_error", forKey: .variant); try c.encode(sourceText, forKey: .sourceText); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct AdicoEvaluatorEvaluateInput: Codable { public let rule: String; public let context: String; public init(rule: String, context: String) { self.rule = rule; self.context = context } }
public enum AdicoEvaluatorEvaluateOutput: Codable { case obligated(rule: String, aim: String, orElse: String?); case forbidden(rule: String, aim: String, orElse: String?); case permitted(rule: String, aim: String); case recommended(rule: String, aim: String); case notApplicable(rule: String, reason: String); case notFound(rule: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, rule, aim, orElse, reason, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "obligated": self = .obligated(rule: try c.decode(String.self, forKey: .rule), aim: try c.decode(String.self, forKey: .aim), orElse: try c.decodeIfPresent(String.self, forKey: .orElse)); case "forbidden": self = .forbidden(rule: try c.decode(String.self, forKey: .rule), aim: try c.decode(String.self, forKey: .aim), orElse: try c.decodeIfPresent(String.self, forKey: .orElse)); case "permitted": self = .permitted(rule: try c.decode(String.self, forKey: .rule), aim: try c.decode(String.self, forKey: .aim)); case "recommended": self = .recommended(rule: try c.decode(String.self, forKey: .rule), aim: try c.decode(String.self, forKey: .aim)); case "not_applicable": self = .notApplicable(rule: try c.decode(String.self, forKey: .rule), reason: try c.decode(String.self, forKey: .reason)); case "not_found": self = .notFound(rule: try c.decode(String.self, forKey: .rule)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .obligated(let rule, let aim, let orElse): try c.encode("obligated", forKey: .variant); try c.encode(rule, forKey: .rule); try c.encode(aim, forKey: .aim); try c.encode(orElse, forKey: .orElse); case .forbidden(let rule, let aim, let orElse): try c.encode("forbidden", forKey: .variant); try c.encode(rule, forKey: .rule); try c.encode(aim, forKey: .aim); try c.encode(orElse, forKey: .orElse); case .permitted(let rule, let aim): try c.encode("permitted", forKey: .variant); try c.encode(rule, forKey: .rule); try c.encode(aim, forKey: .aim); case .recommended(let rule, let aim): try c.encode("recommended", forKey: .variant); try c.encode(rule, forKey: .rule); try c.encode(aim, forKey: .aim); case .notApplicable(let rule, let reason): try c.encode("not_applicable", forKey: .variant); try c.encode(rule, forKey: .rule); try c.encode(reason, forKey: .reason); case .notFound(let rule): try c.encode("not_found", forKey: .variant); try c.encode(rule, forKey: .rule); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - CedarEvaluator Types

public struct CedarEvaluatorLoadInput: Codable { public let policies: String; public let schema: String?; public init(policies: String, schema: String? = nil) { self.policies = policies; self.schema = schema } }
public enum CedarEvaluatorLoadOutput: Codable { case loaded(store: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, store, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "loaded": self = .loaded(store: try c.decode(String.self, forKey: .store)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .loaded(let store): try c.encode("loaded", forKey: .variant); try c.encode(store, forKey: .store); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct CedarEvaluatorAuthorizeInput: Codable { public let store: String; public let principal: String; public let action: String; public let resource: String; public let context: String?; public init(store: String, principal: String, action: String, resource: String, context: String? = nil) { self.store = store; self.principal = principal; self.action = action; self.resource = resource; self.context = context } }
public enum CedarEvaluatorAuthorizeOutput: Codable { case allow(store: String); case deny(store: String, reason: String); case notFound(store: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, store, reason, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "allow": self = .allow(store: try c.decode(String.self, forKey: .store)); case "deny": self = .deny(store: try c.decode(String.self, forKey: .store), reason: try c.decode(String.self, forKey: .reason)); case "not_found": self = .notFound(store: try c.decode(String.self, forKey: .store)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .allow(let store): try c.encode("allow", forKey: .variant); try c.encode(store, forKey: .store); case .deny(let store, let reason): try c.encode("deny", forKey: .variant); try c.encode(store, forKey: .store); try c.encode(reason, forKey: .reason); case .notFound(let store): try c.encode("not_found", forKey: .variant); try c.encode(store, forKey: .store); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct CedarEvaluatorVerifyInput: Codable { public let store: String; public let property: String; public init(store: String, property: String) { self.store = store; self.property = property } }
public enum CedarEvaluatorVerifyOutput: Codable { case verified(store: String, property: String); case conflictFound(store: String, property: String, conflictAt: String); case notFound(store: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, store, property, conflictAt, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "verified": self = .verified(store: try c.decode(String.self, forKey: .store), property: try c.decode(String.self, forKey: .property)); case "conflict_found": self = .conflictFound(store: try c.decode(String.self, forKey: .store), property: try c.decode(String.self, forKey: .property), conflictAt: try c.decode(String.self, forKey: .conflictAt)); case "not_found": self = .notFound(store: try c.decode(String.self, forKey: .store)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .verified(let store, let property): try c.encode("verified", forKey: .variant); try c.encode(store, forKey: .store); try c.encode(property, forKey: .property); case .conflictFound(let store, let property, let conflictAt): try c.encode("conflict_found", forKey: .variant); try c.encode(store, forKey: .store); try c.encode(property, forKey: .property); try c.encode(conflictAt, forKey: .conflictAt); case .notFound(let store): try c.encode("not_found", forKey: .variant); try c.encode(store, forKey: .store); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - RegoEvaluator Types

public struct RegoEvaluatorLoadBundleInput: Codable { public let policySource: String; public let dataSource: String?; public let packageName: String; public init(policySource: String, dataSource: String? = nil, packageName: String) { self.policySource = policySource; self.dataSource = dataSource; self.packageName = packageName } }
public enum RegoEvaluatorLoadBundleOutput: Codable { case loaded(bundle: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, bundle, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "loaded": self = .loaded(bundle: try c.decode(String.self, forKey: .bundle)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .loaded(let bundle): try c.encode("loaded", forKey: .variant); try c.encode(bundle, forKey: .bundle); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct RegoEvaluatorEvaluateInput: Codable { public let bundle: String; public let input: String?; public init(bundle: String, input: String? = nil) { self.bundle = bundle; self.input = input } }
public enum RegoEvaluatorEvaluateOutput: Codable { case result(decision: String, bindings: String); case notFound(bundle: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, decision, bindings, bundle, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "result": self = .result(decision: try c.decode(String.self, forKey: .decision), bindings: try c.decode(String.self, forKey: .bindings)); case "not_found": self = .notFound(bundle: try c.decode(String.self, forKey: .bundle)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .result(let decision, let bindings): try c.encode("result", forKey: .variant); try c.encode(decision, forKey: .decision); try c.encode(bindings, forKey: .bindings); case .notFound(let bundle): try c.encode("not_found", forKey: .variant); try c.encode(bundle, forKey: .bundle); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct RegoEvaluatorUpdateDataInput: Codable { public let bundle: String; public let newData: String; public init(bundle: String, newData: String) { self.bundle = bundle; self.newData = newData } }
public enum RegoEvaluatorUpdateDataOutput: Codable { case updated(bundle: String); case notFound(bundle: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, bundle, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "updated": self = .updated(bundle: try c.decode(String.self, forKey: .bundle)); case "not_found": self = .notFound(bundle: try c.decode(String.self, forKey: .bundle)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .updated(let bundle): try c.encode("updated", forKey: .variant); try c.encode(bundle, forKey: .bundle); case .notFound(let bundle): try c.encode("not_found", forKey: .variant); try c.encode(bundle, forKey: .bundle); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Handler Protocols

public protocol CustomEvaluatorHandler { func register(input: CustomEvaluatorRegisterInput, storage: ConceptStorage) async throws -> CustomEvaluatorRegisterOutput; func evaluate(input: CustomEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> CustomEvaluatorEvaluateOutput; func deregister(input: CustomEvaluatorDeregisterInput, storage: ConceptStorage) async throws -> CustomEvaluatorDeregisterOutput }
public protocol AdicoEvaluatorHandler { func parse(input: AdicoEvaluatorParseInput, storage: ConceptStorage) async throws -> AdicoEvaluatorParseOutput; func evaluate(input: AdicoEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> AdicoEvaluatorEvaluateOutput }
public protocol CedarEvaluatorHandler { func loadPolicies(input: CedarEvaluatorLoadInput, storage: ConceptStorage) async throws -> CedarEvaluatorLoadOutput; func authorize(input: CedarEvaluatorAuthorizeInput, storage: ConceptStorage) async throws -> CedarEvaluatorAuthorizeOutput; func verify(input: CedarEvaluatorVerifyInput, storage: ConceptStorage) async throws -> CedarEvaluatorVerifyOutput }
public protocol RegoEvaluatorHandler { func loadBundle(input: RegoEvaluatorLoadBundleInput, storage: ConceptStorage) async throws -> RegoEvaluatorLoadBundleOutput; func evaluate(input: RegoEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> RegoEvaluatorEvaluateOutput; func updateData(input: RegoEvaluatorUpdateDataInput, storage: ConceptStorage) async throws -> RegoEvaluatorUpdateDataOutput }

// MARK: - Predicate Tree Evaluator Helper

private func resolvePath(_ path: String, _ obj: [String: Any]) -> Any? {
    let parts = path.split(separator: ".").map(String.init)
    var current: Any = obj
    for part in parts {
        guard let dict = current as? [String: Any], let next = dict[part] else { return nil }
        current = next
    }
    return current
}

private func evaluatePredicate(_ node: [String: Any], _ context: [String: Any]) -> Bool {
    guard let op = node["op"] as? String else { return false }
    switch op {
    case "and":
        guard let args = node["args"] as? [[String: Any]] else { return false }
        return args.allSatisfy { evaluatePredicate($0, context) }
    case "or":
        guard let args = node["args"] as? [[String: Any]] else { return false }
        return args.contains { evaluatePredicate($0, context) }
    case "not":
        guard let args = node["args"] as? [[String: Any]], let first = args.first else { return false }
        return !evaluatePredicate(first, context)
    case "eq": return "\(resolvePath(node["field"] as? String ?? "", context) ?? "")" == "\(node["value"] ?? "")"
    case "neq": return "\(resolvePath(node["field"] as? String ?? "", context) ?? "")" != "\(node["value"] ?? "")"
    case "gt": return ((resolvePath(node["field"] as? String ?? "", context) as? Double) ?? 0) > ((node["value"] as? Double) ?? 0)
    case "gte": return ((resolvePath(node["field"] as? String ?? "", context) as? Double) ?? 0) >= ((node["value"] as? Double) ?? 0)
    case "lt": return ((resolvePath(node["field"] as? String ?? "", context) as? Double) ?? 0) < ((node["value"] as? Double) ?? 0)
    case "lte": return ((resolvePath(node["field"] as? String ?? "", context) as? Double) ?? 0) <= ((node["value"] as? Double) ?? 0)
    case "in":
        let val = "\(resolvePath(node["field"] as? String ?? "", context) ?? "")"
        if let list = node["value"] as? [String] { return list.contains(val) }
        return false
    case "contains":
        if let arr = resolvePath(node["field"] as? String ?? "", context) as? [String] { return arr.contains("\(node["value"] ?? "")") }
        return false
    default: return false
    }
}

// MARK: - Handler Implementations

public struct CustomEvaluatorHandlerImpl: CustomEvaluatorHandler {
    public init() {}
    public func register(input: CustomEvaluatorRegisterInput, storage: ConceptStorage) async throws -> CustomEvaluatorRegisterOutput {
        let id = "custom-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "custom_eval", key: id, value: ["id": id, "name": input.name, "predicateTree": input.source, "language": input.language ?? "predicate-tree", "sandbox": input.sandbox ?? true])
        try await storage.put(relation: "plugin-registry", key: "policy-evaluator:\(id)", value: ["id": "policy-evaluator:\(id)", "pluginKind": "policy-evaluator", "provider": "CustomEvaluator", "instanceId": id])
        return .registered(evaluator: id)
    }

    public func evaluate(input: CustomEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> CustomEvaluatorEvaluateOutput {
        guard let record = try await storage.get(relation: "custom_eval", key: input.evaluator) else { return .notFound(evaluator: input.evaluator) }
        let treeSource = record["predicateTree"] as? String ?? "{}"
        guard let treeData = treeSource.data(using: .utf8), let tree = try? JSONSerialization.jsonObject(with: treeData) as? [String: Any] else { return .result(evaluator: input.evaluator, output: false, decision: "deny") }
        guard let ctxData = input.context.data(using: .utf8), let ctx = try? JSONSerialization.jsonObject(with: ctxData) as? [String: Any] else { return .result(evaluator: input.evaluator, output: false, decision: "deny") }
        let result = evaluatePredicate(tree, ctx)
        return .result(evaluator: input.evaluator, output: result, decision: result ? "allow" : "deny")
    }

    public func deregister(input: CustomEvaluatorDeregisterInput, storage: ConceptStorage) async throws -> CustomEvaluatorDeregisterOutput {
        try await storage.del(relation: "custom_eval", key: input.evaluator)
        return .deregistered(evaluator: input.evaluator)
    }
}

public struct AdicoEvaluatorHandlerImpl: AdicoEvaluatorHandler {
    public init() {}

    public func parse(input: AdicoEvaluatorParseInput, storage: ConceptStorage) async throws -> AdicoEvaluatorParseOutput {
        let id = "adico-\(Int(Date().timeIntervalSince1970 * 1000))"
        // Parse ADICO grammar: A(attributes) D(deontic) I(aim) C(conditions) [O(orElse)]
        let pattern = try NSRegularExpression(pattern: #"A\(([^)]*)\)\s*D\(([^)]*)\)\s*I\(([^)]*)\)\s*C\(([^)]*)\)(?:\s*O\(([^)]*)\))?"#, options: [.caseInsensitive])
        let range = NSRange(input.ruleText.startIndex..<input.ruleText.endIndex, in: input.ruleText)
        if let match = pattern.firstMatch(in: input.ruleText, range: range) {
            func group(_ i: Int) -> String? { guard let r = Range(match.range(at: i), in: input.ruleText) else { return nil }; return String(input.ruleText[r]).trimmingCharacters(in: .whitespaces) }
            let attributes = group(1) ?? ""; let deontic = (group(2) ?? "").lowercased(); let aim = group(3) ?? ""; let conditions = group(4) ?? ""; let orElse = group(5)
            try await storage.put(relation: "adico", key: id, value: ["id": id, "sourceText": input.ruleText, "attributes": attributes, "deontic": deontic, "aim": aim, "conditions": conditions, "orElse": orElse as Any, "parsedAt": ISO8601DateFormatter().string(from: Date())])
            try await storage.put(relation: "plugin-registry", key: "policy-evaluator:\(id)", value: ["id": "policy-evaluator:\(id)", "pluginKind": "policy-evaluator", "provider": "AdicoEvaluator", "instanceId": id])
            return .parsed(rule: id)
        }
        if let structured = input.structured, let data = structured.data(using: .utf8), let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            var value: [String: Any] = ["id": id, "sourceText": input.ruleText, "parsedAt": ISO8601DateFormatter().string(from: Date())]
            for (k, v) in parsed { value[k] = v }
            try await storage.put(relation: "adico", key: id, value: value)
            return .parsed(rule: id)
        }
        return .parseError(sourceText: input.ruleText)
    }

    public func evaluate(input: AdicoEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> AdicoEvaluatorEvaluateOutput {
        guard let record = try await storage.get(relation: "adico", key: input.rule) else { return .notFound(rule: input.rule) }
        guard let ctxData = input.context.data(using: .utf8), let ctx = try? JSONSerialization.jsonObject(with: ctxData) as? [String: Any] else { return .notApplicable(rule: input.rule, reason: "invalid context") }
        let attributes = (record["attributes"] as? String) ?? ""; let deontic = (record["deontic"] as? String) ?? ""; let aim = (record["aim"] as? String) ?? ""; let conditions = (record["conditions"] as? String) ?? ""; let orElse = record["orElse"] as? String
        let actor = ctx["actor"] as? String; let actorRole = ctx["role"] as? String
        let attributeMatch = attributes.isEmpty || attributes == "*" || actor == attributes || actorRole == attributes
        guard attributeMatch else { return .notApplicable(rule: input.rule, reason: "actor mismatch") }
        let action = ctx["action"] as? String
        let aimMatch = aim.isEmpty || aim == "*" || action == aim
        guard aimMatch else { return .notApplicable(rule: input.rule, reason: "aim mismatch") }
        let conditionMet = conditions.isEmpty || conditions == "*" || conditions == "always" || (ctx[conditions] as? Bool) == true
        guard conditionMet else { return .notApplicable(rule: input.rule, reason: "conditions not met") }
        switch deontic {
        case "must": return .obligated(rule: input.rule, aim: aim, orElse: orElse)
        case "must not": return .forbidden(rule: input.rule, aim: aim, orElse: orElse)
        case "may": return .permitted(rule: input.rule, aim: aim)
        case "should": return .recommended(rule: input.rule, aim: aim)
        default: return .permitted(rule: input.rule, aim: aim)
        }
    }
}

public struct CedarEvaluatorHandlerImpl: CedarEvaluatorHandler {
    public init() {}
    public func loadPolicies(input: CedarEvaluatorLoadInput, storage: ConceptStorage) async throws -> CedarEvaluatorLoadOutput {
        let id = "cedar-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "cedar", key: id, value: ["id": id, "policies": input.policies, "schema": input.schema as Any])
        try await storage.put(relation: "plugin-registry", key: "policy-evaluator:\(id)", value: ["id": "policy-evaluator:\(id)", "pluginKind": "policy-evaluator", "provider": "CedarEvaluator", "instanceId": id])
        return .loaded(store: id)
    }

    public func authorize(input: CedarEvaluatorAuthorizeInput, storage: ConceptStorage) async throws -> CedarEvaluatorAuthorizeOutput {
        guard let record = try await storage.get(relation: "cedar", key: input.store) else { return .notFound(store: input.store) }
        guard let policyStr = record["policies"] as? String, let policyData = policyStr.data(using: .utf8), let policies = try? JSONSerialization.jsonObject(with: policyData) as? [[String: Any]] else { return .deny(store: input.store, reason: "No matching permit policy") }
        var hasPermit = false
        for policy in policies {
            let pPrincipal = policy["principal"] as? String; let pAction = policy["action"] as? String; let pResource = policy["resource"] as? String
            if let pp = pPrincipal, pp != input.principal && pp != "*" { continue }
            if let pa = pAction, pa != input.action && pa != "*" { continue }
            if let pr = pResource, pr != input.resource && pr != "*" { continue }
            let effect = (policy["effect"] as? String) ?? ""
            if effect == "forbid" { return .deny(store: input.store, reason: "Forbidden by policy: \(pPrincipal ?? "*")/\(pAction ?? "*")/\(pResource ?? "*")") }
            if effect == "permit" { hasPermit = true }
        }
        if hasPermit { return .allow(store: input.store) }
        return .deny(store: input.store, reason: "No matching permit policy")
    }

    public func verify(input: CedarEvaluatorVerifyInput, storage: ConceptStorage) async throws -> CedarEvaluatorVerifyOutput {
        guard let record = try await storage.get(relation: "cedar", key: input.store) else { return .notFound(store: input.store) }
        guard let policyStr = record["policies"] as? String, let policyData = policyStr.data(using: .utf8), let policies = try? JSONSerialization.jsonObject(with: policyData) as? [[String: Any]] else { return .verified(store: input.store, property: input.property) }
        if input.property == "no_conflicts" {
            var signatures: [String: [String]] = [:]
            for p in policies { let sig = "\(p["principal"] ?? "*"):\(p["action"] ?? "*"):\(p["resource"] ?? "*")"; signatures[sig, default: []].append((p["effect"] as? String) ?? "") }
            for (sig, effects) in signatures { if effects.contains("permit") && effects.contains("forbid") { return .conflictFound(store: input.store, property: input.property, conflictAt: sig) } }
        }
        return .verified(store: input.store, property: input.property)
    }
}

public struct RegoEvaluatorHandlerImpl: RegoEvaluatorHandler {
    public init() {}
    public func loadBundle(input: RegoEvaluatorLoadBundleInput, storage: ConceptStorage) async throws -> RegoEvaluatorLoadBundleOutput {
        let id = "rego-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "rego", key: id, value: ["id": id, "rules": input.policySource, "data": input.dataSource ?? "{}", "packageName": input.packageName, "compiledAt": ISO8601DateFormatter().string(from: Date())])
        try await storage.put(relation: "plugin-registry", key: "policy-evaluator:\(id)", value: ["id": "policy-evaluator:\(id)", "pluginKind": "policy-evaluator", "provider": "RegoEvaluator", "instanceId": id])
        return .loaded(bundle: id)
    }

    public func evaluate(input: RegoEvaluatorEvaluateInput, storage: ConceptStorage) async throws -> RegoEvaluatorEvaluateOutput {
        guard let record = try await storage.get(relation: "rego", key: input.bundle) else { return .notFound(bundle: input.bundle) }
        let rulesStr = (record["rules"] as? String) ?? "[]"; let dataStr = (record["data"] as? String) ?? "{}"
        guard let rulesData = rulesStr.data(using: .utf8), let rules = try? JSONSerialization.jsonObject(with: rulesData) as? [[String: Any]] else { return .result(decision: "deny", bindings: "{}") }
        let data = (try? JSONSerialization.jsonObject(with: dataStr.data(using: .utf8) ?? Data()) as? [String: Any]) ?? [:]
        let evalInput = input.input ?? "{}"
        let ctx = (try? JSONSerialization.jsonObject(with: evalInput.data(using: .utf8) ?? Data()) as? [String: Any]) ?? [:]

        var bindings: [String: Bool] = [:]; var decision = "deny"
        for rule in rules {
            let name = (rule["name"] as? String) ?? ""; let body = (rule["body"] as? [[String: Any]]) ?? []
            var result = true
            for clause in body {
                let opStr = (clause["op"] as? String) ?? ""; let path = (clause["path"] as? String) ?? ""
                let resolved: Any? = path.hasPrefix("data.") ? resolvePath(String(path.dropFirst(5)), data) : resolvePath(path, ctx)
                switch opStr {
                case "eq":
                    let target: Any? = (clause["dataPath"] as? String).flatMap { resolvePath($0, data) } ?? clause["value"]
                    if "\(resolved ?? "")" != "\(target ?? "")" { result = false }
                case "neq": if "\(resolved ?? "")" == "\(clause["value"] ?? "")" { result = false }
                case "in": let list = (clause["dataPath"] as? String).flatMap { resolvePath($0, data) as? [String] } ?? (clause["value"] as? [String]); if !(list?.contains("\(resolved ?? "")") ?? false) { result = false }
                case "gt": if ((resolved as? Double) ?? 0) <= ((clause["value"] as? Double) ?? 0) { result = false }
                case "gte": if ((resolved as? Double) ?? 0) < ((clause["value"] as? Double) ?? 0) { result = false }
                case "lt": if ((resolved as? Double) ?? 0) >= ((clause["value"] as? Double) ?? 0) { result = false }
                case "exists": if resolved == nil { result = false }
                default: result = false
                }
            }
            bindings[name] = result
            if name == "allow" && result { decision = "allow" }
        }
        let encoder = JSONEncoder()
        let bindingsJson = String(data: try encoder.encode(bindings), encoding: .utf8) ?? "{}"
        return .result(decision: decision, bindings: bindingsJson)
    }

    public func updateData(input: RegoEvaluatorUpdateDataInput, storage: ConceptStorage) async throws -> RegoEvaluatorUpdateDataOutput {
        guard let record = try await storage.get(relation: "rego", key: input.bundle) else { return .notFound(bundle: input.bundle) }
        let existingStr = (record["data"] as? String) ?? "{}"; var existing = (try? JSONSerialization.jsonObject(with: existingStr.data(using: .utf8) ?? Data()) as? [String: Any]) ?? [:]
        let update = (try? JSONSerialization.jsonObject(with: input.newData.data(using: .utf8) ?? Data()) as? [String: Any]) ?? [:]
        for (k, v) in update { existing[k] = v }
        let merged = String(data: try JSONSerialization.data(withJSONObject: existing), encoding: .utf8) ?? "{}"
        var updated = record; updated["data"] = merged
        try await storage.put(relation: "rego", key: input.bundle, value: updated)
        return .updated(bundle: input.bundle)
    }
}
