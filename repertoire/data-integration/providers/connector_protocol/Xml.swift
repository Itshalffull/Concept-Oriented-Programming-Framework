// Xml.swift — connector_protocol provider
// XML connector with XPath-based record extraction, namespace handling, and streaming for large documents

import Foundation

public let xmlProviderId = "xml"
public let xmlPluginType = "connector_protocol"

public struct XmlConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct XmlQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct XmlWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct XmlTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct XmlStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct XmlDiscoveryResult: Codable { public var streams: [XmlStreamDef] }

public enum XmlConnectorError: Error { case parseError(String); case fileNotFound(String) }

private class XmlNode {
    var tag: String; var namespace: String?
    var attributes: [String: String]; var children: [XmlNode]; var text: String
    init(tag: String, namespace: String? = nil, attributes: [String: String] = [:], children: [XmlNode] = [], text: String = "") {
        self.tag = tag; self.namespace = namespace; self.attributes = attributes; self.children = children; self.text = text
    }
}

private class SimpleXmlParser: NSObject, XMLParserDelegate {
    var root = XmlNode(tag: "__root__")
    private var stack: [XmlNode] = []
    private var currentText = ""

    func parse(data: Data) -> XmlNode {
        stack = [root]
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
        return root
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        let parts = elementName.split(separator: ":", maxSplits: 1)
        let ns = parts.count > 1 ? String(parts[0]) : nil
        let local = parts.count > 1 ? String(parts[1]) : elementName
        let node = XmlNode(tag: local, namespace: ns, attributes: attributeDict)
        stack.last?.children.append(node)
        stack.append(node)
        currentText = ""
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        currentText += string
    }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        if let str = String(data: CDATABlock, encoding: .utf8) { currentText += str }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        let trimmed = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { stack.last?.text = trimmed }
        currentText = ""
        if stack.count > 1 { stack.removeLast() }
    }
}

private func nodeToRecord(_ node: XmlNode) -> [String: Any] {
    var record = [String: Any]()
    for (k, v) in node.attributes { record["@\(k)"] = v }
    if !node.text.isEmpty { record["#text"] = node.text }
    for child in node.children {
        let key = child.namespace != nil ? "\(child.namespace!):\(child.tag)" : child.tag
        let value: Any = child.children.isEmpty ? (child.text.isEmpty ? NSNull() : child.text as Any) : nodeToRecord(child)
        if let existing = record[key] {
            if var arr = existing as? [Any] { arr.append(value); record[key] = arr }
            else { record[key] = [existing, value] }
        } else { record[key] = value }
    }
    return record
}

private func findDescendants(_ node: XmlNode, tag: String) -> [XmlNode] {
    var result = [XmlNode]()
    for child in node.children {
        if tag == "*" || child.tag == tag { result.append(child) }
        result.append(contentsOf: findDescendants(child, tag: tag))
    }
    return result
}

private func evaluateXPath(_ root: XmlNode, xpath: String) -> [XmlNode] {
    let isDeep = xpath.hasPrefix("//")
    let cleaned = xpath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let segments = cleaned.split(separator: "/").map(String.init)
    guard let last = segments.last else { return root.children }
    if isDeep { return findDescendants(root, tag: last) }
    var current = root.children
    for (i, segment) in segments.enumerated() {
        let matches = current.filter { segment == "*" || $0.tag == segment }
        if i == segments.count - 1 { return matches }
        current = matches.flatMap { $0.children }
    }
    return current
}

public final class XmlConnectorProvider {
    public init() {}

    public func read(query: XmlQuerySpec, config: XmlConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let source = query.path ?? config.baseUrl ?? ""
        let xpath = config.options?["xpath"] ?? query.query ?? "//*"
        let limit = query.limit ?? Int.max
        let offset = Int(query.cursor ?? "0") ?? 0

        let data: Data
        if source.hasPrefix("http") {
            guard let url = URL(string: source) else { throw XmlConnectorError.fileNotFound("Invalid URL") }
            let (d, _) = try await URLSession.shared.data(from: url)
            data = d
        } else {
            guard let d = FileManager.default.contents(atPath: source) else { throw XmlConnectorError.fileNotFound(source) }
            data = d
        }

        let parser = SimpleXmlParser()
        let root = parser.parse(data: data)
        let nodes = evaluateXPath(root, xpath: xpath)

        return AsyncStream { continuation in
            var yielded = 0
            for i in offset..<nodes.count {
                if yielded >= limit { break }
                continuation.yield(nodeToRecord(nodes[i]))
                yielded += 1
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: XmlConnectorConfig) async throws -> XmlWriteResult {
        let outputPath = config.options?["outputPath"] ?? ""
        if outputPath.isEmpty { return XmlWriteResult(created: 0, updated: 0, skipped: records.count, errors: 0) }
        let rootTag = config.options?["rootTag"] ?? "records"
        let itemTag = config.options?["itemTag"] ?? "record"

        func recordToXml(_ record: [String: Any], indent: String) -> String {
            var xml = ""
            for (key, value) in record {
                if key.hasPrefix("@") || key == "#text" { continue }
                if let dict = value as? [String: Any] {
                    xml += "\(indent)<\(key)>\n\(recordToXml(dict, indent: indent + "  "))\(indent)</\(key)>\n"
                } else {
                    xml += "\(indent)<\(key)>\(value)</\(key)>\n"
                }
            }
            return xml
        }

        var output = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<\(rootTag)>\n"
        for record in records {
            output += "  <\(itemTag)>\n\(recordToXml(record, indent: "    "))  </\(itemTag)>\n"
        }
        output += "</\(rootTag)>\n"
        try output.write(toFile: outputPath, atomically: true, encoding: .utf8)
        return XmlWriteResult(created: records.count, updated: 0, skipped: 0, errors: 0)
    }

    public func test(config: XmlConnectorConfig) async throws -> XmlTestResult {
        let source = config.baseUrl ?? ""
        let start = Date()
        let exists = FileManager.default.fileExists(atPath: source)
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        if !exists { return XmlTestResult(connected: false, message: "File not found", latencyMs: ms) }
        guard let data = FileManager.default.contents(atPath: source),
              let str = String(data: data, encoding: .utf8) else {
            return XmlTestResult(connected: false, message: "Cannot read file", latencyMs: ms)
        }
        let isXml = str.trimmingCharacters(in: .whitespaces).hasPrefix("<?xml") || str.trimmingCharacters(in: .whitespaces).hasPrefix("<")
        return XmlTestResult(connected: true, message: isXml ? "Valid XML source" : "May not be XML", latencyMs: ms)
    }

    public func discover(config: XmlConnectorConfig) async throws -> XmlDiscoveryResult {
        let source = config.baseUrl ?? ""
        guard let data = FileManager.default.contents(atPath: source) else { return XmlDiscoveryResult(streams: []) }
        let parser = SimpleXmlParser()
        let root = parser.parse(data: data)
        var tagCounts = [String: Int]()
        func countTags(_ node: XmlNode) {
            tagCounts[node.tag, default: 0] += 1
            for child in node.children { countTags(child) }
        }
        for child in root.children { countTags(child) }
        let streams = tagCounts.filter { $0.value >= 2 && $0.key != "__root__" }.map { tag, _ -> XmlStreamDef in
            let samples = findDescendants(root, tag: tag)
            var schema = [String: String]()
            if let first = samples.first {
                for key in nodeToRecord(first).keys { schema[key] = "string" }
            }
            return XmlStreamDef(name: tag, schema: schema, supportedSyncModes: ["full_refresh"])
        }
        return XmlDiscoveryResult(streams: streams)
    }
}
