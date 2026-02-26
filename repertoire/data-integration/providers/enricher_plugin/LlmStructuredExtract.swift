// COPF Data Integration Kit - LLM structured data extraction enricher provider
// Builds prompt with target schema + content, calls LLM API, parses JSON response.

import Foundation

public let LlmStructuredExtractProviderID = "llm_structured_extract"
public let LlmStructuredExtractPluginType = "enricher_plugin"

public struct TargetSchemaField {
    public let name: String
    public let fieldType: String
    public let description: String?
    public let required: Bool
    public let enumValues: [String]?
}

public struct TargetSchema {
    public let name: String
    public let fields: [TargetSchemaField]
}

public final class LlmStructuredExtractEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let model = config.model ?? "gpt-4o-mini"
        let apiKey = config.apiKey ?? ""
        let targetSchema = parseTargetSchema(from: config.options?["targetSchema"])
        let instructions = (config.options?["instructions"] as? String) ?? ""
        let autoAcceptThreshold = (config.options?["autoAcceptThreshold"] as? Double) ?? 0.8
        let maxTokens = (config.options?["maxTokens"] as? Int) ?? 2000

        // Build extraction prompt
        let prompt = buildExtractionPrompt(content: item.content, schema: targetSchema, instructions: instructions)

        // Call LLM API
        let responseJson = try await callLlmApi(model: model, apiKey: apiKey, prompt: prompt, maxTokens: maxTokens)

        // Parse extracted data
        let (data, confidence) = parseExtractedData(json: responseJson, model: model, schema: targetSchema)

        // Validate against schema
        let (valid, errors, completeness) = validateAgainstSchema(data: data, schema: targetSchema)

        // Build per-field results
        let fieldResults: [[String: Any]] = targetSchema.fields.map { field in
            let value = data[field.name]
            let conf = confidence[field.name] ?? 0.0
            let source = (value != nil && !(value is NSNull)) ? "extracted" : "missing"
            return ["field": field.name, "value": value as Any, "confidence": conf, "source": source]
        }

        let avgFieldConf: Double = fieldResults.isEmpty ? 0.0 :
            fieldResults.compactMap { ($0["confidence"] as? Double) }.reduce(0.0, +) / Double(fieldResults.count)

        let validityFactor = valid ? 1.0 : 0.7
        let overallConfidence = avgFieldConf * validityFactor * completeness
        let autoAccepted = overallConfidence >= autoAcceptThreshold

        return EnrichmentResult(
            fields: [
                "extracted": data,
                "field_confidence": confidence,
                "field_results": fieldResults,
                "validation": [
                    "valid": valid,
                    "errors": errors,
                    "completeness": (completeness * 100).rounded() / 100
                ] as [String: Any],
                "auto_accepted": autoAccepted
            ],
            confidence: (overallConfidence * 1000).rounded() / 1000,
            metadata: [
                "provider": LlmStructuredExtractProviderID,
                "model": model,
                "schemaName": targetSchema.name,
                "fieldCount": targetSchema.fields.count,
                "autoAcceptThreshold": autoAcceptThreshold
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        return true // LLM extraction applies to any content type
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let wordCount = item.content.split(separator: " ").count
        let inputTokens = Int(Double(wordCount) * 1.3) + 500
        let outputTokens = 1000
        return CostEstimate(
            tokens: inputTokens + outputTokens,
            apiCalls: 1,
            durationMs: 2000 + inputTokens / 100
        )
    }

    // MARK: - Prompt Construction

    private func buildExtractionPrompt(content: String, schema: TargetSchema, instructions: String) -> String {
        let schemaDesc = schema.fields.map { field in
            var desc = "  \"\(field.name)\": \(field.fieldType)"
            if let d = field.description { desc += " // \(d)" }
            if field.required { desc += " (REQUIRED)" }
            if let e = field.enumValues { desc += " (one of: \(e.joined(separator: ", ")))" }
            return desc
        }.joined(separator: "\n")

        let jsonTemplate = schema.fields.map { field in
            let defaultVal: String
            switch field.fieldType {
            case "string": defaultVal = "\"\""
            case "number", "integer": defaultVal = "0"
            case "boolean": defaultVal = "false"
            case "array": defaultVal = "[]"
            default: defaultVal = "null"
            }
            return "  \"\(field.name)\": \(defaultVal)"
        }.joined(separator: ",\n")

        let truncatedContent = String(content.prefix(12000))
        let instr = instructions.isEmpty ?
            "Extract all relevant fields from the content. Use null for fields that cannot be determined." : instructions

        return """
        Extract structured data from the following content according to the target schema.

        ## Target Schema: \(schema.name)
        Fields:
        \(schemaDesc)

        ## Expected JSON Output Format:
        {
        \(jsonTemplate)
        }

        ## Additional Instructions:
        \(instr)

        ## Important:
        - Return ONLY valid JSON matching the schema above.
        - For each field, also provide a confidence score (0.0-1.0) in a separate "_confidence" object.
        - Your response MUST be valid JSON with two top-level keys: "data" and "_confidence".

        ## Content to Extract From:
        \(truncatedContent)
        """
    }

    // MARK: - API Call

    private func callLlmApi(model: String, apiKey: String, prompt: String, maxTokens: Int) async throws -> [String: Any] {
        let (hostname, path) = model.hasPrefix("claude") ?
            ("api.anthropic.com", "/v1/messages") :
            ("api.openai.com", "/v1/chat/completions")

        guard let url = URL(string: "https://\(hostname)\(path)") else {
            throw EnricherError.parseError("Invalid API URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any]
        if model.hasPrefix("claude") {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
            body = [
                "model": model,
                "max_tokens": maxTokens,
                "messages": [["role": "user", "content": prompt]]
            ]
        } else {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
            body = [
                "model": model,
                "max_tokens": maxTokens,
                "messages": [
                    ["role": "system", "content": "You are a precise data extraction assistant. Always respond with valid JSON."],
                    ["role": "user", "content": prompt]
                ],
                "response_format": ["type": "json_object"]
            ]
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    // MARK: - Response Parsing

    private func parseExtractedData(
        json: [String: Any], model: String, schema: TargetSchema
    ) -> (data: [String: Any], confidence: [String: Double]) {
        var textContent = ""
        if model.hasPrefix("claude") {
            let content = json["content"] as? [[String: Any]] ?? []
            textContent = (content.first?["text"] as? String) ?? ""
        } else {
            let choices = json["choices"] as? [[String: Any]] ?? []
            let message = choices.first?["message"] as? [String: Any] ?? [:]
            textContent = (message["content"] as? String) ?? ""
        }

        // Strip markdown code blocks
        var jsonStr = textContent
        if let startRange = textContent.range(of: "```") {
            let after = textContent[startRange.upperBound...]
            if let nlIndex = after.firstIndex(of: "\n"),
               let endRange = after[after.index(after: nlIndex)...].range(of: "```") {
                jsonStr = String(after[after.index(after: nlIndex)..<endRange.lowerBound])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        guard let jsonData = jsonStr.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return ([:], [:])
        }

        // Handle data + _confidence format
        if let dataObj = parsed["data"] as? [String: Any] {
            var confidence: [String: Double] = [:]
            if let confObj = parsed["_confidence"] as? [String: Any] {
                for (key, val) in confObj {
                    confidence[key] = (val as? Double) ?? 0.5
                }
            }
            return (dataObj, confidence)
        }

        // Fallback: flat structure
        var confidence: [String: Double] = [:]
        for field in schema.fields {
            confidence[field.name] = parsed[field.name] != nil ? 0.7 : 0.0
        }
        return (parsed, confidence)
    }

    private func validateAgainstSchema(
        data: [String: Any], schema: TargetSchema
    ) -> (valid: Bool, errors: [String], completeness: Double) {
        var errors: [String] = []
        var filled = 0

        for field in schema.fields {
            let value = data[field.name]
            if field.required && (value == nil || value is NSNull) {
                errors.append("Required field \"\(field.name)\" is missing")
                continue
            }
            guard value != nil && !(value is NSNull) else { continue }
            filled += 1

            switch field.fieldType {
            case "string" where !(value is String):
                errors.append("Field \"\(field.name)\" should be string")
            case "number", "integer" where !(value is NSNumber):
                errors.append("Field \"\(field.name)\" should be \(field.fieldType)")
            case "array" where !(value is [Any]):
                errors.append("Field \"\(field.name)\" should be array")
            default: break
            }

            if let enumVals = field.enumValues, let strVal = value as? String,
               !enumVals.contains(strVal) {
                errors.append("Field \"\(field.name)\" value not in allowed values")
            }
        }

        let completeness = schema.fields.isEmpty ? 0.0 : Double(filled) / Double(schema.fields.count)
        return (errors.isEmpty, errors, completeness)
    }

    private func parseTargetSchema(from value: Any?) -> TargetSchema {
        guard let dict = value as? [String: Any] else {
            return TargetSchema(name: "generic", fields: [
                TargetSchemaField(name: "summary", fieldType: "string", description: nil, required: false, enumValues: nil),
                TargetSchemaField(name: "entities", fieldType: "array", description: nil, required: false, enumValues: nil)
            ])
        }

        let name = (dict["name"] as? String) ?? "generic"
        let rawFields = (dict["fields"] as? [[String: Any]]) ?? []
        let fields = rawFields.map { f in
            TargetSchemaField(
                name: (f["name"] as? String) ?? "",
                fieldType: (f["type"] as? String) ?? "string",
                description: f["description"] as? String,
                required: (f["required"] as? Bool) ?? false,
                enumValues: f["enum"] as? [String]
            )
        }
        return TargetSchema(name: name, fields: fields)
    }
}
