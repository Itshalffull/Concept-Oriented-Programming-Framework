// Transform Plugin Provider: expression
// Evaluate sandboxed math/string expressions with variable references.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class ExpressionTransformProvider {
    public static let providerId = "expression"
    public static let pluginType = "transform_plugin"

    private enum Token {
        case number(Double)
        case str(String)
        case bool(Bool)
        case ident(String)
        case op(String)
        case lparen
        case rparen
        case null
    }

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        guard let expr = config.options["expression"] as? String,
              !expr.trimmingCharacters(in: .whitespaces).isEmpty else {
            return value
        }

        var context: [String: Any] = ["value": value]
        if let vars = config.options["variables"] as? [String: Any] {
            for (k, v) in vars {
                context[k] = v
            }
        }

        let tokens = tokenize(expr.trimmingCharacters(in: .whitespaces))
        let (result, _) = parseExpression(tokens: tokens, pos: 0, ctx: context)
        return result
    }

    private func tokenize(_ expr: String) -> [Token] {
        var tokens: [Token] = []
        let chars = Array(expr)
        var i = 0

        while i < chars.count {
            if chars[i].isWhitespace { i += 1; continue }

            // String literals
            if chars[i] == "\"" || chars[i] == "'" {
                let quote = chars[i]
                var s = ""
                i += 1
                while i < chars.count && chars[i] != quote {
                    if chars[i] == "\\" && i + 1 < chars.count {
                        i += 1; s.append(chars[i])
                    } else {
                        s.append(chars[i])
                    }
                    i += 1
                }
                if i < chars.count { i += 1 }
                tokens.append(.str(s))
                continue
            }

            // Numbers
            if chars[i].isNumber || (chars[i] == "." && i + 1 < chars.count && chars[i + 1].isNumber) {
                var num = ""
                while i < chars.count && (chars[i].isNumber || chars[i] == ".") {
                    num.append(chars[i]); i += 1
                }
                tokens.append(.number(Double(num) ?? 0))
                continue
            }

            // Two-character operators
            if i + 1 < chars.count {
                let two = String(chars[i...i + 1])
                if ["==", "!=", ">=", "<=", "&&", "||"].contains(two) {
                    tokens.append(.op(two)); i += 2; continue
                }
            }

            // Single-character operators
            if "+-*/%><!?:".contains(chars[i]) {
                tokens.append(.op(String(chars[i]))); i += 1; continue
            }

            if chars[i] == "(" { tokens.append(.lparen); i += 1; continue }
            if chars[i] == ")" { tokens.append(.rparen); i += 1; continue }

            // Identifiers
            if chars[i].isLetter || chars[i] == "_" || chars[i] == "$" {
                var ident = ""
                while i < chars.count && (chars[i].isLetter || chars[i].isNumber || chars[i] == "_" || chars[i] == "$") {
                    ident.append(chars[i]); i += 1
                }
                switch ident {
                case "true": tokens.append(.bool(true))
                case "false": tokens.append(.bool(false))
                case "null": tokens.append(.null)
                default: tokens.append(.ident(ident))
                }
                continue
            }

            i += 1
        }
        return tokens
    }

    private func parseExpression(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        return parseTernary(tokens: tokens, pos: pos, ctx: ctx)
    }

    private func parseTernary(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        let (cond, p1) = parseOr(tokens: tokens, pos: pos, ctx: ctx)
        if p1 < tokens.count, case .op("?") = tokens[p1] {
            let (trueVal, p2) = parseExpression(tokens: tokens, pos: p1 + 1, ctx: ctx)
            if p2 < tokens.count, case .op(":") = tokens[p2] {
                let (falseVal, p3) = parseExpression(tokens: tokens, pos: p2 + 1, ctx: ctx)
                return (isTruthy(cond) ? trueVal : falseVal, p3)
            }
        }
        return (cond, p1)
    }

    private func parseOr(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        var (left, p) = parseAnd(tokens: tokens, pos: pos, ctx: ctx)
        while p < tokens.count, case .op("||") = tokens[p] {
            let (right, p2) = parseAnd(tokens: tokens, pos: p + 1, ctx: ctx)
            left = isTruthy(left) || isTruthy(right); p = p2
        }
        return (left, p)
    }

    private func parseAnd(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        var (left, p) = parseComparison(tokens: tokens, pos: pos, ctx: ctx)
        while p < tokens.count, case .op("&&") = tokens[p] {
            let (right, p2) = parseComparison(tokens: tokens, pos: p + 1, ctx: ctx)
            left = isTruthy(left) && isTruthy(right); p = p2
        }
        return (left, p)
    }

    private func parseComparison(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        var (left, p) = parseAddSub(tokens: tokens, pos: pos, ctx: ctx)
        let cmpOps = ["==", "!=", ">", "<", ">=", "<="]
        while p < tokens.count, case .op(let op) = tokens[p], cmpOps.contains(op) {
            let (right, p2) = parseAddSub(tokens: tokens, pos: p + 1, ctx: ctx)
            left = compareValues(left, op, right); p = p2
        }
        return (left, p)
    }

    private func parseAddSub(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        var (left, p) = parseMulDiv(tokens: tokens, pos: pos, ctx: ctx)
        while p < tokens.count, case .op(let op) = tokens[p], op == "+" || op == "-" {
            let (right, p2) = parseMulDiv(tokens: tokens, pos: p + 1, ctx: ctx)
            if op == "+" {
                if left is String || right is String {
                    left = "\(toStr(left))\(toStr(right))"
                } else {
                    left = toDouble(left) + toDouble(right)
                }
            } else {
                left = toDouble(left) - toDouble(right)
            }
            p = p2
        }
        return (left, p)
    }

    private func parseMulDiv(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        var (left, p) = parseUnary(tokens: tokens, pos: pos, ctx: ctx)
        while p < tokens.count, case .op(let op) = tokens[p], ["*", "/", "%"].contains(op) {
            let (right, p2) = parseUnary(tokens: tokens, pos: p + 1, ctx: ctx)
            let a = toDouble(left), b = toDouble(right)
            switch op {
            case "*": left = a * b
            case "/": left = b == 0 ? NSNull() as Any : a / b
            case "%": left = b == 0 ? NSNull() as Any : a.truncatingRemainder(dividingBy: b)
            default: break
            }
            p = p2
        }
        return (left, p)
    }

    private func parseUnary(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        if pos < tokens.count, case .op("!") = tokens[pos] {
            let (val, p) = parseUnary(tokens: tokens, pos: pos + 1, ctx: ctx)
            return (!isTruthy(val), p)
        }
        if pos < tokens.count, case .op("-") = tokens[pos] {
            let (val, p) = parsePrimary(tokens: tokens, pos: pos + 1, ctx: ctx)
            return (-toDouble(val), p)
        }
        return parsePrimary(tokens: tokens, pos: pos, ctx: ctx)
    }

    private func parsePrimary(tokens: [Token], pos: Int, ctx: [String: Any]) -> (Any, Int) {
        if pos >= tokens.count { return (NSNull(), pos) }

        switch tokens[pos] {
        case .lparen:
            let (val, p) = parseExpression(tokens: tokens, pos: pos + 1, ctx: ctx)
            let newP = (p < tokens.count && {
                if case .rparen = tokens[p] { return true }; return false
            }()) ? p + 1 : p
            return (val, newP)
        case .number(let n): return (n, pos + 1)
        case .str(let s): return (s, pos + 1)
        case .bool(let b): return (b, pos + 1)
        case .null: return (NSNull(), pos + 1)
        case .ident(let name):
            return (ctx[name] ?? NSNull(), pos + 1)
        default:
            return (NSNull(), pos + 1)
        }
    }

    private func isTruthy(_ value: Any) -> Bool {
        if value is NSNull { return false }
        if let b = value as? Bool { return b }
        if let n = value as? Double { return n != 0 }
        if let n = value as? Int { return n != 0 }
        if let s = value as? String { return !s.isEmpty }
        return true
    }

    private func toDouble(_ value: Any) -> Double {
        if let n = value as? Double { return n }
        if let n = value as? Int { return Double(n) }
        if let s = value as? String { return Double(s) ?? 0 }
        if let b = value as? Bool { return b ? 1 : 0 }
        return 0
    }

    private func toStr(_ value: Any) -> String {
        if value is NSNull { return "" }
        if let s = value as? String { return s }
        if let n = value as? Double { return n.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(n)) : String(n) }
        return String(describing: value)
    }

    private func compareValues(_ a: Any, _ op: String, _ b: Any) -> Bool {
        switch op {
        case "==":
            if a is NSNull && b is NSNull { return true }
            if let sa = a as? String, let sb = b as? String { return sa == sb }
            return toDouble(a) == toDouble(b)
        case "!=":
            return !compareValues(a, "==", b)
        case ">": return toDouble(a) > toDouble(b)
        case "<": return toDouble(a) < toDouble(b)
        case ">=": return toDouble(a) >= toDouble(b)
        case "<=": return toDouble(a) <= toDouble(b)
        default: return false
        }
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }
}
