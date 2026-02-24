// Rss.swift — connector_protocol provider
// RSS/Atom feed parser with entry dedup via guid, enclosure handling, and conditional GET via ETag/Last-Modified

import Foundation

public let rssProviderId = "rss"
public let rssPluginType = "connector_protocol"

public struct RssConnectorConfig: Codable {
    public var baseUrl: String?
    public var connectionString: String?
    public var auth: [String: String]?
    public var headers: [String: String]?
    public var options: [String: String]?
}

public struct RssQuerySpec: Codable {
    public var path: String?
    public var query: String?
    public var params: [String: String]?
    public var cursor: String?
    public var limit: Int?
}

public struct RssWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct RssTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct RssStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct RssDiscoveryResult: Codable { public var streams: [RssStreamDef] }

public enum RssConnectorError: Error { case fetchFailed(String); case parseFailed(String) }

private enum FeedType { case rss, atom, unknown }

private func detectFeedType(_ xml: String) -> FeedType {
    if xml.contains("<feed") && xml.contains("http://www.w3.org/2005/Atom") { return .atom }
    if xml.contains("<rss") || xml.contains("<channel>") { return .rss }
    return .unknown
}

private func extractTagContent(_ xml: String, tag: String) -> String {
    let patterns = ["<\(tag)>", "<\(tag) "]
    for pattern in patterns {
        guard let openRange = xml.range(of: pattern) else { continue }
        guard let closeRange = xml.range(of: "</\(tag)>", range: openRange.upperBound..<xml.endIndex) else { continue }
        let contentStart: String.Index
        if pattern.hasSuffix(" ") {
            guard let gtRange = xml.range(of: ">", range: openRange.upperBound..<closeRange.lowerBound) else { continue }
            contentStart = gtRange.upperBound
        } else {
            contentStart = openRange.upperBound
        }
        var content = String(xml[contentStart..<closeRange.lowerBound])
        content = content.replacingOccurrences(of: "<![CDATA[", with: "")
        content = content.replacingOccurrences(of: "]]>", with: "")
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return ""
}

private func extractAttribute(_ tagStr: String, attr: String) -> String {
    let pattern = "\(attr)=\""
    guard let start = tagStr.range(of: pattern) else { return "" }
    let valueStart = start.upperBound
    guard let end = tagStr.range(of: "\"", range: valueStart..<tagStr.endIndex) else { return "" }
    return String(tagStr[valueStart..<end.lowerBound])
}

private func parseRSSItems(_ xml: String) -> [[String: Any]] {
    var entries = [[String: Any]]()
    var searchRange = xml.startIndex..<xml.endIndex
    while let itemStart = xml.range(of: "<item", range: searchRange) {
        guard let itemEnd = xml.range(of: "</item>", range: itemStart.upperBound..<xml.endIndex) else { break }
        let itemXml = String(xml[itemStart.lowerBound..<itemEnd.upperBound])
        var guid = extractTagContent(itemXml, tag: "guid")
        if guid.isEmpty { guid = extractTagContent(itemXml, tag: "link") }

        // Parse enclosures
        var enclosures = [[String: Any]]()
        var encSearch = itemXml.startIndex..<itemXml.endIndex
        while let encStart = itemXml.range(of: "<enclosure", range: encSearch) {
            guard let encEnd = itemXml.range(of: ">", range: encStart.upperBound..<itemXml.endIndex) else { break }
            let encTag = String(itemXml[encStart.lowerBound..<encEnd.upperBound])
            enclosures.append([
                "url": extractAttribute(encTag, attr: "url"),
                "type": extractAttribute(encTag, attr: "type"),
                "length": Int(extractAttribute(encTag, attr: "length")) ?? 0
            ])
            encSearch = encEnd.upperBound..<itemXml.endIndex
        }

        var entry: [String: Any] = [
            "guid": guid,
            "title": extractTagContent(itemXml, tag: "title"),
            "link": extractTagContent(itemXml, tag: "link"),
            "description": extractTagContent(itemXml, tag: "description"),
            "pubDate": extractTagContent(itemXml, tag: "pubDate"),
            "author": extractTagContent(itemXml, tag: "author"),
            "enclosures": enclosures
        ]
        entries.append(entry)
        searchRange = itemEnd.upperBound..<xml.endIndex
    }
    return entries
}

private func parseAtomEntries(_ xml: String) -> [[String: Any]] {
    var entries = [[String: Any]]()
    var searchRange = xml.startIndex..<xml.endIndex
    while let entryStart = xml.range(of: "<entry", range: searchRange) {
        guard let entryEnd = xml.range(of: "</entry>", range: entryStart.upperBound..<xml.endIndex) else { break }
        let entryXml = String(xml[entryStart.lowerBound..<entryEnd.upperBound])
        var link = ""
        if let linkStart = entryXml.range(of: "<link") {
            if let linkEnd = entryXml.range(of: ">", range: linkStart.upperBound..<entryXml.endIndex) {
                link = extractAttribute(String(entryXml[linkStart.lowerBound..<linkEnd.upperBound]), attr: "href")
            }
        }
        let id = extractTagContent(entryXml, tag: "id")
        entries.append([
            "guid": id.isEmpty ? link : id,
            "title": extractTagContent(entryXml, tag: "title"),
            "link": link,
            "description": extractTagContent(entryXml, tag: "summary"),
            "pubDate": extractTagContent(entryXml, tag: "updated"),
            "author": extractTagContent(entryXml, tag: "name")
        ])
        searchRange = entryEnd.upperBound..<xml.endIndex
    }
    return entries
}

public final class RssConnectorProvider {
    private var etag: String?
    private var lastModified: String?
    private var seenGuids = Set<String>()
    private let session = URLSession(configuration: .default)

    public init() {}

    public func read(query: RssQuerySpec, config: RssConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let feedUrl = config.baseUrl ?? query.path ?? ""
        guard let url = URL(string: feedUrl) else { throw RssConnectorError.fetchFailed("Invalid URL") }
        var request = URLRequest(url: url)
        if let etag = etag { request.setValue(etag, forHTTPHeaderField: "If-None-Match") }
        if let lm = lastModified { request.setValue(lm, forHTTPHeaderField: "If-Modified-Since") }

        let (data, response) = try await session.data(for: request)
        guard let httpResp = response as? HTTPURLResponse else { throw RssConnectorError.fetchFailed("Bad response") }
        if httpResp.statusCode == 304 { return AsyncStream { $0.finish() } }

        etag = httpResp.value(forHTTPHeaderField: "ETag")
        lastModified = httpResp.value(forHTTPHeaderField: "Last-Modified")

        guard let xml = String(data: data, encoding: .utf8) else { throw RssConnectorError.parseFailed("Invalid encoding") }
        let feedType = detectFeedType(xml)
        let allEntries = feedType == .atom ? parseAtomEntries(xml) : parseRSSItems(xml)
        let limit = query.limit ?? allEntries.count

        return AsyncStream { continuation in
            var yielded = 0
            for entry in allEntries {
                if yielded >= limit { break }
                let guid = (entry["guid"] as? String) ?? ""
                if !guid.isEmpty && self.seenGuids.contains(guid) { continue }
                self.seenGuids.insert(guid)
                continuation.yield(entry)
                yielded += 1
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: RssConnectorConfig) async throws -> RssWriteResult {
        return RssWriteResult(created: 0, updated: 0, skipped: records.count, errors: 0)
    }

    public func test(config: RssConnectorConfig) async throws -> RssTestResult {
        let feedUrl = config.baseUrl ?? ""
        guard let url = URL(string: feedUrl) else {
            return RssTestResult(connected: false, message: "Invalid URL", latencyMs: 0)
        }
        let start = Date()
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        do {
            let (_, resp) = try await session.data(for: request)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            let httpResp = resp as? HTTPURLResponse
            let ct = httpResp?.value(forHTTPHeaderField: "Content-Type") ?? ""
            let isFeed = ct.contains("xml") || ct.contains("rss") || ct.contains("atom")
            let ok = (httpResp?.statusCode ?? 500) < 400
            return RssTestResult(connected: ok, message: ok ? "Feed accessible (\(isFeed ? "feed" : "non-feed") content-type)" : "HTTP \(httpResp?.statusCode ?? 0)", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return RssTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: RssConnectorConfig) async throws -> RssDiscoveryResult {
        let feedUrl = config.baseUrl ?? ""
        guard let url = URL(string: feedUrl) else { return RssDiscoveryResult(streams: []) }
        do {
            let (data, _) = try await session.data(from: url)
            let xml = String(data: data, encoding: .utf8) ?? ""
            let title = extractTagContent(xml, tag: "title")
            return RssDiscoveryResult(streams: [
                RssStreamDef(name: title.isEmpty ? feedUrl : title, schema: [
                    "guid": "string", "title": "string", "link": "string",
                    "description": "string", "pubDate": "string", "author": "string"
                ], supportedSyncModes: ["full_refresh", "incremental"])
            ])
        } catch {
            return RssDiscoveryResult(streams: [])
        }
    }
}
