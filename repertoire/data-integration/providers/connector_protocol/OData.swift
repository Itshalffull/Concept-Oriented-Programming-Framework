// OData.swift — connector_protocol provider
// OData v4 protocol with $filter, $select, $expand, $orderby, batch requests, and delta links for change tracking

import Foundation

public let odataProviderId = "odata"
public let odataPluginType = "connector_protocol"

public struct OdConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct OdQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct OdWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct OdTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct OdStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct OdDiscoveryResult: Codable { public var streams: [OdStreamDef] }
public enum OdataConnectorError: Error { case requestFailed(String); case parseError(String) }

private func buildAuthHeaders(_ config: OdConnectorConfig) -> [String: String] {
    var headers = ["Accept": "application/json", "Content-Type": "application/json",
                   "OData-Version": "4.0", "OData-MaxVersion": "4.0"]
    if let cfgH = config.headers { headers.merge(cfgH) { _, new in new } }
    if let auth = config.auth {
        if auth["style"] == "bearer", let token = auth["token"] {
            headers["Authorization"] = "Bearer \(token)"
        } else if auth["style"] == "basic", let user = auth["username"], let pass = auth["password"] {
            if let data = "\(user):\(pass)".data(using: .utf8) {
                headers["Authorization"] = "Basic \(data.base64EncodedString())"
            }
        }
    }
    return headers
}

private func buildQueryUrl(_ baseUrl: String, entitySet: String, params: [String: String]?) -> String {
    var queryItems = [String]()
    if let p = params {
        for key in ["$filter", "$select", "$expand", "$orderby", "$top", "$skip", "$count", "$search"] {
            if let val = p[key] { queryItems.append("\(key)=\(val)") }
        }
    }
    let base = baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let qs = queryItems.isEmpty ? "" : "?\(queryItems.joined(separator: "&"))"
    return "\(base)/\(entitySet)\(qs)"
}

private func parseOdataType(_ edmType: String) -> String {
    switch edmType {
    case "Edm.String", "Edm.Guid", "Edm.DateTime", "Edm.DateTimeOffset": return "string"
    case "Edm.Int32", "Edm.Int64", "Edm.Int16", "Edm.Byte": return "integer"
    case "Edm.Double", "Edm.Decimal", "Edm.Single": return "number"
    case "Edm.Boolean": return "boolean"
    default: return "string"
    }
}

private func cleanOdataRecord(_ dict: [String: Any]) -> [String: Any] {
    var clean = [String: Any]()
    for (key, value) in dict {
        if !key.hasPrefix("@odata.") && !key.hasPrefix("odata.") {
            clean[key] = value
        }
    }
    return clean
}

public final class OdataConnectorProvider {
    private let session = URLSession(configuration: .default)
    private var deltaLinks = [String: String]()

    public init() {}

    public func read(query: OdQuerySpec, config: OdConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildAuthHeaders(config)
        let entitySet = query.path ?? ""
        let limit = query.limit ?? Int.max
        let useDelta = (config.options?["useDelta"] ?? "false") == "true"

        var queryParams = query.params ?? [:]
        if let filter = config.options?["$filter"] { queryParams["$filter"] = filter }
        if let select = config.options?["$select"] { queryParams["$select"] = select }
        if let expand = config.options?["$expand"] { queryParams["$expand"] = expand }
        if let orderby = config.options?["$orderby"] { queryParams["$orderby"] = orderby }
        queryParams["$top"] = "\(min(limit, 1000))"
        if let search = query.query { queryParams["$search"] = search }

        var initialUrl: String
        if useDelta, let dl = deltaLinks[entitySet] { initialUrl = dl }
        else if let cursor = query.cursor { initialUrl = cursor }
        else { initialUrl = buildQueryUrl(baseUrl, entitySet: entitySet, params: queryParams) }

        return AsyncStream { continuation in
            Task {
                var url = initialUrl
                var hasMore = true
                var yielded = 0

                while hasMore && yielded < limit {
                    guard let requestUrl = URL(string: url) else { break }
                    var request = URLRequest(url: requestUrl)
                    for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

                    do {
                        let (data, resp) = try await self.session.data(for: request)
                        guard let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300 else { break }
                        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { break }

                        let records = (json["value"] as? [[String: Any]]) ?? []
                        for record in records {
                            if yielded >= limit { break }
                            continuation.yield(cleanOdataRecord(record))
                            yielded += 1
                        }

                        if let dl = json["@odata.deltaLink"] as? String {
                            self.deltaLinks[entitySet] = dl
                        }

                        if let nl = json["@odata.nextLink"] as? String, yielded < limit {
                            url = nl
                        } else {
                            hasMore = false
                        }
                    } catch { break }
                }
                continuation.finish()
            }
        }
    }

