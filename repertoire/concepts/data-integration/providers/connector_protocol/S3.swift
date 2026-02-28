// S3.swift — connector_protocol provider
// AWS S3 / compatible object storage with list/read, prefix filtering, continuation tokens, and last-modified incremental

import Foundation
#if canImport(CommonCrypto)
import CommonCrypto
#endif

public let s3ProviderId = "s3"
public let s3PluginType = "connector_protocol"

public struct S3ConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct S3QuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct S3WriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct S3TestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct S3StreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct S3DiscoveryResult: Codable { public var streams: [S3StreamDef] }
public enum S3ConnectorError: Error { case requestFailed(String); case parseError(String) }

private struct S3Cfg {
    var bucket: String; var region: String; var endpoint: String?
    var accessKeyId: String; var secretAccessKey: String; var pathStyle: Bool
}

private func parseS3Config(_ config: S3ConnectorConfig) -> S3Cfg {
    S3Cfg(
        bucket: config.options?["bucket"] ?? "",
        region: config.options?["region"] ?? "us-east-1",
        endpoint: config.baseUrl ?? config.options?["endpoint"],
        accessKeyId: config.auth?["accessKeyId"] ?? "",
        secretAccessKey: config.auth?["secretAccessKey"] ?? "",
        pathStyle: (config.options?["pathStyle"] ?? "false") == "true"
    )
}

private func buildEndpoint(_ cfg: S3Cfg) -> String {
    if let ep = cfg.endpoint { return ep.trimmingCharacters(in: CharacterSet(charactersIn: "/")) }
    if cfg.pathStyle { return "https://s3.\(cfg.region).amazonaws.com" }
    return "https://\(cfg.bucket).s3.\(cfg.region).amazonaws.com"
}

private struct S3Object {
    var key: String; var size: Int; var lastModified: String; var etag: String; var storageClass: String
}

private func parseListResponse(_ xml: String) -> (objects: [S3Object], nextToken: String?, isTruncated: Bool) {
    var objects = [S3Object]()
    var searchRange = xml.startIndex..<xml.endIndex
    while let cStart = xml.range(of: "<Contents>", range: searchRange) {
        guard let cEnd = xml.range(of: "</Contents>", range: cStart.upperBound..<xml.endIndex) else { break }
        let block = String(xml[cStart.lowerBound..<cEnd.upperBound])
        func extract(_ tag: String) -> String {
            guard let s = block.range(of: "<\(tag)>"), let e = block.range(of: "</\(tag)>", range: s.upperBound..<block.endIndex) else { return "" }
            return String(block[s.upperBound..<e.lowerBound])
        }
        objects.append(S3Object(key: extract("Key"), size: Int(extract("Size")) ?? 0, lastModified: extract("LastModified"),
                                etag: extract("ETag").replacingOccurrences(of: "\"", with: ""),
                                storageClass: { let sc = extract("StorageClass"); return sc.isEmpty ? "STANDARD" : sc }()))
        searchRange = cEnd.upperBound..<xml.endIndex
    }
    var nextToken: String? = nil
    if let s = xml.range(of: "<NextContinuationToken>"), let e = xml.range(of: "</NextContinuationToken>", range: s.upperBound..<xml.endIndex) {
        nextToken = String(xml[s.upperBound..<e.lowerBound])
    }
    let isTruncated = xml.contains("<IsTruncated>true</IsTruncated>")
    return (objects, nextToken, isTruncated)
}

public final class S3ConnectorProvider {
    private let session = URLSession(configuration: .default)
    public init() {}

