// JSONPath field mapper — JSONPath expression evaluation for complex JSON navigation
// Supports: $ (root), . (child), .. (recursive descent), [*] (wildcard),
// [n] (index), [?(@.field<value)] (filter expressions)

import Foundation

public final class JsonPathMapperProvider {
    public static let providerID = "jsonpath"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let tokens = tokenize(sourcePath.trimmingCharacters(in: .whitespaces))
        var nodes: [Any] = [record]

        for token in tokens {
            nodes = applyToken(nodes: nodes, token: token)
            if nodes.isEmpty { return NSNull() }
        }

        let returnFirst = (config.options?["returnFirst"] as? Bool) ?? true
        if returnFirst && nodes.count == 1 {
            return nodes[0]
        }
        return nodes
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "jsonpath" || pathSyntax == "json_path"
    }

    // MARK: - Tokenizer

    private func tokenize(_ expr: String) -> [String] {
        var tokens: [String] = []
        let chars = Array(expr)
        var i = chars.first == "$" ? 1 : 0

        while i < chars.count {
            if chars[i] == "." {
                if i + 1 < chars.count && chars[i + 1] == "." {
                    tokens.append("..")
                    i += 2
                } else {
                    i += 1
                }
            } else if chars[i] == "[" {
                var depth = 1
                var j = i + 1
                while j < chars.count && depth > 0 {
                    if chars[j] == "[" { depth += 1 }
                    if chars[j] == "]" { depth -= 1 }
                    j += 1
                }
                tokens.append(String(chars[i..<j]))
                i = j
            } else {
                var j = i
                while j < chars.count && chars[j] != "." && chars[j] != "[" {
                    j += 1
                }
                tokens.append(String(chars[i..<j]))
                i = j
            }
        }
        return tokens
    }

    // MARK: - Descendants

    private func descendants(of node: Any) -> [Any] {
        var results: [Any] = []
        if let dict = node as? [String: Any] {
            for val in dict.values {
                results.append(val)
                results.append(contentsOf: descendants(of: val))
            }
        } else if let arr = node as? [Any] {
            for item in arr {
                results.append(item)
                results.append(contentsOf: descendants(of: item))
            }
        }
        return results
    }

    // MARK: - Token Application

    private func applyToken(nodes: [Any], token: String) -> [Any] {
        var results: [Any] = []

        if token == ".." {
            for node in nodes {
                results.append(contentsOf: descendants(of: node))
            }
            return results
        }

        if token.hasPrefix("[") && token.hasSuffix("]") {
            let inner = String(token.dropFirst().dropLast()).trimmingCharacters(in: .whitespaces)

            if inner == "*" {
                for node in nodes {
                    if let arr = node as? [Any] { results.append(contentsOf: arr) }
                    else if let dict = node as? [String: Any] { results.append(contentsOf: dict.values) }
                }
            } else if inner.hasPrefix("?(") && inner.hasSuffix(")") {
                let filterExpr = String(inner.dropFirst(2).dropLast()).trimmingCharacters(in: .whitespaces)
                for node in nodes {
                    if let arr = node as? [Any] {
                        results.append(contentsOf: arr.filter { evaluateFilter($0, filterExpr) })
                    }
                }
            } else if let idx = Int(inner) {
                for node in nodes {
                    if let arr = node as? [Any] {
                        let resolved = idx < 0 ? arr.count + idx : idx
                        if resolved >= 0 && resolved < arr.count {
                            results.append(arr[resolved])
                        }
                    }
                }
            } else {
                let key = inner.trimmingCharacters(in: CharacterSet(charactersIn: "'\""))
                for node in nodes {
                    if let dict = node as? [String: Any], let val = dict[key] {
                        results.append(val)
                    }
                }
            }
            return results
        }

        // Property name
        for node in nodes {
            if let dict = node as? [String: Any], let val = dict[token] {
                results.append(val)
            }
        }
        return results
    }

    // MARK: - Filter Evaluation

    private func evaluateFilter(_ node: Any, _ filterExpr: String) -> Bool {
        guard filterExpr.hasPrefix("@.") else { return false }
        let rest = String(filterExpr.dropFirst(2))

        let operators = ["==", "!=", "<=", ">=", "<", ">"]
        for op in operators {
            if let range = rest.range(of: op) {
                let field = rest[rest.startIndex..<range.lowerBound].trimmingCharacters(in: .whitespaces)
                let rawVal = rest[range.upperBound...].trimmingCharacters(in: .whitespaces)

                guard let dict = node as? [String: Any], let fieldVal = dict[field] else { return false }
                return compareValues(fieldVal, op: op, rawVal: rawVal)
            }
        }
        return false
    }

    private func compareValues(_ fieldVal: Any, op: String, rawVal: String) -> Bool {
        let cmpVal: Any
        if (rawVal.hasPrefix("'") && rawVal.hasSuffix("'")) ||
           (rawVal.hasPrefix("\"") && rawVal.hasSuffix("\"")) {
            cmpVal = String(rawVal.dropFirst().dropLast())
        } else if let num = Double(rawVal) {
            cmpVal = num
        } else {
            cmpVal = rawVal
        }

        if let a = fieldVal as? Double, let b = cmpVal as? Double {
            switch op {
            case "==": return a == b
            case "!=": return a != b
            case "<":  return a < b
            case ">":  return a > b
            case "<=": return a <= b
            case ">=": return a >= b
            default: return false
            }
        }
        if let a = fieldVal as? Int, let b = cmpVal as? Double {
            return compareValues(Double(a), op: op, rawVal: rawVal)
        }
        if let a = fieldVal as? String, let b = cmpVal as? String {
            switch op {
            case "==": return a == b
            case "!=": return a != b
            default: return false
            }
        }
        return false
    }
}
