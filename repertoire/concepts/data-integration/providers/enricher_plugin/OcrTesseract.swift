// Clef Data Integration Kit - Local OCR via Tesseract enricher provider
// Shells out to the tesseract binary, parses HOCR output for word-level bounding boxes.

import Foundation

public let OcrTesseractProviderID = "ocr_tesseract"
public let OcrTesseractPluginType = "enricher_plugin"

public struct ContentItem {
    public let id: String
    public let content: String
    public let contentType: String
    public let metadata: [String: Any]?
}

public struct EnricherConfig {
    public let model: String?
    public let apiKey: String?
    public let threshold: Double?
    public let options: [String: Any]?
}

public struct EnrichmentResult {
    public let fields: [String: Any]
    public let confidence: Double
    public let metadata: [String: Any]?
}

public struct SchemaRef {
    public let name: String
    public let fields: [String]?
}

public struct CostEstimate {
    public let tokens: Int?
    public let apiCalls: Int?
    public let durationMs: Int?
}

public struct WordBox {
    public let word: String
    public let x1: Int
    public let y1: Int
    public let x2: Int
    public let y2: Int
    public let confidence: Double
}

public enum EnricherError: Error {
    case processError(String)
    case parseError(String)
    case ioError(String)
}

public final class OcrTesseractEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let language = (config.options?["language"] as? String) ?? "eng"
        let psm = (config.options?["psm"] as? Int) ?? 3
        let dpi = (config.options?["dpi"] as? Int) ?? 300

        // Decode base64 image and write to temp file
        guard let imageData = Data(base64Encoded: item.content) else {
            throw EnricherError.parseError("Failed to decode base64 image content")
        }

        let tmpPath = NSTemporaryDirectory() + "clef_ocr_\(item.id)_\(ProcessInfo.processInfo.processIdentifier).png"
        let tmpURL = URL(fileURLWithPath: tmpPath)

        try imageData.write(to: tmpURL)
        defer { try? FileManager.default.removeItem(at: tmpURL) }

        // Shell out to tesseract with HOCR output
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [
            "tesseract", tmpPath, "stdout",
            "-l", language,
            "--psm", String(psm),
            "--dpi", String(dpi),
            "hocr"
        ]

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        try process.run()
        process.waitUntilExit()

        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()

        guard process.terminationStatus == 0 else {
            let errMsg = String(data: stderrData, encoding: .utf8) ?? "Unknown error"
            throw EnricherError.processError("Tesseract failed: \(errMsg)")
        }

        let hocr = String(data: stdoutData, encoding: .utf8) ?? ""
        let (text, wordBoxes) = parseHocr(hocr)

        let avgConfidence: Double = wordBoxes.isEmpty ? 0.0 :
            wordBoxes.reduce(0.0) { $0 + $1.confidence } / Double(wordBoxes.count)

        let boxDicts: [[String: Any]] = wordBoxes.map { box in
            [
                "word": box.word,
                "x1": box.x1, "y1": box.y1,
                "x2": box.x2, "y2": box.y2,
                "confidence": box.confidence
            ]
        }

        return EnrichmentResult(
            fields: [
                "extracted_text": text,
                "word_boxes": boxDicts,
                "word_count": wordBoxes.count
            ],
            confidence: avgConfidence,
            metadata: [
                "provider": OcrTesseractProviderID,
                "language": language,
                "psm": psm,
                "dpi": dpi,
                "processingEngine": "tesseract"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let imageSchemas = ["image", "document_scan", "scanned_page", "photo"]
        let nameLower = schema.name.lowercased()
        return imageSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let sizeKb = Double(item.content.count) * 3.0 / 4.0 / 1024.0
        let estimatedMs = max(500.0, min(30000.0, sizeKb * 2.0))
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: Int(estimatedMs))
    }

    // Parse HOCR XML output for word-level bounding boxes
    private func parseHocr(_ hocr: String) -> (String, [WordBox]) {
        var wordBoxes: [WordBox] = []
        var textParts: [String] = []

        // Match ocrx_word spans with bbox and confidence
        let pattern = #"<span[^>]*class=['\"]ocrx_word['\"][^>]*title=['\"]bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+);\s*x_wconf\s+(\d+)['\"][^>]*>([^<]+)</span>"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return ("", [])
        }

        let nsHocr = hocr as NSString
        let matches = regex.matches(in: hocr, range: NSRange(location: 0, length: nsHocr.length))

        for match in matches {
            guard match.numberOfRanges >= 7 else { continue }
            let x1 = Int(nsHocr.substring(with: match.range(at: 1))) ?? 0
            let y1 = Int(nsHocr.substring(with: match.range(at: 2))) ?? 0
            let x2 = Int(nsHocr.substring(with: match.range(at: 3))) ?? 0
            let y2 = Int(nsHocr.substring(with: match.range(at: 4))) ?? 0
            let conf = Int(nsHocr.substring(with: match.range(at: 5))) ?? 0
            let word = nsHocr.substring(with: match.range(at: 6)).trimmingCharacters(in: .whitespaces)

            if !word.isEmpty {
                textParts.append(word)
                wordBoxes.append(WordBox(
                    word: word,
                    x1: x1, y1: y1, x2: x2, y2: y2,
                    confidence: Double(conf) / 100.0
                ))
            }
        }

        return (textParts.joined(separator: " "), wordBoxes)
    }
}
