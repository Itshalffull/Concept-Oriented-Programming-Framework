// COPF Data Integration Kit - Sentiment analysis enricher provider
// Scores text sentiment using lexicon-based approach with valence scores.

import Foundation

public let SentimentProviderID = "sentiment"
public let SentimentPluginType = "enricher_plugin"

public enum SentimentLabel: String {
    case positive, negative, neutral
}

private let positiveLexicon: [String: Double] = [
    "excellent": 4.5, "amazing": 4.2, "wonderful": 4.0, "fantastic": 4.3,
    "great": 3.5, "good": 2.5, "nice": 2.0, "love": 3.8, "loved": 3.8,
    "like": 1.5, "enjoy": 2.5, "happy": 3.0, "pleased": 2.8, "delighted": 3.5,
    "perfect": 4.5, "beautiful": 3.2, "brilliant": 4.0, "outstanding": 4.5,
    "superb": 4.2, "terrific": 3.8, "impressive": 3.5, "remarkable": 3.5,
    "best": 4.0, "better": 2.0, "improve": 2.0, "recommend": 3.0,
    "helpful": 2.5, "useful": 2.0, "efficient": 2.5, "effective": 2.5,
    "reliable": 2.5, "success": 3.5, "successful": 3.5, "positive": 2.5,
    "optimistic": 2.5, "enthusiastic": 3.0, "grateful": 3.0, "appreciate": 2.5
]

private let negativeLexicon: [String: Double] = [
    "terrible": -4.5, "horrible": -4.5, "awful": -4.2, "dreadful": -4.0,
    "bad": -2.5, "poor": -2.5, "worst": -4.5, "worse": -3.0,
    "hate": -4.0, "hated": -4.0, "dislike": -2.5, "disgust": -3.5,
    "angry": -3.0, "furious": -4.0, "annoyed": -2.5, "frustrated": -3.0,
    "disappointed": -3.0, "disappointing": -3.0, "fail": -3.0, "failed": -3.0,
    "failure": -3.5, "problem": -2.0, "problems": -2.0, "issue": -1.5,
    "error": -2.0, "errors": -2.0, "broken": -3.0, "useless": -3.5,
    "waste": -3.0, "ugly": -2.5, "difficult": -1.5, "painful": -2.5,
    "sad": -2.5, "unhappy": -2.5, "unfortunate": -2.0, "regret": -2.5,
    "worry": -2.0, "worried": -2.0, "fear": -2.5, "afraid": -2.5,
    "negative": -2.5, "pessimistic": -2.5, "critical": -1.5, "crisis": -3.0
]

private let intensifiers: [String: Double] = [
    "very": 1.5, "extremely": 2.0, "incredibly": 2.0, "absolutely": 2.0,
    "really": 1.3, "quite": 1.2, "fairly": 1.1, "rather": 1.1,
    "somewhat": 0.8, "slightly": 0.7, "barely": 0.5, "totally": 1.8,
    "completely": 1.8, "utterly": 2.0, "truly": 1.5
]

private let negationWords: Set<String> = [
    "not", "n't", "no", "never", "neither", "nor", "hardly", "barely",
    "scarcely", "seldom", "rarely", "without", "lack", "lacking"
]

public final class SentimentEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let granularity = (config.options?["granularity"] as? String) ?? "document"

        if granularity == "sentence" {
            return analyzeSentenceLevel(item: item)
        }

        // Document-level analysis
        let result = analyzeValence(item.content)

        return EnrichmentResult(
            fields: [
                "sentiment": result.sentiment.rawValue,
                "score": result.score,
                "magnitude": result.magnitude
            ],
            confidence: min(0.9, 0.5 + abs(result.score) * 0.4),
            metadata: [
                "provider": SentimentProviderID,
                "granularity": granularity,
                "mode": "lexicon_based"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let applicable = ["text", "review", "comment", "feedback", "post", "message", "tweet"]
        let nameLower = schema.name.lowercased()
        return applicable.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let wordCount = item.content.split(separator: " ").count
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: max(5, wordCount / 500))
    }

    // MARK: - Sentence-Level Analysis

    private func analyzeSentenceLevel(item: ContentItem) -> EnrichmentResult {
        let sentences = splitSentences(item.content)
        let results: [[String: Any]] = sentences.map { sent in
            let score = analyzeValence(sent)
            return [
                "text": String(sent.prefix(200)),
                "sentiment": score.sentiment.rawValue,
                "score": score.score,
                "magnitude": score.magnitude
            ]
        }

        let avgScore: Double = results.isEmpty ? 0.0 :
            results.compactMap { ($0["score"] as? Double) }.reduce(0.0, +) / Double(results.count)
        let overall: SentimentLabel = avgScore > 0.05 ? .positive : avgScore < -0.05 ? .negative : .neutral

        let posCount = results.filter { ($0["sentiment"] as? String) == "positive" }.count
        let negCount = results.filter { ($0["sentiment"] as? String) == "negative" }.count
        let neuCount = results.count - posCount - negCount

        return EnrichmentResult(
            fields: [
                "sentiment": overall.rawValue,
                "score": (avgScore * 1000).rounded() / 1000,
                "sentences": results,
                "sentence_count": results.count,
                "positive_count": posCount,
                "negative_count": negCount,
                "neutral_count": neuCount
            ],
            confidence: min(0.95, 0.5 + Double(results.count) * 0.02),
            metadata: [
                "provider": SentimentProviderID,
                "granularity": "sentence",
                "mode": "lexicon_based"
            ]
        )
    }

    // MARK: - Core Valence Analysis

    private func analyzeValence(_ text: String) -> (sentiment: SentimentLabel, score: Double, magnitude: Double) {
        let cleaned = text.lowercased().unicodeScalars
            .map { $0.properties.isAlphabetic || $0 == "'" || $0 == " " || $0 == "-" ? Character($0) : Character(" ") }
        let tokens = String(cleaned).split(separator: " ").map(String.init).filter { !$0.isEmpty }

        var totalValence = 0.0
        var wordCount = 0
        var isNegated = false
        var intensifierMult = 1.0

        for (i, token) in tokens.enumerated() {
            if negationWords.contains(token) || token.hasSuffix("n't") {
                isNegated = true
                continue
            }
            if let mult = intensifiers[token] {
                intensifierMult = mult
                continue
            }

            let valence: Double? = positiveLexicon[token] ?? negativeLexicon[token]

            if var v = valence {
                if isNegated {
                    v *= -0.75
                    isNegated = false
                }
                v *= intensifierMult
                intensifierMult = 1.0
                totalValence += v
                wordCount += 1
            } else {
                if i > 0 && !negationWords.contains(tokens[i - 1]) {
                    isNegated = false
                }
                intensifierMult = 1.0
            }
        }

        let normalized = wordCount > 0 ?
            max(-1.0, min(1.0, totalValence / (Double(wordCount) * 2.5))) : 0.0
        let magnitude = abs(totalValence)
        let sentiment: SentimentLabel = normalized > 0.05 ? .positive :
            normalized < -0.05 ? .negative : .neutral

        return (sentiment, (normalized * 1000).rounded() / 1000, magnitude)
    }

    private func splitSentences(_ text: String) -> [String] {
        var sentences: [String] = []
        var current = ""
        for char in text {
            current.append(char)
            if ".!?".contains(char) && current.count > 5 {
                let trimmed = current.trimmingCharacters(in: .whitespaces)
                if !trimmed.isEmpty { sentences.append(trimmed) }
                current = ""
            }
        }
        let trimmed = current.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty { sentences.append(trimmed) }
        return sentences
    }
}
