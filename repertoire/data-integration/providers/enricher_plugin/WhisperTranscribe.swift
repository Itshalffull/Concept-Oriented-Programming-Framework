// Clef Data Integration Kit - Audio/video transcription enricher provider via Whisper
// Sends audio to Whisper API or runs locally, parses timestamped segments.

import Foundation

public let WhisperTranscribeProviderID = "whisper_transcribe"
public let WhisperTranscribePluginType = "enricher_plugin"

public struct TranscriptSegment {
    public let text: String
    public let start: Double
    public let end: Double
    public let confidence: Double
}

public final class WhisperTranscribeEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let modelSize = (config.options?["modelSize"] as? String) ?? "base"
        let language = (config.options?["language"] as? String) ?? "en"
        let useApi = config.apiKey != nil && !config.apiKey!.isEmpty

        let segments: [TranscriptSegment]

        if useApi {
            segments = try await transcribeApi(
                audioB64: item.content, apiKey: config.apiKey!,
                model: config.model ?? "whisper-1", language: language
            )
        } else {
            segments = try await transcribeLocal(
                item: item, modelSize: modelSize, language: language
            )
        }

        let fullText = segments.map { $0.text }.joined(separator: " ")
        let avgConfidence: Double = segments.isEmpty ? 0.0 :
            segments.reduce(0.0) { $0 + $1.confidence } / Double(segments.count)
        let totalDuration = segments.last?.end ?? 0.0
        let wordCount = fullText.split(separator: " ").count

        let segmentDicts: [[String: Any]] = segments.map { seg in
            ["text": seg.text, "start": seg.start, "end": seg.end, "confidence": seg.confidence]
        }

        return EnrichmentResult(
            fields: [
                "transcript": ["text": fullText, "segments": segmentDicts] as [String: Any],
                "word_count": wordCount,
                "duration_seconds": totalDuration
            ],
            confidence: avgConfidence,
            metadata: [
                "provider": WhisperTranscribeProviderID,
                "modelSize": modelSize,
                "language": language,
                "segmentCount": segments.count,
                "mode": useApi ? "api" : "local"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let audioSchemas = ["audio", "video", "podcast", "recording", "speech", "media"]
        let nameLower = schema.name.lowercased()
        return audioSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let sizeKb = Double(item.content.count) * 3.0 / 4.0 / 1024.0
        let isCompressed = item.contentType.contains("mp3") || item.contentType.contains("ogg")
        let bytesPerSec: Double = isCompressed ? 2048.0 : 16384.0
        let estimatedDurationSec = (sizeKb * 1024.0) / bytesPerSec
        let processingMs = max(1000.0, estimatedDurationSec * 33.0)
        return CostEstimate(tokens: nil, apiCalls: 1, durationMs: Int(processingMs))
    }

    // MARK: - Local Transcription

    private func transcribeLocal(
        item: ContentItem, modelSize: String, language: String
    ) async throws -> [TranscriptSegment] {
        guard let audioData = Data(base64Encoded: item.content) else {
            throw EnricherError.parseError("Failed to decode base64 audio content")
        }

        let tmpPath = NSTemporaryDirectory() + "clef_audio_\(item.id)_\(ProcessInfo.processInfo.processIdentifier).wav"
        try audioData.write(to: URL(fileURLWithPath: tmpPath))
        defer { try? FileManager.default.removeItem(atPath: tmpPath) }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [
            "whisper", tmpPath,
            "--model", modelSize,
            "--language", language,
            "--output_format", "json",
            "--output_dir", NSTemporaryDirectory()
        ]

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let errData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let errMsg = String(data: errData, encoding: .utf8) ?? "Unknown error"
            throw EnricherError.processError("Whisper failed: \(errMsg)")
        }

        // Read the generated JSON output
        let baseName = (tmpPath as NSString).deletingPathExtension
        let jsonPath = NSTemporaryDirectory() + (baseName as NSString).lastPathComponent + ".json"
        let jsonData = try Data(contentsOf: URL(fileURLWithPath: jsonPath))
        defer { try? FileManager.default.removeItem(atPath: jsonPath) }

        return parseWhisperJson(data: jsonData)
    }

    // MARK: - API Transcription

    private func transcribeApi(
        audioB64: String, apiKey: String, model: String, language: String
    ) async throws -> [TranscriptSegment] {
        guard let audioData = Data(base64Encoded: audioB64) else {
            throw EnricherError.parseError("Failed to decode base64 audio")
        }

        let boundary = "----CopfBoundary\(Int(Date().timeIntervalSince1970 * 1000))"
        var body = Data()

        // Build multipart form data
        func appendField(name: String, value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        appendField(name: "model", value: model)
        appendField(name: "response_format", value: "verbose_json")
        appendField(name: "language", value: language)

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        guard let url = URL(string: "https://api.openai.com/v1/audio/transcriptions") else {
            throw EnricherError.parseError("Invalid Whisper API URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw EnricherError.processError("Whisper API request failed")
        }

        return parseWhisperJson(data: data)
    }

    // MARK: - Parsing

    private func parseWhisperJson(data: Data) -> [TranscriptSegment] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let segments = json["segments"] as? [[String: Any]] else {
            return []
        }

        return segments.compactMap { seg in
            guard let text = seg["text"] as? String else { return nil }
            let start = (seg["start"] as? Double) ?? 0.0
            let end = (seg["end"] as? Double) ?? 0.0
            let confidence: Double
            if let avgLogprob = seg["avg_logprob"] as? Double {
                confidence = exp(avgLogprob)
            } else if let noSpeech = seg["no_speech_prob"] as? Double {
                confidence = 1.0 - noSpeech
            } else {
                confidence = 0.85
            }
            return TranscriptSegment(
                text: text.trimmingCharacters(in: .whitespaces),
                start: start, end: end, confidence: confidence
            )
        }
    }
}
