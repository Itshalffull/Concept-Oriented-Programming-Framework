// CopfRemote.swift — connector_protocol provider
// Connects to another Clef instance API for schema sharing, identity field mapping, and bidirectional sync

import Foundation

public let clefRemoteProviderId = "clef_remote"
public let clefRemotePluginType = "connector_protocol"

public struct CrConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct CrQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct CrWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct CrTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct CrStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct CrDiscoveryResult: Codable { public var streams: [CrStreamDef] }
public enum CopfRemoteError: Error { case connectionFailed(String); case apiFailed(String) }

private struct CopfApiResponse: Codable {
    var success: Bool
    var data: AnyCodable?
    var error: String?
    var meta: CopfMeta?
}

private struct CopfMeta: Codable {
    var cursor: String?
    var hasMore: Bool?
    var total: Int?
}

private struct AnyCodable: Codable {
    let value: Any
    init(_ value: Any) { self.value = value }
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let arr = try? container.decode([[String: String]].self) { value = arr }
        else if let dict = try? container.decode([String: String].self) { value = dict }
        else { value = try container.decode(String.self) }
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let str = value as? String { try container.encode(str) }
    }
}

private struct FieldMapping {
    var local: String; var remote: String; var transform: String?
}

private func buildApiUrl(_ baseUrl: String, path: String) -> String {
    "\(baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/api/v1\(path)"
}

private func buildHeaders(_ config: CrConnectorConfig) -> [String: String] {
    var headers = ["Content-Type": "application/json", "X-Clef-Client": "connector_protocol/clef_remote"]
    if let cfgH = config.headers { headers.merge(cfgH) { _, new in new } }
    if let token = config.auth?["token"] { headers["Authorization"] = "Bearer \(token)" }
    if let apiKey = config.auth?["apiKey"] { headers["X-Clef-API-Key"] = apiKey }
    return headers
}

