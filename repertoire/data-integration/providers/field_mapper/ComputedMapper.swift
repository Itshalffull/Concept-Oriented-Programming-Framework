// Computed field mapper — sandboxed expression evaluation against record context
// Supports: arithmetic (+, -, *, /, %), string concatenation, comparisons,
// ternary conditions, and field references by name

import Foundation

/// Value type for expression evaluation
private enum ExprValue {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)

    var isTruthy: Bool {
        switch self {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): return n != 0
        case .string(let s): return !s.isEmpty
        }
    }

    var asNumber: Double {
        switch self {
        case .null: return 0
        case .bool(let b): return b ? 1 : 0
        case .number(let n): return n
        case .string(let s): return Double(s) ?? 0
        }
    }

    var asString: String {
        switch self {
        case .null: return ""
        case .bool(let b): return String(b)
        case .number(let n):
            return n == Double(Int(n)) ? String(Int(n)) : String(n)
        case .string(let s): return s
        }
    }
}

private func resolveField(record: [String: Any], name: String) -> ExprValue {
    let parts = name.split(separator: ".").map(String.init)
    var current: Any = record
    for part in parts {
        guard let dict = current as? [String: Any], let next = dict[part] else { return .null }
        current = next
    }
    if let s = current as? String { return .string(s) }
    if let n = current as? Double { return .number(n) }
    if let n = current as? Int { return .number(Double(n)) }
    if let b = current as? Bool { return .bool(b) }
    return .null
}

private func tokenizeExpr(_ expr: String) -> [String] {
    var tokens: [String] = []
    let chars = Array(expr)
    var i = 0

    while i < chars.count {
        if chars[i].isWhitespace { i += 1; continue }

        if chars[i] == "\"" || chars[i] == "'" {
            let quote = chars[i]
            var j = i + 1
            while j < chars.count && chars[j] != quote {
                if chars[j] == "\\" { j += 1 }
                j += 1
            }
            tokens.append(String(chars[i...min(j, chars.count - 1)]))
            i = j + 1
        } else if chars[i].isNumber || (chars[i] == "." && i + 1 < chars.count && chars[i + 1].isNumber) {
            var j = i
            while j < chars.count && (chars[j].isNumber || chars[j] == ".") { j += 1 }
            tokens.append(String(chars[i..<j]))
            i = j
        } else if chars[i].isLetter || chars[i] == "_" {
            var j = i
            while j < chars.count && (chars[j].isLetter || chars[j].isNumber || chars[j] == "_" || chars[j] == ".") { j += 1 }
            tokens.append(String(chars[i..<j]))
            i = j
        } else if i + 1 < chars.count {
            let two = String(chars[i...i + 1])
            if ["==", "!=", "<=", ">=", "&&", "||"].contains(two) {
                tokens.append(two)
                i += 2
            } else {
                tokens.append(String(chars[i]))
                i += 1
            }
        } else {
            tokens.append(String(chars[i]))
            i += 1
        }
    }
    return tokens
}

private class ExprParser {
    private let tokens: [String]
    private var pos = 0
    private let record: [String: Any]

    init(tokens: [String], record: [String: Any]) {
        self.tokens = tokens
        self.record = record
    }

    private func peek() -> String? {
        guard pos < tokens.count else { return nil }
        return tokens[pos]
    }

    @discardableResult
    private func advance() -> String {
        let t = tokens[pos]
        pos += 1
        return t
    }

    func parse() -> ExprValue {
        return parseTernary()
    }

    private func parseTernary() -> ExprValue {
        let cond = parseOr()
        if peek() == "?" {
            advance()
            let thenVal = parseTernary()
            if peek() == ":" { advance() }
            let elseVal = parseTernary()
            return cond.isTruthy ? thenVal : elseVal
        }
        return cond
    }

    private func parseOr() -> ExprValue {
        var left = parseAnd()
        while peek() == "||" {
            advance()
            let right = parseAnd()
            left = .bool(left.isTruthy || right.isTruthy)
        }
        return left
    }

    private func parseAnd() -> ExprValue {
        var left = parseComparison()
        while peek() == "&&" {
            advance()
            let right = parseComparison()
            left = .bool(left.isTruthy && right.isTruthy)
        }
        return left
    }

    private func parseComparison() -> ExprValue {
        let left = parseAddSub()
        if let op = peek(), ["==", "!=", "<", ">", "<=", ">="].contains(op) {
            advance()
            let right = parseAddSub()
            let (l, r) = (left.asNumber, right.asNumber)
            switch op {
            case "==": return .bool(l == r)
            case "!=": return .bool(l != r)
            case "<":  return .bool(l < r)
            case ">":  return .bool(l > r)
            case "<=": return .bool(l <= r)
            case ">=": return .bool(l >= r)
            default: return .null
            }
        }
        return left
    }

    private func parseAddSub() -> ExprValue {
        var left = parseMulDiv()
        while let op = peek(), op == "+" || op == "-" {
            advance()
            let right = parseMulDiv()
            if op == "+" {
                if case .string = left { left = .string(left.asString + right.asString) }
                else if case .string = right { left = .string(left.asString + right.asString) }
                else { left = .number(left.asNumber + right.asNumber) }
            } else {
                left = .number(left.asNumber - right.asNumber)
            }
        }
        return left
    }

    private func parseMulDiv() -> ExprValue {
        var left = parseUnary()
        while let op = peek(), op == "*" || op == "/" || op == "%" {
            advance()
            let right = parseUnary()
            let (l, r) = (left.asNumber, right.asNumber)
            switch op {
            case "*": left = .number(l * r)
            case "/": left = r != 0 ? .number(l / r) : .null
            case "%": left = r != 0 ? .number(l.truncatingRemainder(dividingBy: r)) : .null
            default: break
            }
        }
        return left
    }

    private func parseUnary() -> ExprValue {
        if peek() == "-" {
            advance()
            return .number(-parsePrimary().asNumber)
        }
        if peek() == "!" {
            advance()
            return .bool(!parsePrimary().isTruthy)
        }
        return parsePrimary()
    }

    private func parsePrimary() -> ExprValue {
        guard let token = peek() else { return .null }

        if token == "(" {
            advance()
            let val = parseTernary()
            if peek() == ")" { advance() }
            return val
        }

        if (token.hasPrefix("\"") || token.hasPrefix("'")) && token.count >= 2 {
            advance()
            let inner = String(token.dropFirst().dropLast())
            return .string(inner)
        }

        if token == "true" { advance(); return .bool(true) }
        if token == "false" { advance(); return .bool(false) }
        if token == "null" { advance(); return .null }

        if let num = Double(token) {
            advance()
            return .number(num)
        }

        // Field reference
        advance()
        return resolveField(record: record, name: token)
    }
}

public final class ComputedMapperProvider {
    public static let providerID = "computed"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let expr = sourcePath.trimmingCharacters(in: .whitespaces)
        guard !expr.isEmpty else { return NSNull() }

        let tokens = tokenizeExpr(expr)
        let parser = ExprParser(tokens: tokens, record: record)
        let result = parser.parse()

        switch result {
        case .null: return NSNull()
        case .bool(let b): return b
        case .number(let n): return n == Double(Int(n)) ? Int(n) : n
        case .string(let s): return s
        }
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "expression" || pathSyntax == "computed" || pathSyntax == "expr"
    }
}
