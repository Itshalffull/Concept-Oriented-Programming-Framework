// Clef Data Integration Kit - Auto-summarization enricher provider
// Implements extractive summarization (TF-IDF sentence scoring) with optional LLM abstractive mode.

import Foundation

public let AutoSummarizeProviderID = "auto_summarize"
public let AutoSummarizePluginType = "enricher_plugin"

private let summaryStopWords: Set<String> = [
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "and", "but", "or", "not", "this", "that", "it", "its", "i", "me", "my",
    "we", "our", "you", "your", "he", "him", "she", "her", "they", "them"
]

public final class AutoSummarizeEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let mode = (config.options?["mode"] as? String) ?? "extractive"
        let lengths = config.options?["lengths"] as? [String: Int] ?? ["short": 2, "medium": 5, "long": 10]
        let shortCount = lengths["short"] ?? 2
        let mediumCount = lengths["medium"] ?? 5
        let longCount = lengths["long"] ?? 10

        let summary: (short: String, medium: String, long: String)

        if mode == "abstractive", let apiKey = config.apiKey, !apiKey.isEmpty {
            summary = try await abstractiveSummarize(
                text: item.content, model: config.model ?? "gpt-4o-mini", apiKey: apiKey
            )
        } else {
            summary = extractiveSummarize(
                text: item.content, counts: (shortCount, mediumCount, longCount)
            )
        }

        let shortWc = summary.short.split(separator: " ").count
        let mediumWc = summary.medium.split(separator: " ").count
        let longWc = summary.long.split(separator: " ").count
        let originalWc = item.content.split(separator: " ").count
        let compressionRatio = originalWc > 0 ? Double(mediumWc) / Double(originalWc) : 1.0

        return EnrichmentResult(
            fields: [
                "summary": [
                    "short": summary.short,
                    "medium": summary.medium,
                    "long": summary.long
                ],
                "word_counts": ["short": shortWc, "medium": mediumWc, "long": longWc],
                "compression_ratio": (compressionRatio * 100).rounded() / 100
            ],
            confidence: mode == "abstractive" ? 0.85 : 0.7,
            metadata: [
                "provider": AutoSummarizeProviderID,
                "mode": mode,
                "originalWordCount": originalWc
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let textSchemas = ["text", "article", "document", "content", "post", "report", "paper"]
        let nameLower = schema.name.lowercased()
        return textSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let wordCount = item.content.split(separator: " ").count
        let durationMs = max(10, wordCount / 100)
        return CostEstimate(tokens: Int(Double(wordCount) * 1.3), apiCalls: 0, durationMs: durationMs)
    }

    // MARK: - Extractive Summarization

    private func extractiveSummarize(text: String, counts: (Int, Int, Int)) -> (short: String, medium: String, long: String) {
        let sentences = splitSentences(text)
        guard !sentences.isEmpty else { return ("", "", "") }

        let idf = computeIdf(sentences)
        let titleTokens = Set(tokenize(sentences[0]))

        var scored: [(index: Int, score: Double, sentence: String)] = sentences.enumerated().map { (idx, sent) in
            let score = scoreSentence(sent, index: idx, total: sentences.count, idf: idf, titleTokens: titleTokens)
            return (idx, score, sent)
        }
        scored.sort { $0.score > $1.score }

        func pickTopN(_ n: Int) -> String {
            var top = Array(scored.prefix(min(n, scored.count)))
            top.sort { $0.index < $1.index }
            return top.map { $0.sentence }.joined(separator: " ")
        }

        return (pickTopN(counts.0), pickTopN(counts.1), pickTopN(counts.2))
    }

    private func splitSentences(_ text: String) -> [String] {
        var sentences: [String] = []
        var current = ""
        for char in text {
            current.append(char)
            if ".!?".contains(char) && current.count > 10 {
                let trimmed = current.trimmingCharacters(in: .whitespaces)
                if trimmed.split(separator: " ").count >= 3 {
                    sentences.append(trimmed)
                }
                current = ""
            }
        }
        let trimmed = current.trimmingCharacters(in: .whitespaces)
        if trimmed.count > 10 && trimmed.split(separator: " ").count >= 3 {
            sentences.append(trimmed)
        }
        return sentences
    }

    private func tokenize(_ text: String) -> [String] {
        text.lowercased()
            .unicodeScalars.map { $0.properties.isAlphabetic || $0.properties.numericType != nil || $0 == " " ? Character($0) : Character(" ") }
            .map { String($0) }.joined()
            .split(separator: " ")
            .map(String.init)
            .filter { $0.count > 2 && !summaryStopWords.contains($0) }
    }

    private func computeIdf(_ sentences: [String]) -> [String: Double] {
        let n = Double(sentences.count)
        var df: [String: Double] = [:]
        for sentence in sentences {
            let unique = Set(tokenize(sentence))
            for token in unique {
                df[token, default: 0.0] += 1.0
            }
        }
        var idf: [String: Double] = [:]
        for (term, count) in df {
            idf[term] = log((n + 1.0) / (count + 1.0)) + 1.0
        }
        return idf
    }

    private func scoreSentence(
        _ sentence: String, index: Int, total: Int,
        idf: [String: Double], titleTokens: Set<String>
    ) -> Double {
        let tokens = tokenize(sentence)
        guard !tokens.isEmpty else { return 0.0 }

        // TF-IDF score
        var tokenCounts: [String: Double] = [:]
        for t in tokens { tokenCounts[t, default: 0.0] += 1.0 }
        var tfidfScore = 0.0
        for (token, count) in tokenCounts {
            let tf = count / Double(tokens.count)
            let idfVal = idf[token] ?? 1.0
            tfidfScore += tf * idfVal
        }

        // Position score
        let relPos = total > 1 ? Double(index) / Double(total - 1) : 0.0
        let positionScore: Double
        if relPos < 0.15 { positionScore = 3.0 }
        else if relPos < 0.3 { positionScore = 1.5 }
        else if relPos > 0.85 { positionScore = 2.0 }
        else { positionScore = 0.5 }

        // Length score
        let wordCount = sentence.split(separator: " ").count
        let lengthScore: Double
        if wordCount >= 8 && wordCount <= 30 { lengthScore = 2.0 }
        else if wordCount >= 5 && wordCount <= 40 { lengthScore = 1.0 }
        else { lengthScore = 0.3 }

        // Title overlap
        let overlap = tokens.filter { titleTokens.contains($0) }.count
        let keyPhraseScore = titleTokens.isEmpty ? 0.0 : (Double(overlap) / Double(titleTokens.count)) * 3.0

        // Cue phrases
        let cuePhrases = ["important", "significant", "key", "result", "conclusion", "summary", "therefore"]
        let lower = sentence.lowercased()
        let cueScore: Double = cuePhrases.contains(where: { lower.contains($0) }) ? 1.5 : 0.0

        return tfidfScore + positionScore + lengthScore + keyPhraseScore + cueScore
    }

    // MARK: - Abstractive Summarization via LLM

    private func abstractiveSummarize(text: String, model: String, apiKey: String) async throws -> (short: String, medium: String, long: String) {
        let truncatedText = String(text.prefix(8000))
        let prompt = """
        Summarize the following text at three different lengths:
        1. SHORT (1-2 sentences)
        2. MEDIUM (3-5 sentences)
        3. LONG (1-2 paragraphs)

        Respond in JSON: {"short": "...", "medium": "...", "long": "..."}

        Text:
        \(truncatedText)
        """

        let body: [String: Any] = [
            "model": model,
            "messages": [["role": "user", "content": prompt]],
            "max_tokens": 2000
        ]

        guard let url = URL(string: "https://api.openai.com/v1/chat/completions") else {
            throw EnricherError.parseError("Invalid API URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any],
              let content = message["content"] as? String else {
            return ("", "", "")
        }

        // Parse JSON from response
        if let jsonStart = content.range(of: "{"),
           let jsonEnd = content.range(of: "}", options: .backwards),
           let jsonData = String(content[jsonStart.lowerBound...jsonEnd.lowerBound]).data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] {
            return (parsed["short"] ?? "", parsed["medium"] ?? "", parsed["long"] ?? "")
        }

        return (String(content.prefix(200)), String(content.prefix(600)), content)
    }
}
