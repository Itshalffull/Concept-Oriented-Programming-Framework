// LLM-based structure detector — uses language model API for arbitrary structure detection
// Builds prompts from content + hint, parses structured JSON response from LLM

import Foundation

public final class LlmDetectorProvider {

    public init() {}

    private func buildPrompt(content: String, hint: String?) -> String {
        var prompt = """
        You are a structure detection assistant. Analyze the following content and extract structured data.
        Return a JSON object with a "detections" array. Each detection must have:
        - "field": string (the name of the detected structure)
        - "value": any (the extracted value)
        - "type": string (the data type)
        - "confidence": number between 0 and 1
        - "evidence": string (the text that supports this detection)

        Return ONLY valid JSON, no markdown or explanation.
        """

        if let h = hint {
            prompt += "\n\nDetection hint: \(h)\nFocus your analysis on finding structures related to this hint."
        }

        let truncated = content.count > 4000
            ? String(content.prefix(4000)) + "\n... [truncated]"
            : content

        prompt += "\n\nContent to analyze:\n---\n\(truncated)\n---"
        return prompt
    }

    private func parseJsonResponse(_ response: String) -> [[String: Any]]? {
        // Try direct parse
        if let data = response.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let detections = json["detections"] as? [[String: Any]] {
            return detections
        }

        // Try extracting from markdown code block
        if let regex = try? NSRegularExpression(pattern: #"```(?:json)?\s*\n?([\s\S]*?)\n?```"#),
           let match = regex.firstMatch(in: response, range: NSRange(response.startIndex..., in: response)),
           let range = Range(match.range(at: 1), in: response) {
            let inner = String(response[range])
            if let data = inner.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detections = json["detections"] as? [[String: Any]] {
                return detections
            }
        }

        // Try finding JSON object in response
        if let regex = try? NSRegularExpression(pattern: #"\{[\s\S]*"detections"\s*:\s*\[[\s\S]*\][\s\S]*\}"#),
           let match = regex.firstMatch(in: response, range: NSRange(response.startIndex..., in: response)),
           let range = Range(match.range, in: response) {
            let jsonStr = String(response[range])
            if let data = jsonStr.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detections = json["detections"] as? [[String: Any]] {
                return detections
            }
        }

        return nil
    }

    private func buildApiRequestBody(prompt: String, model: String, maxTokens: Int, temperature: Double) -> [String: Any] {
        return [
            "model": model,
            "messages": [["role": "user", "content": prompt]],
            "max_tokens": maxTokens,
            "temperature": temperature,
            "response_format": ["type": "json_object"]
        ]
    }

    /// Synchronous detect — returns empty since LLM calls require async.
    /// Use detectAsync for actual LLM-based detection.
    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        return []
    }

    /// Async detection using LLM API. This is the primary method for this provider.
    public func detectAsync(
        content: Any,
        existingStructure: [String: Any],
        config: DetectorConfig,
        completion: @escaping (Result<[Detection], Error>) -> Void
    ) {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        let options = config.options ?? [:]

        let apiKey = options["apiKey"] as? String ?? options["api_key"] as? String
        let endpointStr = options["apiEndpoint"] as? String
            ?? options["api_endpoint"] as? String
            ?? "https://api.openai.com/v1/chat/completions"
        let model = options["model"] as? String ?? "gpt-4o-mini"
        let maxTokens = options["maxTokens"] as? Int ?? options["max_tokens"] as? Int ?? 2000
        let hint = options["hint"] as? String

        guard apiKey != nil || options["apiEndpoint"] != nil else {
            completion(.success([Detection(
                field: "error",
                value: "No API key or endpoint configured for LLM detector",
                type: "error",
                confidence: 1.0,
                evidence: "Missing config.options.apiKey or config.options.apiEndpoint"
            )]))
            return
        }

        guard let url = URL(string: endpointStr) else {
            completion(.failure(DetectorError.parseError("Invalid API endpoint URL")))
            return
        }

        let prompt = buildPrompt(content: text, hint: hint)
        let body = buildApiRequestBody(prompt: prompt, model: model, maxTokens: maxTokens, temperature: 0.1)

        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            completion(.failure(DetectorError.parseError("Failed to serialize request body")))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let key = apiKey {
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = bodyData

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data, let responseStr = String(data: data, encoding: .utf8) else {
                completion(.failure(DetectorError.parseError("Empty response from LLM API")))
                return
            }

            // Extract content from OpenAI-style response
            var contentStr = responseStr
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let choices = json["choices"] as? [[String: Any]],
               let message = choices.first?["message"] as? [String: Any],
               let content = message["content"] as? String {
                contentStr = content
            }

            guard let rawDetections = self.parseJsonResponse(contentStr) else {
                completion(.success([Detection(
                    field: "error",
                    value: "Failed to parse LLM response as structured JSON",
                    type: "parse_error",
                    confidence: 1.0,
                    evidence: String(contentStr.prefix(200))
                )]))
                return
            }

            let detections: [Detection] = rawDetections.compactMap { d in
                let field = d["field"] as? String ?? "unknown"
                let value = d["value"] ?? NSNull()
                let dtype = d["type"] as? String ?? "unknown"
                let confidence = min((d["confidence"] as? Double) ?? 0.5, 0.95)
                let evidence = d["evidence"] as? String ?? "Detected by LLM"

                guard confidence >= threshold else { return nil }
                return Detection(field: field, value: value, type: dtype,
                                 confidence: confidence, evidence: evidence)
            }

            completion(.success(detections))
        }
        task.resume()
    }

    public func appliesTo(contentType: String) -> Bool {
        true // LLM detector can handle any content type
    }
}