    public func read(query: S3QuerySpec, config: S3ConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let s3cfg = parseS3Config(config)
        let prefix = query.path ?? config.options?["prefix"] ?? ""
        let limit = query.limit ?? Int.max
        let since = query.cursor
        let endpoint = buildEndpoint(s3cfg)

        return AsyncStream { continuation in
            Task {
                var continuationToken: String? = nil
                var hasMore = true
                var yielded = 0

                while hasMore && yielded < limit {
                    let maxKeys = min(1000, limit - yielded)
                    var urlStr = s3cfg.pathStyle
                        ? "\(endpoint)/\(s3cfg.bucket)?list-type=2&prefix=\(prefix)&max-keys=\(maxKeys)"
                        : "\(endpoint)?list-type=2&prefix=\(prefix)&max-keys=\(maxKeys)"
                    if let token = continuationToken {
                        urlStr += "&continuation-token=\(token)"
                    }
                    guard let url = URL(string: urlStr) else { break }
                    do {
                        let (data, _) = try await self.session.data(from: url)
                        let xml = String(data: data, encoding: .utf8) ?? ""
                        let result = parseListResponse(xml)
                        for obj in result.objects {
                            if yielded >= limit { break }
                            if let s = since, obj.lastModified <= s { continue }
                            continuation.yield([
                                "key": obj.key, "size": obj.size,
                                "lastModified": obj.lastModified, "etag": obj.etag,
                                "storageClass": obj.storageClass
                            ])
                            yielded += 1
                        }
                        hasMore = result.isTruncated
                        continuationToken = result.nextToken
                    } catch { break }
                }
                continuation.finish()
            }
        }
    }

    public func write(records: [[String: Any]], config: S3ConnectorConfig) async throws -> S3WriteResult {
        let s3cfg = parseS3Config(config)
        let endpoint = buildEndpoint(s3cfg)
        var result = S3WriteResult(created: 0, updated: 0, skipped: 0, errors: 0)

        for record in records {
            guard let key = record["key"] as? String, let body = record["body"] as? String else {
                result.skipped += 1; continue
            }
            let urlStr = s3cfg.pathStyle ? "\(endpoint)/\(s3cfg.bucket)/\(key)" : "\(endpoint)/\(key)"
            guard let url = URL(string: urlStr) else { result.errors += 1; continue }
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.httpBody = body.data(using: .utf8)
            do {
                let (_, resp) = try await session.data(for: request)
                if let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300 { result.created += 1 }
                else { result.errors += 1 }
            } catch { result.errors += 1 }
        }
        return result
    }

    public func test(config: S3ConnectorConfig) async throws -> S3TestResult {
        let s3cfg = parseS3Config(config)
        let endpoint = buildEndpoint(s3cfg)
        let start = Date()
        let urlStr = s3cfg.pathStyle
            ? "\(endpoint)/\(s3cfg.bucket)?list-type=2&max-keys=1"
            : "\(endpoint)?list-type=2&max-keys=1"
        guard let url = URL(string: urlStr) else {
            return S3TestResult(connected: false, message: "Invalid URL", latencyMs: 0)
        }
        do {
            let (_, resp) = try await session.data(from: url)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            let ok = (resp as? HTTPURLResponse)?.statusCode ?? 500 < 300
            return S3TestResult(connected: ok, message: ok ? "Connected to bucket: \(s3cfg.bucket)" : "Connection failed", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return S3TestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: S3ConnectorConfig) async throws -> S3DiscoveryResult {
        let s3cfg = parseS3Config(config)
        let endpoint = buildEndpoint(s3cfg)
        let urlStr = s3cfg.pathStyle
            ? "\(endpoint)/\(s3cfg.bucket)?list-type=2&delimiter=/&max-keys=100"
            : "\(endpoint)?list-type=2&delimiter=/&max-keys=100"
        guard let url = URL(string: urlStr) else { return S3DiscoveryResult(streams: []) }
        do {
            let (data, _) = try await session.data(from: url)
            let xml = String(data: data, encoding: .utf8) ?? ""
            var prefixes = [String]()
            var searchRange = xml.startIndex..<xml.endIndex
            while let s = xml.range(of: "<CommonPrefixes><Prefix>", range: searchRange) {
                guard let e = xml.range(of: "</Prefix></CommonPrefixes>", range: s.upperBound..<xml.endIndex) else { break }
                prefixes.append(String(xml[s.upperBound..<e.lowerBound]))
                searchRange = e.upperBound..<xml.endIndex
            }
            return S3DiscoveryResult(streams: prefixes.map {
                S3StreamDef(name: $0.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
                            schema: ["key": "string", "size": "integer", "lastModified": "string", "etag": "string"],
                            supportedSyncModes: ["full_refresh", "incremental"])
            })
        } catch { return S3DiscoveryResult(streams: []) }
    }
}
