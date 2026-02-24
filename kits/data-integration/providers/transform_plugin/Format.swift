// Transform Plugin Provider: format
// String formatting and interpolation with printf-style and template-style patterns.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class FormatTransformProvider {
    public static let providerId = "format"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull {
            return NSNull()
        }

        let template = (config.options["template"] as? String) ?? "%s"
        let style = (config.options["style"] as? String) ?? "auto"
        let args = (config.options["args"] as? [Any]) ?? []
        let namedArgs = (config.options["namedArgs"] as? [String: Any]) ?? [:]

        var allArgs: [Any] = [value] + args

        let isPrintf = style == "printf" || (style == "auto" && hasPrintfTokens(template))
        let isTemplate = style == "template" || (style == "auto" && hasTemplateTokens(template))

        if isPrintf {
            return printfFormat(template: template, args: allArgs)
        } else if isTemplate {
            var combined = namedArgs
            combined["value"] = value
            return templateFormat(template: template, positional: allArgs, named: combined)
        } else {
            return printfFormat(template: template, args: allArgs)
        }
    }

    private func hasPrintfTokens(_ template: String) -> Bool {
        return template.contains("%s") || template.contains("%d") || template.contains("%f")
    }

    private func hasTemplateTokens(_ template: String) -> Bool {
        return template.contains("{") && template.contains("}")
    }

    private func printfFormat(template: String, args: [Any]) -> String {
        var result = ""
        var argIndex = 0
        var chars = Array(template)
        var i = 0

        while i < chars.count {
            if chars[i] == "%" && i + 1 < chars.count {
                let spec = chars[i + 1]
                switch spec {
                case "%":
                    result.append("%")
                    i += 2
                case "s":
                    if argIndex < args.count {
                        result.append(String(describing: args[argIndex]))
                        argIndex += 1
                    } else {
                        result.append("%s")
                    }
                    i += 2
                case "d":
                    if argIndex < args.count {
                        let num = toDouble(args[argIndex])
                        result.append(String(Int(num)))
                        argIndex += 1
                    } else {
                        result.append("%d")
                    }
                    i += 2
                case "f":
                    if argIndex < args.count {
                        let num = toDouble(args[argIndex])
                        result.append(String(format: "%.6f", num))
                        argIndex += 1
                    } else {
                        result.append("%f")
                    }
                    i += 2
                default:
                    result.append(chars[i])
                    i += 1
                }
            } else {
                result.append(chars[i])
                i += 1
            }
        }

        return result
    }

    private func templateFormat(template: String, positional: [Any], named: [String: Any]) -> String {
        var result = ""
        var chars = Array(template)
        var i = 0

        while i < chars.count {
            if chars[i] == "{" {
                if let closeIdx = chars[i...].firstIndex(of: "}") {
                    let key = String(chars[i + 1..<closeIdx])
                    var resolved: Any?

                    if let idx = Int(key), idx >= 0, idx < positional.count {
                        resolved = positional[idx]
                    } else if let val = named[key] {
                        resolved = val
                    }

                    if let val = resolved {
                        if val is NSNull {
                            result.append("")
                        } else {
                            result.append(String(describing: val))
                        }
                    } else {
                        result.append("{\(key)}")
                    }
                    i = closeIdx + 1
                } else {
                    result.append(chars[i])
                    i += 1
                }
            } else {
                result.append(chars[i])
                i += 1
            }
        }

        return result
    }

    private func toDouble(_ value: Any) -> Double {
        if let n = value as? Double { return n }
        if let n = value as? Int { return Double(n) }
        if let s = value as? String { return Double(s) ?? 0.0 }
        return 0.0
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
