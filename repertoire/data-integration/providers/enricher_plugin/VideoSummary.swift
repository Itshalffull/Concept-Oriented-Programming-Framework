// Clef Data Integration Kit - Video summarization enricher provider
// Extracts keyframes at intervals, generates transcript via whisper, combines for chapter markers.

import Foundation

public let VideoSummaryProviderID = "video_summary"
public let VideoSummaryPluginType = "enricher_plugin"

public struct VideoChapter {
    public let title: String
    public let start: Double
    public let end: Double
}

public struct VideoKeyframe {
    public let timestamp: Double
    public let description: String
}

public final class VideoSummaryEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let chapterInterval = (config.options?["chapterInterval"] as? Double) ?? 300.0
        let language = (config.options?["language"] as? String) ?? "en"
        let summaryLengths = config.options?["summaryLengths"] as? [String: Int] ?? ["short": 2, "medium": 5, "long": 10]

        guard let videoData = Data(base64Encoded: item.content) else {
            throw EnricherError.parseError("Failed to decode base64 video content")
        }

        let videoPath = NSTemporaryDirectory() + "clef_video_\(item.id)_\(ProcessInfo.processInfo.processIdentifier).mp4"
        let audioPath = NSTemporaryDirectory() + "clef_audio_\(item.id)_\(ProcessInfo.processInfo.processIdentifier).wav"
        let keyframeDir = NSTemporaryDirectory() + "clef_keyframes_\(item.id)/"

        try videoData.write(to: URL(fileURLWithPath: videoPath))
        try FileManager.default.createDirectory(atPath: keyframeDir, withIntermediateDirectories: true)

        defer {
            try? FileManager.default.removeItem(atPath: videoPath)
            try? FileManager.default.removeItem(atPath: audioPath)
            try? FileManager.default.removeItem(atPath: keyframeDir)
        }

        // Step 1: Get video duration via ffprobe
        let duration = try getVideoDuration(videoPath: videoPath)

        // Step 2: Extract keyframes using ffmpeg
        let kfInterval = max(10.0, chapterInterval / 6.0)
        let keyframes = try extractKeyframes(videoPath: videoPath, interval: kfInterval, outputDir: keyframeDir)

        // Step 3: Extract audio track and transcribe
        try extractAudioTrack(videoPath: videoPath, audioPath: audioPath)
        let segments = transcribeAudio(audioPath: audioPath, language: language)

        // Step 4: Generate chapters
        let chapters = generateChapters(segments: segments, interval: chapterInterval, totalDuration: duration)

        // Step 5: Generate summaries at multiple lengths
        let shortCount = summaryLengths["short"] ?? 2
        let mediumCount = summaryLengths["medium"] ?? 5
        let longCount = summaryLengths["long"] ?? 10
        let summary = generateSummary(segments: segments, counts: (shortCount, mediumCount, longCount))

        let fullTranscript = segments.map { $0.text }.joined(separator: " ")

        let chapterDicts: [[String: Any]] = chapters.map {
            ["title": $0.title, "start": $0.start, "end": $0.end]
        }
        let keyframeDicts: [[String: Any]] = keyframes.map {
            ["timestamp": $0.timestamp, "description": $0.description]
        }

        return EnrichmentResult(
            fields: [
                "summary": ["short": summary.short, "medium": summary.medium, "long": summary.long],
                "chapters": chapterDicts,
                "keyframes": keyframeDicts,
                "transcript_text": fullTranscript,
                "duration_seconds": duration
            ],
            confidence: segments.isEmpty ? 0.4 : 0.8,
            metadata: [
                "provider": VideoSummaryProviderID,
                "chapterCount": chapters.count,
                "keyframeCount": keyframes.count,
                "segmentCount": segments.count,
                "language": language
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let videoSchemas = ["video", "movie", "clip", "recording", "lecture", "presentation"]
        let nameLower = schema.name.lowercased()
        return videoSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let sizeKb = Double(item.content.count) * 3.0 / 4.0 / 1024.0
        let estimatedDurationSec = sizeKb / 500.0
        let keyframeMs = estimatedDurationSec * 100.0
        let transcriptionMs = estimatedDurationSec * 33.0
        let totalMs = keyframeMs + transcriptionMs + 5000.0
        return CostEstimate(tokens: nil, apiCalls: 1, durationMs: Int(totalMs))
    }

    // MARK: - Video Processing

    private func getVideoDuration(videoPath: String) throws -> Double {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", videoPath]
        let pipe = Pipe()
        process.standardOutput = pipe
        try process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let format = json["format"] as? [String: Any],
              let durationStr = format["duration"] as? String,
              let duration = Double(durationStr) else {
            throw EnricherError.parseError("Could not read video duration")
        }
        return duration
    }

    private func extractKeyframes(videoPath: String, interval: Double, outputDir: String) throws -> [VideoKeyframe] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        let vfFilter = "fps=1/\(Int(interval)),select='gt(scene,0.3)+not(mod(n,1))'"
        process.arguments = [
            "ffmpeg", "-i", videoPath, "-vf", vfFilter,
            "-vsync", "vfr", "-q:v", "2", "\(outputDir)/keyframe_%04d.jpg"
        ]
        try process.run()
        process.waitUntilExit()

        let files = (try? FileManager.default.contentsOfDirectory(atPath: outputDir)) ?? []
        let sorted = files.filter { $0.hasPrefix("keyframe_") }.sorted()

        return sorted.enumerated().map { (idx, _) in
            let ts = Double(idx) * interval
            return VideoKeyframe(timestamp: ts, description: "Keyframe at \(formatTimestamp(ts))")
        }
    }

    private func extractAudioTrack(videoPath: String, audioPath: String) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["ffmpeg", "-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audioPath]
        try process.run()
        process.waitUntilExit()
    }

    private func transcribeAudio(audioPath: String, language: String) -> [(text: String, start: Double, end: Double)] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [
            "whisper", audioPath, "--model", "base", "--language", language,
            "--output_format", "json", "--output_dir", NSTemporaryDirectory()
        ]
        do { try process.run() } catch { return [] }
        process.waitUntilExit()

        let stem = (audioPath as NSString).deletingPathExtension
        let jsonPath = NSTemporaryDirectory() + ((stem as NSString).lastPathComponent) + ".json"
        defer { try? FileManager.default.removeItem(atPath: jsonPath) }

        guard let data = try? Data(contentsOf: URL(fileURLWithPath: jsonPath)),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let segs = json["segments"] as? [[String: Any]] else { return [] }

        return segs.compactMap { seg in
            guard let text = seg["text"] as? String else { return nil }
            let start = (seg["start"] as? Double) ?? 0.0
            let end = (seg["end"] as? Double) ?? 0.0
            return (text.trimmingCharacters(in: .whitespaces), start, end)
        }
    }

    // MARK: - Chapter & Summary Generation

    private func generateChapters(
        segments: [(text: String, start: Double, end: Double)],
        interval: Double, totalDuration: Double
    ) -> [VideoChapter] {
        var chapters: [VideoChapter] = []
        var chapterStart = 0.0

        while chapterStart < totalDuration {
            let chapterEnd = min(chapterStart + interval, totalDuration)
            let chapterSegs = segments.filter { $0.start >= chapterStart && $0.start < chapterEnd }

            let title: String
            if !chapterSegs.isEmpty {
                let combined = chapterSegs.map { $0.text }.joined(separator: " ")
                let firstSentence = combined.components(separatedBy: CharacterSet(charactersIn: ".!?"))
                    .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? ""
                title = String(firstSentence.trimmingCharacters(in: .whitespaces).prefix(80))
            } else {
                title = "Chapter at \(formatTimestamp(chapterStart))"
            }

            chapters.append(VideoChapter(title: title, start: chapterStart, end: chapterEnd))
            chapterStart = chapterEnd
        }
        return chapters
    }

    private func generateSummary(
        segments: [(text: String, start: Double, end: Double)],
        counts: (Int, Int, Int)
    ) -> (short: String, medium: String, long: String) {
        let fullText = segments.map { $0.text }.joined(separator: " ")
        let sentences = fullText.components(separatedBy: CharacterSet(charactersIn: ".!?"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.split(separator: " ").count >= 3 }

        var scored: [(sentence: String, score: Double)] = sentences.enumerated().map { (idx, sent) in
            var score = 0.0
            if idx == 0 { score += 3.0 }
            if idx == sentences.count - 1 { score += 2.0 }
            if Double(idx) < Double(sentences.count) * 0.2 { score += 1.0 }
            let wc = sent.split(separator: " ").count
            if wc >= 8 && wc <= 25 { score += 2.0 }
            return (sent, score)
        }
        scored.sort { $0.score > $1.score }

        func pick(_ n: Int) -> String {
            scored.prefix(n).map { $0.sentence }.joined(separator: ". ") + "."
        }

        return (pick(counts.0), pick(counts.1), pick(counts.2))
    }

    private func formatTimestamp(_ seconds: Double) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
}
