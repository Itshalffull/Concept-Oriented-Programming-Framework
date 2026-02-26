// Clef Data Integration Kit - Cloud OCR enricher provider (AWS Textract, Google Vision, Azure)
// Builds HTTP requests to cloud OCR APIs, parses structured responses with tables/forms/key-value pairs.

import Foundation

public let OcrCloudProviderID = "ocr_cloud"
public let OcrCloudPluginType = "enricher_plugin"

public enum OcrCloudProvider: String {
    case textract
    case vision
    case azure
}

public struct OcrTableCell {
    public let row: Int
    public let col: Int
    public let text: String
    public let confidence: Double
}

public struct OcrFormField {
    public let key: String
    public let value: String
    public let confidence: Double
}

public final class OcrCloudEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let providerStr = (config.options?["provider"] as? String) ?? "textract"
        guard let cloudProvider = OcrCloudProvider(rawValue: providerStr) else {
            throw EnricherError.parseError("Unsupported cloud provider: \(providerStr)")
        }
        let apiKey = config.apiKey ?? ""
        let region = (config.options?["region"] as? String) ?? "us-east-1"

        let (url, request) = try buildRequest(
            provider: cloudProvider, imageB64: item.content, apiKey: apiKey, region: region
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw EnricherError.processError("Cloud OCR API returned status \(statusCode)")
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let parsed = parseResponse(provider: cloudProvider, json: json)

        return EnrichmentResult(
            fields: [
                "structured_text": parsed.text,
                "tables": parsed.tables.map { cell in
                    ["row": cell.row, "col": cell.col, "text": cell.text, "confidence": cell.confidence] as [String: Any]
                },
                "forms": parsed.forms.map { field in
                    ["key": field.key, "value": field.value, "confidence": field.confidence] as [String: Any]
                }
            ],
            confidence: parsed.confidence,
            metadata: [
                "provider": OcrCloudProviderID,
                "cloudProvider": providerStr,
                "region": region
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let applicable = ["image", "document", "scan", "receipt", "invoice", "form"]
        let nameLower = schema.name.lowercased()
        return applicable.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let sizeKb = Double(item.content.count) * 3.0 / 4.0 / 1024.0
        let pages = max(1, Int(ceil(sizeKb / 200.0)))
        return CostEstimate(tokens: nil, apiCalls: 1, durationMs: 1500 + pages * 500)
    }

    // MARK: - Request Building

    private func buildRequest(
        provider: OcrCloudProvider, imageB64: String, apiKey: String, region: String
    ) throws -> (URL, URLRequest) {
        switch provider {
        case .textract:
            return try buildTextractRequest(imageB64: imageB64, region: region, apiKey: apiKey)
        case .vision:
            return try buildVisionRequest(imageB64: imageB64, apiKey: apiKey)
        case .azure:
            return try buildAzureRequest(imageB64: imageB64, apiKey: apiKey, region: region)
        }
    }

    private func buildTextractRequest(imageB64: String, region: String, apiKey: String) throws -> (URL, URLRequest) {
        let urlStr = "https://textract.\(region).amazonaws.com/"
        guard let url = URL(string: urlStr) else { throw EnricherError.parseError("Invalid Textract URL") }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-amz-json-1.1", forHTTPHeaderField: "Content-Type")
        request.setValue("Textract.AnalyzeDocument", forHTTPHeaderField: "X-Amz-Target")
        request.setValue("AWS4-HMAC-SHA256 Credential=\(apiKey)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "Document": ["Bytes": imageB64],
            "FeatureTypes": ["TABLES", "FORMS"]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return (url, request)
    }

    private func buildVisionRequest(imageB64: String, apiKey: String) throws -> (URL, URLRequest) {
        let urlStr = "https://vision.googleapis.com/v1/images:annotate?key=\(apiKey)"
        guard let url = URL(string: urlStr) else { throw EnricherError.parseError("Invalid Vision URL") }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "requests": [[
                "image": ["content": imageB64],
                "features": [
                    ["type": "DOCUMENT_TEXT_DETECTION", "maxResults": 50],
                    ["type": "TEXT_DETECTION", "maxResults": 50]
                ]
            ]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return (url, request)
    }

    private func buildAzureRequest(imageB64: String, apiKey: String, region: String) throws -> (URL, URLRequest) {
        let urlStr = "https://\(region).api.cognitive.microsoft.com/vision/v3.2/read/analyze?readingOrder=natural"
        guard let url = URL(string: urlStr) else { throw EnricherError.parseError("Invalid Azure URL") }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")

        let body: [String: Any] = ["url": "data:image/png;base64,\(imageB64)"]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return (url, request)
    }

    // MARK: - Response Parsing

    private func parseResponse(
        provider: OcrCloudProvider, json: [String: Any]
    ) -> (text: String, tables: [OcrTableCell], forms: [OcrFormField], confidence: Double) {
        switch provider {
        case .textract:
            return parseTextractResponse(json)
        case .vision:
            return parseVisionResponse(json)
        case .azure:
            return parseAzureResponse(json)
        }
    }

    private func parseTextractResponse(_ json: [String: Any]) -> (String, [OcrTableCell], [OcrFormField], Double) {
        guard let blocks = json["Blocks"] as? [[String: Any]] else {
            return ("", [], [], 0.0)
        }

        var lines: [String] = []
        var totalConf = 0.0
        var confCount = 0

        for block in blocks where (block["BlockType"] as? String) == "LINE" {
            if let text = block["Text"] as? String { lines.append(text) }
            if let conf = block["Confidence"] as? Double { totalConf += conf / 100.0; confCount += 1 }
        }

        // Parse CELL blocks for tables
        var tables: [OcrTableCell] = []
        for block in blocks where (block["BlockType"] as? String) == "CELL" {
            let row = (block["RowIndex"] as? Int) ?? 0
            let col = (block["ColumnIndex"] as? Int) ?? 0
            let conf = ((block["Confidence"] as? Double) ?? 0.0) / 100.0
            let cellText = resolveChildText(block: block, allBlocks: blocks)
            tables.append(OcrTableCell(row: row, col: col, text: cellText, confidence: conf))
        }

        // Parse KEY_VALUE_SET for forms
        var forms: [OcrFormField] = []
        for block in blocks {
            guard (block["BlockType"] as? String) == "KEY_VALUE_SET",
                  let entityTypes = block["EntityTypes"] as? [String],
                  entityTypes.contains("KEY") else { continue }
            let conf = ((block["Confidence"] as? Double) ?? 0.0) / 100.0
            let keyText = resolveChildText(block: block, allBlocks: blocks)
            let valueText = resolveValueText(block: block, allBlocks: blocks)
            forms.append(OcrFormField(key: keyText, value: valueText, confidence: conf))
        }

        let avgConf = confCount > 0 ? totalConf / Double(confCount) : 0.0
        return (lines.joined(separator: "\n"), tables, forms, avgConf)
    }

    private func parseVisionResponse(_ json: [String: Any]) -> (String, [OcrTableCell], [OcrFormField], Double) {
        let responses = json["responses"] as? [[String: Any]] ?? []
        let first = responses.first ?? [:]
        let annotation = first["fullTextAnnotation"] as? [String: Any] ?? [:]
        let text = (annotation["text"] as? String) ?? ""

        var totalConf = 0.0
        var count = 0
        if let pages = annotation["pages"] as? [[String: Any]] {
            for page in pages {
                for block in (page["blocks"] as? [[String: Any]]) ?? [] {
                    if let conf = block["confidence"] as? Double {
                        totalConf += conf; count += 1
                    }
                }
            }
        }
        let confidence = count > 0 ? totalConf / Double(count) : 0.0
        return (text, [], [], confidence)
    }

    private func parseAzureResponse(_ json: [String: Any]) -> (String, [OcrTableCell], [OcrFormField], Double) {
        let analyzeResult = json["analyzeResult"] as? [String: Any] ?? [:]
        let readResults = analyzeResult["readResults"] as? [[String: Any]] ?? []
        var allLines: [String] = []
        for result in readResults {
            let lines = result["lines"] as? [[String: Any]] ?? []
            for line in lines {
                if let text = line["text"] as? String { allLines.append(text) }
            }
        }
        return (allLines.joined(separator: "\n"), [], [], 0.9)
    }

    private func resolveChildText(block: [String: Any], allBlocks: [[String: Any]]) -> String {
        guard let rels = block["Relationships"] as? [[String: Any]] else { return "" }
        let childIds = rels.filter { ($0["Type"] as? String) == "CHILD" }
            .flatMap { ($0["Ids"] as? [String]) ?? [] }
        return childIds.compactMap { cid in
            allBlocks.first { ($0["Id"] as? String) == cid }
        }.compactMap { $0["Text"] as? String }.joined(separator: " ")
    }

    private func resolveValueText(block: [String: Any], allBlocks: [[String: Any]]) -> String {
        guard let rels = block["Relationships"] as? [[String: Any]] else { return "" }
        let valueIds = rels.filter { ($0["Type"] as? String) == "VALUE" }
            .flatMap { ($0["Ids"] as? [String]) ?? [] }
        return valueIds.compactMap { vid in
            allBlocks.first { ($0["Id"] as? String) == vid }
        }.compactMap { $0["Text"] as? String }.joined(separator: " ")
    }
}
