// COPF Data Integration Kit - Auto-tagging enricher provider
// Classifies content into existing taxonomy using TF-IDF similarity.

import Foundation

public let AutoTagProviderID = "auto_tag"
public let AutoTagPluginType = "enricher_plugin"

public struct TagResult {
    public let term: String
    public let taxonomy: String
    public let confidence: Double
}

private struct TaxonomyTerm {
    let term: String
    let taxonomy: String
    let synonyms: [String]
    let keywords: [String]
}

private let stopWords: Set<String> = [
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "no", "only", "own", "same", "than", "too", "very", "just", "because",
    "this", "that", "these", "those", "it", "its", "i", "me", "my", "we",
    "our", "you", "your", "he", "him", "his", "she", "her", "they", "them"
]

public final class AutoTagEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let taxonomies = (config.options?["taxonomies"] as? [[String: Any]]) ?? []
        let maxTags = (config.options?["maxTags"] as? Int) ?? 10
        let threshold = config.threshold ?? 0.3

        let terms = parseTaxonomies(taxonomies)
        let contentTokens = tokenize(item.content)
        let contentTf = computeTermFrequency(contentTokens)
        let lowerContent = item.content.lowercased()

        var tagResults: [TagResult] = []

        for taxonomyTerm in terms {
            var termWords = [taxonomyTerm.term]
            termWords.append(contentsOf: taxonomyTerm.synonyms)
            termWords.append(contentsOf: taxonomyTerm.keywords)

            let termVector = buildTermVector(termWords)
            var similarity = cosineSimilarity(contentTf, termVector)

            // Boost for exact term match
            if lowerContent.contains(taxonomyTerm.term.lowercased()) {
                similarity = min(1.0, similarity + 0.3)
            }
            // Boost for synonym matches
            for synonym in taxonomyTerm.synonyms {
                if lowerContent.contains(synonym.lowercased()) {
                    similarity = min(1.0, similarity + 0.15)
                }
            }

            if similarity >= threshold {
                tagResults.append(TagResult(
                    term: taxonomyTerm.term,
                    taxonomy: taxonomyTerm.taxonomy,
                    confidence: (similarity * 1000).rounded() / 1000
                ))
            }
        }

        tagResults.sort { $0.confidence > $1.confidence }
        let topTags = Array(tagResults.prefix(maxTags))

        let avgConfidence: Double = topTags.isEmpty ? 0.0 :
            topTags.reduce(0.0) { $0 + $1.confidence } / Double(topTags.count)

        // Group by taxonomy
        var tagsByTaxonomy: [String: [[String: Any]]] = [:]
        for tag in topTags {
            let dict: [String: Any] = ["term": tag.term, "taxonomy": tag.taxonomy, "confidence": tag.confidence]
            tagsByTaxonomy[tag.taxonomy, default: []].append(dict)
        }

        let tagDicts: [[String: Any]] = topTags.map { t in
            ["term": t.term, "taxonomy": t.taxonomy, "confidence": t.confidence]
        }

        return EnrichmentResult(
            fields: [
                "tags": tagDicts,
                "tag_count": topTags.count,
                "tags_by_taxonomy": tagsByTaxonomy
            ],
            confidence: avgConfidence,
            metadata: [
                "provider": AutoTagProviderID,
                "taxonomyCount": taxonomies.count,
                "termCount": terms.count,
                "threshold": threshold,
                "maxTags": maxTags,
                "mode": "tfidf_similarity"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let applicable = ["text", "article", "document", "content", "post", "page", "product"]
        let nameLower = schema.name.lowercased()
        return applicable.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let charCount = item.content.count
        let durationMs = max(5, charCount / 2000)
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: durationMs)
    }

    // MARK: - TF-IDF

    private func tokenize(_ text: String) -> [String] {
        let cleaned = text.lowercased().unicodeScalars
            .map { $0.properties.isAlphabetic || $0.properties.numericType != nil || $0 == " " ? Character($0) : Character(" ") }
        return String(cleaned)
            .split(separator: " ")
            .map(String.init)
            .filter { $0.count > 2 && !stopWords.contains($0) }
    }

    private func computeTermFrequency(_ tokens: [String]) -> [String: Double] {
        var counts: [String: Double] = [:]
        for token in tokens {
            counts[token, default: 0.0] += 1.0
        }
        let maxFreq = counts.values.max() ?? 1.0
        for (key, val) in counts {
            counts[key] = 0.5 + 0.5 * (val / maxFreq)
        }
        return counts
    }

    private func buildTermVector(_ words: [String]) -> [String: Double] {
        var vector: [String: Double] = [:]
        for word in words {
            let tokens = tokenize(word)
            for token in tokens {
                vector[token, default: 0.0] += 1.0
            }
        }
        let maxVal = vector.values.max() ?? 1.0
        for (key, val) in vector {
            vector[key] = val / maxVal
        }
        return vector
    }

    private func cosineSimilarity(_ vecA: [String: Double], _ vecB: [String: Double]) -> Double {
        var dotProduct = 0.0
        var normA = 0.0
        var normB = 0.0

        let allKeys = Set(vecA.keys).union(Set(vecB.keys))
        for key in allKeys {
            let a = vecA[key] ?? 0.0
            let b = vecB[key] ?? 0.0
            dotProduct += a * b
            normA += a * a
            normB += b * b
        }

        let denominator = sqrt(normA) * sqrt(normB)
        return denominator > 0 ? dotProduct / denominator : 0.0
    }

    private func parseTaxonomies(_ taxonomies: [[String: Any]]) -> [TaxonomyTerm] {
        var terms: [TaxonomyTerm] = []
        for taxonomy in taxonomies {
            let taxonomyName = (taxonomy["name"] as? String) ?? "default"
            let termsList = (taxonomy["terms"] as? [[String: Any]]) ?? []
            for term in termsList {
                let termName = (term["term"] as? String) ?? (term["name"] as? String) ?? ""
                terms.append(TaxonomyTerm(
                    term: termName,
                    taxonomy: taxonomyName,
                    synonyms: (term["synonyms"] as? [String]) ?? [],
                    keywords: (term["keywords"] as? [String]) ?? []
                ))
            }
        }
        return terms
    }
}
