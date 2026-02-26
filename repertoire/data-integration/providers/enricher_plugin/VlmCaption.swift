// COPF Data Integration Kit - Vision-Language Model captioning enricher provider
// Sends image to VLM API endpoint, receives caption + detailed description + detected objects.

import Foundation

public let VlmCaptionProviderID = "vlm_caption"
public let VlmCaptionPluginType = "enricher_plugin"

public struct DetectedObject {
    public let label: String
    public let confidence: Double
    public let bbox: BoundingBox
}

public struct BoundingBox {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double
}

private let defaultCaptionPrompt = """
Analyze this image and provide:
1. A concise caption (1 sentence)
2. A detailed description (2-4 sentences)
3. A list of detected objects with confidence scores

Respond in JSON format:
{
  "caption": "...",
  "description": "...",
  "detected_objects": [{"label": "...", "confidence": 0.0-1.0, "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}]
}
"""

public final class VlmCaptionEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let model = config.model ?? "gpt-4o"
        let apiKey = config.apiKey ?? ""
        let maxTokens = (config.options?["maxTokens"] as? Int) ?? 1024
        let promptTemplate = (config.options?["promptTemplate"] as? String) ?? defaultCaptionPrompt

        let (url, request) = try buildRequest(
            model: model, apiKey: apiKey, imageB64: item.content,
            maxTokens: maxTokens, prompt: promptTemplate
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw EnricherError.processError("VLM API returned status \(code)")
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let (caption, description, detectedObjects) = parseVlmResponse(json: json, model: model)

        let objConfidence: Double = detectedObjects.isEmpty ? 0.7 :
            detectedObjects.reduce(0.0) { $0 + $1.confidence } / Double(detectedObjects.count)
        let overallConfidence = !caption.isEmpty ? min(1.0, (objConfidence + 0.8) / 2.0) : 0.3

        let objDicts: [[String: Any]] = detectedObjects.map { obj in
            [
                "label": obj.label,
                "confidence": obj.confidence,
                "bbox": ["x": obj.bbox.x, "y": obj.bbox.y,
                         "width": obj.bbox.width, "height": obj.bbox.height]
            ]
        }

        return EnrichmentResult(
            fields: [
                "caption": caption,
                "description": description,
                "detected_objects": objDicts,
                "object_count": detectedObjects.count
            ],
            confidence: overallConfidence,
            metadata: [
                "provider": VlmCaptionProviderID,
                "model": model
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let imageSchemas = ["image", "photo", "screenshot", "figure", "diagram", "visual"]
        let nameLower = schema.name.lowercased()
        return imageSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let imageSizeKb = Double(item.content.count) * 3.0 / 4.0 / 1024.0
        let estimatedTiles = max(1, Int(ceil(imageSizeKb / 100.0)))
        let imageTokens = estimatedTiles * 85
        let outputTokens = 500
        return CostEstimate(
            tokens: imageTokens + outputTokens,
            apiCalls: 1,
            durationMs: 3000 + estimatedTiles * 200
        )
    }

    // MARK: - Request Building

    private func buildRequest(
        model: String, apiKey: String, imageB64: String, maxTokens: Int, prompt: String
    ) throws -> (URL, URLRequest) {
        let (hostname, path) = determineEndpoint(model: model)
        guard let url = URL(string: "https://\(hostname)\(path)") else {
            throw EnricherError.parseError("Invalid VLM API URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if model.hasPrefix("claude") {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
            let body: [String: Any] = [
                "model": model,
                "max_tokens": maxTokens,
                "messages": [[
                    "role": "user",
                    "content": [
                        ["type": "image", "source": [
                            "type": "base64", "media_type": "image/png", "data": imageB64
                        ]],
                        ["type": "text", "text": prompt]
                    ]
                ]]
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } else {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
            let body: [String: Any] = [
                "model": model,
                "max_tokens": maxTokens,
                "messages": [[
                    "role": "user",
                    "content": [
                        ["type": "image_url", "image_url": ["url": "data:image/png;base64,\(imageB64)"]],
                        ["type": "text", "text": prompt]
                    ]
                ]]
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        return (url, request)
    }

    private func determineEndpoint(model: String) -> (String, String) {
        if model.hasPrefix("gpt-4") {
            return ("api.openai.com", "/v1/chat/completions")
        } else if model.hasPrefix("claude") {
            return ("api.anthropic.com", "/v1/messages")
        } else if model.hasPrefix("gemini") {
            return ("generativelanguage.googleapis.com", "/v1/models/\(model):generateContent")
        }
        return ("api.openai.com", "/v1/chat/completions")
    }

    // MARK: - Response Parsing

    private func parseVlmResponse(
        json: [String: Any], model: String
    ) -> (caption: String, description: String, detectedObjects: [DetectedObject]) {
        var textContent = ""

        if model.hasPrefix("claude") {
            let content = json["content"] as? [[String: Any]] ?? []
            textContent = (content.first?["text"] as? String) ?? ""
        } else if model.hasPrefix("gemini") {
            let candidates = json["candidates"] as? [[String: Any]] ?? []
            let parts = (candidates.first?["content"] as? [String: Any])?["parts"] as? [[String: Any]] ?? []
            textContent = (parts.first?["text"] as? String) ?? ""
        } else {
            let choices = json["choices"] as? [[String: Any]] ?? []
            let message = choices.first?["message"] as? [String: Any] ?? [:]
            textContent = (message["content"] as? String) ?? ""
        }

        // Strip markdown code blocks if present
        var jsonStr = textContent
        if let start = textContent.range(of: "```") {
            let afterBackticks = textContent[start.upperBound...]
            if let nlIndex = afterBackticks.firstIndex(of: "\n") {
                let contentAfterNl = afterBackticks[afterBackticks.index(after: nlIndex)...]
                if let endBlock = contentAfterNl.range(of: "```") {
                    jsonStr = String(contentAfterNl[..<endBlock.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }

        guard let jsonData = jsonStr.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return (String(textContent.prefix(200)), textContent, [])
        }

        let caption = (parsed["caption"] as? String) ?? ""
        let description = (parsed["description"] as? String) ?? ""
        let rawObjects = (parsed["detected_objects"] as? [[String: Any]]) ?? []

        let detectedObjects: [DetectedObject] = rawObjects.compactMap { obj in
            guard let label = obj["label"] as? String else { return nil }
            let confidence = (obj["confidence"] as? Double) ?? 0.5
            let bboxDict = obj["bbox"] as? [String: Double] ?? [:]
            let bbox = BoundingBox(
                x: bboxDict["x"] ?? 0,
                y: bboxDict["y"] ?? 0,
                width: bboxDict["width"] ?? 0,
                height: bboxDict["height"] ?? 0
            )
            return DetectedObject(label: label, confidence: confidence, bbox: bbox)
        }

        return (caption, description, detectedObjects)
    }
}