private func getFieldMappings(_ config: CrConnectorConfig) -> [FieldMapping] {
    // Parse field mappings from options (format: "local:remote:transform,...")
    guard let raw = config.options?["fieldMappings"] else { return [] }
    return raw.split(separator: ",").compactMap { pair -> FieldMapping? in
        let parts = pair.split(separator: ":").map { String($0).trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 2 else { return nil }
        return FieldMapping(local: parts[0], remote: parts[1], transform: parts.count > 2 ? parts[2] : nil)
    }
}

private func mapFields(_ record: [String: Any], mappings: [FieldMapping], toRemote: Bool) -> [String: Any] {
    if mappings.isEmpty { return record }
    var mapped = [String: Any]()
    let mappedSources = Set(mappings.map { toRemote ? $0.local : $0.remote })
    for mapping in mappings {
        let src = toRemote ? mapping.local : mapping.remote
        let tgt = toRemote ? mapping.remote : mapping.local
        if let value = record[src] {
            var transformed: Any = value
            switch mapping.transform {
            case "toString": transformed = "\(value)"
            case "toLowerCase": transformed = "\(value)".lowercased()
            case "toUpperCase": transformed = "\(value)".uppercased()
            default: break
            }
            mapped[tgt] = transformed
        }
    }
    for (key, value) in record where !mappedSources.contains(key) {
        mapped[key] = value
    }
    return mapped
}

public final class CopfRemoteConnectorProvider {
    private let session = URLSession(configuration: .default)
    public init() {}

    public func read(query: CrQuerySpec, config: CrConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildHeaders(config)
        let concept = query.path ?? ""
        let limit = query.limit ?? 100
        let mappings = getFieldMappings(config)

        return AsyncStream { continuation in
            Task {
                var cursor = query.cursor
                var hasMore = true
                var totalYielded = 0

                while hasMore && totalYielded < limit {
                    let pageSize = min(limit - totalYielded, 100)
                    var urlStr = buildApiUrl(baseUrl, path: "/concepts/\(concept)/records?limit=\(pageSize)")
                    if let c = cursor { urlStr += "&cursor=\(c)" }
                    if let params = query.params {
                        for (k, v) in params { urlStr += "&\(k)=\(v)" }
                    }
                    guard let url = URL(string: urlStr) else { break }
                    var request = URLRequest(url: url)
                    for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

                    do {
                        let (data, resp) = try await self.session.data(for: request)
                        guard let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300 else { break }
                        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                              let success = json["success"] as? Bool, success,
                              let records = json["data"] as? [[String: Any]] else { break }

                        for record in records {
                            let mapped = mapFields(record, mappings: mappings, toRemote: false)
                            continuation.yield(mapped)
                            totalYielded += 1
                        }

                        let meta = json["meta"] as? [String: Any]
                        hasMore = (meta?["hasMore"] as? Bool) ?? false
                        cursor = meta?["cursor"] as? String
                    } catch { break }
                }
                continuation.finish()
            }
        }
    }

    public func write(records: [[String: Any]], config: CrConnectorConfig) async throws -> CrWriteResult {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildHeaders(config)
        let concept = config.options?["concept"] ?? ""
        let syncMode = config.options?["syncMode"] ?? "upsert"
        let mappings = getFieldMappings(config)
        let batchSize = Int(config.options?["batchSize"] ?? "50") ?? 50
        var result = CrWriteResult(created: 0, updated: 0, skipped: 0, errors: 0)

        let mapped = records.map { mapFields($0, mappings: mappings, toRemote: true) }

        for i in stride(from: 0, to: mapped.count, by: batchSize) {
            let batch = Array(mapped[i..<min(i + batchSize, mapped.count)])
            let urlStr = buildApiUrl(baseUrl, path: "/concepts/\(concept)/sync")
            guard let url = URL(string: urlStr) else { continue }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
            let body: [String: Any] = ["records": batch, "mode": syncMode]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)

            do {
                let (data, resp) = try await session.data(for: request)
                if let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let respData = json["data"] as? [String: Any] {
                    result.created += (respData["created"] as? Int) ?? 0
                    result.updated += (respData["updated"] as? Int) ?? 0
                    result.skipped += (respData["skipped"] as? Int) ?? 0
                } else {
                    result.errors += batch.count
                }
            } catch { result.errors += batch.count }
        }
        return result
    }

    public func test(config: CrConnectorConfig) async throws -> CrTestResult {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildHeaders(config)
        let start = Date()
        let urlStr = buildApiUrl(baseUrl, path: "/health")
        guard let url = URL(string: urlStr) else {
            return CrTestResult(connected: false, message: "Invalid URL", latencyMs: 0)
        }
        var request = URLRequest(url: url)
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        do {
            let (data, resp) = try await session.data(for: request)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            guard let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300 else {
                return CrTestResult(connected: false, message: "HTTP error", latencyMs: ms)
            }
            let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["data"] as? [String: Any]
            let instance = (json?["instance"] as? String) ?? "unknown"
            let version = (json?["version"] as? String) ?? "?"
            return CrTestResult(connected: true, message: "Connected to Clef instance: \(instance) (v\(version))", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return CrTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: CrConnectorConfig) async throws -> CrDiscoveryResult {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildHeaders(config)
        let urlStr = buildApiUrl(baseUrl, path: "/concepts")
        guard let url = URL(string: urlStr) else { return CrDiscoveryResult(streams: []) }
        var request = URLRequest(url: url)
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        do {
            let (data, resp) = try await session.data(for: request)
            guard let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let concepts = json["data"] as? [[String: Any]] else {
                return CrDiscoveryResult(streams: [])
            }
            return CrDiscoveryResult(streams: concepts.compactMap { c in
                guard let name = c["name"] as? String else { return nil }
                var schema = [String: String]()
                if let fields = c["fields"] as? [[String: Any]] {
                    for field in fields {
                        if let fname = field["name"] as? String, let ftype = field["type"] as? String {
                            schema[fname] = ftype
                        }
                    }
                }
                return CrStreamDef(name: name, schema: schema, supportedSyncModes: ["full_refresh", "incremental", "bidirectional"])
            })
        } catch { return CrDiscoveryResult(streams: []) }
    }
}