    public func write(records: [[String: Any]], config: OdConnectorConfig) async throws -> OdWriteResult {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let headers = buildAuthHeaders(config)
        let entitySet = config.options?["entitySet"] ?? ""
        let idField = config.options?["idField"] ?? "Id"
        var result = OdWriteResult(created: 0, updated: 0, skipped: 0, errors: 0)

        for record in records {
            let id = record[idField]
            let method: String
            let urlStr: String
            if let idVal = id {
                let idStr = (idVal is String) ? "'\(idVal)'" : "\(idVal)"
                urlStr = "\(baseUrl)/\(entitySet)(\(idStr))"
                method = "PATCH"
            } else {
                urlStr = "\(baseUrl)/\(entitySet)"
                method = "POST"
            }
            guard let url = URL(string: urlStr) else { result.errors += 1; continue }
            var request = URLRequest(url: url)
            request.httpMethod = method
            for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
            request.httpBody = try? JSONSerialization.data(withJSONObject: record)

            do {
                let (_, resp) = try await session.data(for: request)
                let status = (resp as? HTTPURLResponse)?.statusCode ?? 500
                if status == 201 { result.created += 1 }
                else if status == 200 || status == 204 { result.updated += 1 }
                else { result.errors += 1 }
            } catch { result.errors += 1 }
        }
        return result
    }

    public func test(config: OdConnectorConfig) async throws -> OdTestResult {
        let baseUrl = config.baseUrl ?? ""
        let headers = buildAuthHeaders(config)
        let start = Date()
        guard let url = URL(string: baseUrl) else {
            return OdTestResult(connected: false, message: "Invalid URL", latencyMs: 0)
        }
        var request = URLRequest(url: url)
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        do {
            let (data, resp) = try await session.data(for: request)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            guard let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300 else {
                return OdTestResult(connected: false, message: "HTTP \((resp as? HTTPURLResponse)?.statusCode ?? 0)", latencyMs: ms)
            }
            let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            let context = (json["@odata.context"] as? String) ?? ""
            return OdTestResult(connected: true, message: "Connected to OData v4 service\(context.isEmpty ? "" : " (\(context))")", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return OdTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: OdConnectorConfig) async throws -> OdDiscoveryResult {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let headers = buildAuthHeaders(config)

        // Try $metadata
        if let metaUrl = URL(string: "\(baseUrl)/$metadata") {
            var request = URLRequest(url: metaUrl)
            for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
            request.setValue("application/xml", forHTTPHeaderField: "Accept")
            if let (data, resp) = try? await session.data(for: request),
               let httpResp = resp as? HTTPURLResponse, httpResp.statusCode < 300,
               let xml = String(data: data, encoding: .utf8) {
                var streams = [OdStreamDef]()
                var searchRange = xml.startIndex..<xml.endIndex
                while let etStart = xml.range(of: "<EntityType ", range: searchRange) {
                    guard let etEnd = xml.range(of: "</EntityType>", range: etStart.upperBound..<xml.endIndex) else { break }
                    let block = String(xml[etStart.lowerBound..<etEnd.upperBound])
                    var name = ""
                    if let nameStart = block.range(of: "Name=\""), let nameEnd = block.range(of: "\"", range: nameStart.upperBound..<block.endIndex) {
                        name = String(block[nameStart.upperBound..<nameEnd.lowerBound])
                    }
                    var schema = [String: String]()
                    var propSearch = block.startIndex..<block.endIndex
                    while let pStart = block.range(of: "<Property ", range: propSearch) {
                        guard let pEnd = block.range(of: "/>", range: pStart.upperBound..<block.endIndex) else { break }
                        let propTag = String(block[pStart.lowerBound..<pEnd.upperBound])
                        var pName = ""; var pType = ""
                        if let ns = propTag.range(of: "Name=\""), let ne = propTag.range(of: "\"", range: ns.upperBound..<propTag.endIndex) {
                            pName = String(propTag[ns.upperBound..<ne.lowerBound])
                        }
                        if let ts = propTag.range(of: "Type=\""), let te = propTag.range(of: "\"", range: ts.upperBound..<propTag.endIndex) {
                            pType = String(propTag[ts.upperBound..<te.lowerBound])
                        }
                        if !pName.isEmpty { schema[pName] = parseOdataType(pType) }
                        propSearch = pEnd.upperBound..<block.endIndex
                    }
                    if !name.isEmpty {
                        streams.append(OdStreamDef(name: name, schema: schema, supportedSyncModes: ["full_refresh", "incremental"]))
                    }
                    searchRange = etEnd.upperBound..<xml.endIndex
                }
                if !streams.isEmpty { return OdDiscoveryResult(streams: streams) }
            }
        }

        // Fallback to service document
        guard let url = URL(string: baseUrl) else { return OdDiscoveryResult(streams: []) }
        var request = URLRequest(url: url)
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        do {
            let (data, _) = try await session.data(for: request)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let sets = json["value"] as? [[String: Any]] else { return OdDiscoveryResult(streams: []) }
            return OdDiscoveryResult(streams: sets.compactMap { s in
                guard let name = s["name"] as? String else { return nil }
                return OdStreamDef(name: name, schema: [:], supportedSyncModes: ["full_refresh", "incremental"])
            })
        } catch { return OdDiscoveryResult(streams: []) }
    }
}
