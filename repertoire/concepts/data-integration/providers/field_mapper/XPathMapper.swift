// XPath field mapper — XPath expression evaluation for XML-like structures
// Supports: / (root), // (descendant), [@attr] (attribute predicate), text()
// Operates on a dictionary representation of XML: { tag, attributes, children, text }

import Foundation

/// Represents an XML node as a dictionary-based structure
private struct XmlNode {
    let tag: String
    let attributes: [String: String]
    let children: [XmlNode]
    let text: String?

    init?(from dict: [String: Any]) {
        guard let tag = dict["tag"] as? String else { return nil }
        self.tag = tag
        self.attributes = (dict["attributes"] as? [String: String]) ?? [:]
        self.text = dict["text"] as? String

        if let childrenArray = dict["children"] as? [[String: Any]] {
            self.children = childrenArray.compactMap { XmlNode(from: $0) }
        } else {
            self.children = []
        }
    }

    func textContent() -> String {
        if let t = text { return t }
        return children.map { $0.textContent() }.joined()
    }

    func findChildren(tag: String) -> [XmlNode] {
        if tag == "*" { return children }
        return children.filter { $0.tag == tag }
    }

    func findDescendants(tag: String) -> [XmlNode] {
        var results: [XmlNode] = []
        for child in children {
            if child.tag == tag || tag == "*" {
                results.append(child)
            }
            results.append(contentsOf: child.findDescendants(tag: tag))
        }
        return results
    }
}

private struct XPathStep {
    let tag: String
    let predicate: String?
    let isDescendant: Bool
}

private func parseTagPredicate(_ s: String) -> (String, String?) {
    guard let bracketIdx = s.firstIndex(of: "[") else {
        return (s, nil)
    }
    let tag = String(s[s.startIndex..<bracketIdx])
    let pred = String(s[s.index(after: bracketIdx)..<s.index(before: s.endIndex)])
    return (tag, pred)
}

private func parseSteps(_ expr: String) -> [XPathStep] {
    var steps: [XPathStep] = []
    let parts = expr.components(separatedBy: "/")
    var i = 0

    while i < parts.count {
        if parts[i].isEmpty {
            // Check for "//"
            if i + 1 < parts.count && parts[i + 1].isEmpty {
                i += 2
                if i < parts.count && !parts[i].isEmpty {
                    let (tag, pred) = parseTagPredicate(parts[i])
                    steps.append(XPathStep(tag: tag, predicate: pred, isDescendant: true))
                }
                i += 1
                continue
            }
            i += 1
            if i < parts.count && !parts[i].isEmpty {
                let (tag, pred) = parseTagPredicate(parts[i])
                steps.append(XPathStep(tag: tag, predicate: pred, isDescendant: false))
            }
            i += 1
        } else {
            let (tag, pred) = parseTagPredicate(parts[i])
            steps.append(XPathStep(tag: tag, predicate: pred, isDescendant: false))
            i += 1
        }
    }
    return steps
}

private func matchesPredicate(_ node: XmlNode, _ pred: String) -> Bool {
    let trimmed = pred.trimmingCharacters(in: .whitespaces)

    // @attr='value'
    if trimmed.hasPrefix("@") {
        if let eqIdx = trimmed.firstIndex(of: "=") {
            let attr = String(trimmed[trimmed.index(after: trimmed.startIndex)..<eqIdx])
            var val = String(trimmed[trimmed.index(after: eqIdx)...])
            val = val.trimmingCharacters(in: CharacterSet(charactersIn: "'\""))
            return node.attributes[attr] == val
        }
        let attr = String(trimmed.dropFirst())
        return node.attributes[attr] != nil
    }

    return true
}

private func positionalIndex(_ pred: String) -> Int? {
    return Int(pred.trimmingCharacters(in: .whitespaces))
}

private func evaluateSteps(_ nodes: [XmlNode], steps: [XPathStep]) -> [String] {
    guard let step = steps.first else {
        return nodes.map { $0.textContent() }
    }
    let remaining = Array(steps.dropFirst())

    if step.tag == "text()" {
        return nodes.map { $0.textContent() }
    }

    if step.tag.hasPrefix("@") {
        let attr = String(step.tag.dropFirst())
        return nodes.compactMap { $0.attributes[attr] }
    }

    var matched: [XmlNode] = []
    for node in nodes {
        let candidates = step.isDescendant
            ? node.findDescendants(tag: step.tag)
            : node.findChildren(tag: step.tag)

        if let pred = step.predicate {
            if let pos = positionalIndex(pred), pos > 0, pos <= candidates.count {
                matched.append(candidates[pos - 1])
            } else {
                matched.append(contentsOf: candidates.filter { matchesPredicate($0, pred) })
            }
        } else {
            matched.append(contentsOf: candidates)
        }
    }

    return evaluateSteps(matched, steps: remaining)
}

public final class XPathMapperProvider {
    public static let providerID = "xpath"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let xmlData = (record["__xml"] as? [String: Any]) ?? record
        guard let root = XmlNode(from: xmlData) else {
            throw MapperError.invalidPath("record is not a valid XML node structure")
        }

        let steps = parseSteps(sourcePath.trimmingCharacters(in: .whitespaces))
        let results = evaluateSteps([root], steps: steps)

        if results.isEmpty { return NSNull() }
        if results.count == 1 { return results[0] }
        return results
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "xpath" || pathSyntax == "xml"
    }
}
