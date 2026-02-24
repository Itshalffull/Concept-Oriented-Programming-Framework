// JsonFile.swift — connector_protocol provider
// JSON/JSONL file and URL reader with JSON arrays, newline-delimited JSON, and JSONPath-based record extraction

import Foundation

public let jsonFileProviderId = "json_file"
public let jsonFilePluginType = "connector_protocol"

public struct JfConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct JfQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct JfWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct JfTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct JfStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct JfDiscoveryResult: Codable { public var streams: [JfStreamDef] }

public enum JsonFileConnectorError: Error { case fileNotFound(String); case parseError(String); case invalidFormat(String) }

private enum JsonFormat { case json, jsonl }

private func detectFormat(_ content: String) -> JsonFormat {
    let trimmed = content.trimmingCharacters(in: .whitespaces)
    if trimmed.hasPrefix("[") || trimmed.hasPrefix("{") {
        if let newlineIdx = trimmed.firstIndex(of: "\n") {
            let firstLine = String(trimmed[trimmed.startIndex..<newlineIdx]).trimmingCharacters(in: .whitespaces)
            if !firstLine.hasSuffix(",") {
                if let data = firstLine.data(using: .utf8),
                   (try? JSONSerialization.jsonObject(with: data)) != nil {
                    return .jsonl
                }
            }
        }
        return .json
    }
    return .jsonl
}

private func evaluateJsonPath(_ obj: Any, path: String) -> [Any] {
    if path.isEmpty || path == "$" || path == "." {
        if let arr = obj as? [Any] { return arr }
        return [obj]
    }
    let clean = path.hasPrefix("$.") ? String(path.dropFirst(2)) : (path.hasPrefix("$") ? String(path.dropFirst()) : path)
    let segments = clean.split(separator: ".").map(String.init)
    var current: [Any] = [obj]

    for segment in segments {
        var next = [Any]()
        for item in current {
            if segment == "*" {
                if let arr = item as? [Any] { next.append(contentsOf: arr) }
                else if let dict = item as? [String: Any] { next.append(contentsOf: dict.values) }
            } else if segment.hasSuffix("[]") {
                let key = String(segment.dropLast(2))
                if let dict = item as? [String: Any], let arr = dict[key] as? [Any] {
                    next.append(contentsOf: arr)
                }
            } else {
                if let dict = item as? [String: Any], let val = dict[segment] {
                    next.append(val)
                }
            }
        }
        current = next
    }
    return current
}

private func inferSchema(_ records: [[String: Any]]) -> [String: String] {
    var schema = [String: String]()
    for record in records.prefix(20) {
        for (key, value) in record {
            if schema[key] != nil { continue }
            switch value {
            case is Int: schema[key] = "integer"
            case is Double: schema[key] = "number"
            case is Bool: schema[key] = "boolean"
            case is [Any]: schema[key] = "array"
            case is [String: Any]: schema[key] = "object"
            case is NSNull: schema[key] = "null"
            default: schema[key] = "string"
            }
        }
    }
    return schema
}

private func loadContent(_ source: String, headers: [String: String]?) async throws -> String {
    if source.hasPrefix("http://") || source.hasPrefix("https://") {
        guard let url = URL(string: source) else { throw JsonFileConnectorError.fileNotFound("Invalid URL") }
        var request = URLRequest(url: url)
        headers?.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        let (data, _) = try await URLSession.shared.data(for: request)
        guard let str = String(data: data, encoding: .utf8) else { throw JsonFileConnectorError.parseError("Invalid encoding") }
        return str
    }
    guard let data = FileManager.default.contents(atPath: source),
          let str = String(data: data, encoding: .utf8) else {
        throw JsonFileConnectorError.fileNotFound("Cannot read: \(source)")
    }
    return str
}

public final class JsonFileConnectorProvider {
    public init() {}

    public func read(query: JfQuerySpec, config: JfConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let source = query.path ?? config.baseUrl ?? ""
        let jsonPath = config.options?["jsonPath"] ?? "$"
        let formatOpt = config.options?["format"] ?? "auto"
        let limit = query.limit ?? Int.max
        let offset = Int(query.cursor ?? "0") ?? 0

        let content = try await loadContent(source, headers: config.headers)
        let format = formatOpt == "auto" ? detectFormat(content) : (formatOpt == "jsonl" ? .jsonl : .json)

        var records = [Any]()
        if format == .jsonl {
            records = content.split(separator: "\n")
                .compactMap { line -> Any? in
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { return nil }
                    return try? JSONSerialization.jsonObject(with: data)
                }
        } else {
            guard let data = content.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: data) else {
                throw JsonFileConnectorError.parseError("Invalid JSON")
            }
            if jsonPath != "$" {
                records = evaluateJsonPath(parsed, path: jsonPath)
            } else if let arr = parsed as? [Any] {
                records = arr
            } else {
                records = [parsed]
            }
        }

        return AsyncStream { continuation in
            var yielded = 0
            for i in offset..<records.count {
                if yielded >= limit { break }
                if let dict = records[i] as? [String: Any] {
                    continuation.yield(dict)
                    yielded += 1
                }
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: JfConnectorConfig) async throws -> JfWriteResult {
        let outputPath = config.options?["outputPath"] ?? ""
        if outputPath.isEmpty { return JfWriteResult(created: 0, updated: 0, skipped: records.count, errors: 0) }
        let format = config.options?["outputFormat"] ?? "json"

        let output: String
        if format == "jsonl" {
            output = records.compactMap { record -> String? in
                guard let data = try? JSONSerialization.data(withJSONObject: record),
                      let str = String(data: data, encoding: .utf8) else { return nil }
                return str
            }.joined(separator: "\n") + "\n"
        } else {
            guard let data = try? JSONSerialization.data(withJSONObject: records, options: .prettyPrinted),
                  let str = String(data: data, encoding: .utf8) else {
                throw JsonFileConnectorError.parseError("Cannot serialize")
            }
            output = str
        }

        try output.write(toFile: outputPath, atomically: true, encoding: .utf8)
        return JfWriteResult(created: records.count, updated: 0, skipped: 0, errors: 0)
    }

    public func test(config: JfConnectorConfig) async throws -> JfTestResult {
        let source = config.baseUrl ?? ""
        let start = Date()
        do {
            let content = try await loadContent(source, headers: config.headers)
            let format = detectFormat(content)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return JfTestResult(connected: true, message: "Accessible (format: \(format == .jsonl ? "jsonl" : "json"))", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return JfTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: JfConnectorConfig) async throws -> JfDiscoveryResult {
        let source = config.baseUrl ?? ""
        do {
            let content = try await loadContent(source, headers: config.headers)
            let format = detectFormat(content)
            var records = [[String: Any]]()
            if format == .jsonl {
                records = content.split(separator: "\n").prefix(20).compactMap { line in
                    guard let data = line.data(using: .utf8),
                          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
                    return obj
                }
            } else if let data = content.data(using: .utf8),
                      let parsed = try? JSONSerialization.jsonObject(with: data) {
                if let arr = parsed as? [[String: Any]] { records = Array(arr.prefix(20)) }
                else if let dict = parsed as? [String: Any] { records = [dict] }
            }
            let name = (source as NSString).lastPathComponent
            return JfDiscoveryResult(streams: [
                JfStreamDef(name: name.isEmpty ? source : name, schema: inferSchema(records), supportedSyncModes: ["full_refresh"])
            ])
        } catch {
            return JfDiscoveryResult(streams: [])
        }
    }
}
