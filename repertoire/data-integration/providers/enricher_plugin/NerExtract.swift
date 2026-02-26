// COPF Data Integration Kit - Named Entity Recognition enricher provider
// Tokenizes text, applies NER rules (pattern-based for known entity types), returns entity spans.

import Foundation

public let NerExtractProviderID = "ner_extract"
public let NerExtractPluginType = "enricher_plugin"

public enum NerEntityType: String, Codable {
    case PERSON, ORG, LOC, EVENT, DATE, MONEY, EMAIL, URL, PHONE
}

public struct NerEntity {
    public let text: String
    public let entityType: NerEntityType
    public let start: Int
    public let end: Int
    public let confidence: Double
}

private let personIndicators: Set<String> = [
    "mr", "mrs", "ms", "dr", "prof", "sir", "president", "ceo", "director",
    "said", "told", "according", "born", "died", "married", "senator"
]
private let orgIndicators: Set<String> = [
    "inc", "corp", "ltd", "llc", "company", "organization", "foundation",
    "university", "institute", "bank", "group", "association", "commission"
]
private let locIndicators: Set<String> = [
    "city", "state", "country", "river", "mountain", "island", "street",
    "avenue", "boulevard", "county", "province", "district", "republic"
]
private let eventIndicators: Set<String> = [
    "conference", "summit", "festival", "championship", "olympics", "election",
    "ceremony", "tournament", "expo", "convention", "meeting", "war", "battle"
]

public final class NerExtractEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let threshold = config.threshold ?? 0.5
        let text = item.content

        var allEntities: [NerEntity] = []

        // Pattern-based entity extraction
        allEntities.append(contentsOf: findEmailEntities(in: text))
        allEntities.append(contentsOf: findUrlEntities(in: text))
        allEntities.append(contentsOf: findDateEntities(in: text))
        allEntities.append(contentsOf: findMoneyEntities(in: text))
        allEntities.append(contentsOf: findTitleCaseEntities(in: text, threshold: threshold))

        // Filter by threshold and deduplicate
        let filtered = allEntities.filter { $0.confidence >= threshold }
        let deduplicated = deduplicateEntities(filtered)

        let avgConfidence: Double = deduplicated.isEmpty ? 0.0 :
            deduplicated.reduce(0.0) { $0 + $1.confidence } / Double(deduplicated.count)

        // Build type counts
        var typeCounts: [String: Int] = [:]
        for entity in deduplicated {
            typeCounts[entity.entityType.rawValue, default: 0] += 1
        }

        let entityDicts: [[String: Any]] = deduplicated.map { e in
            ["text": e.text, "type": e.entityType.rawValue,
             "start": e.start, "end": e.end, "confidence": e.confidence]
        }

        return EnrichmentResult(
            fields: [
                "entities": entityDicts,
                "entity_count": deduplicated.count,
                "entity_type_counts": typeCounts
            ],
            confidence: avgConfidence,
            metadata: [
                "provider": NerExtractProviderID,
                "threshold": threshold,
                "mode": "pattern_based"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let textSchemas = ["text", "article", "document", "content", "post", "message", "note"]
        let nameLower = schema.name.lowercased()
        return textSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let charCount = item.content.count
        let durationMs = max(10, charCount / 1000)
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: durationMs)
    }

    // MARK: - Email Detection

    private func findEmailEntities(in text: String) -> [NerEntity] {
        let pattern = #"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"#
        return matchPattern(pattern, in: text, type: .EMAIL, confidence: 0.98)
    }

    // MARK: - URL Detection

    private func findUrlEntities(in text: String) -> [NerEntity] {
        let pattern = #"https?://[^\s<>\"']+"#
        return matchPattern(pattern, in: text, type: .URL, confidence: 0.97)
    }

    // MARK: - Date Detection

    private func findDateEntities(in text: String) -> [NerEntity] {
        var entities: [NerEntity] = []
        // Month DD, YYYY pattern
        let monthPattern = #"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}"#
        entities.append(contentsOf: matchPattern(monthPattern, in: text, type: .DATE, confidence: 0.92))
        // ISO date YYYY-MM-DD
        let isoPattern = #"\d{4}-\d{2}-\d{2}"#
        entities.append(contentsOf: matchPattern(isoPattern, in: text, type: .DATE, confidence: 0.95))
        return entities
    }

    // MARK: - Money Detection

    private func findMoneyEntities(in text: String) -> [NerEntity] {
        let pattern = #"(?:\$|EUR|GBP|USD|JPY)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?(?:million|billion|thousand|M|B|K))?"#
        return matchPattern(pattern, in: text, type: .MONEY, confidence: 0.90)
    }

    // MARK: - Title Case Entity Detection

    private func findTitleCaseEntities(in text: String, threshold: Double) -> [NerEntity] {
        var entities: [NerEntity] = []
        // Match sequences of capitalized words
        let pattern = #"\b[A-Z][a-z]+(?:\s+(?:of|the|and|de|van|von|al|el)\s+|\s+)(?:[A-Z][a-z]+\s*){0,4}"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let nsText = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))

        for match in matches {
            let matchText = nsText.substring(with: match.range).trimmingCharacters(in: .whitespaces)
            let words = matchText.split(separator: " ")
            guard words.count >= 2 else { continue }

            let start = match.range.location
            let end = match.range.location + match.range.length
            let contextWords = getContextWords(text: text, start: start, end: end, window: 100)
            let entityWords = matchText.lowercased().split(separator: " ").map(String.init)

            // Classify based on context clues
            let orgSuffixes = ["inc", "corp", "ltd", "llc", "co"]
            let lastWord = entityWords.last ?? ""

            var classification: (NerEntityType, Double)?

            if orgSuffixes.contains(lastWord) {
                classification = (.ORG, 0.92)
            } else if contextWords.contains(where: { orgIndicators.contains($0) }) ||
                      entityWords.contains(where: { orgIndicators.contains($0) }) {
                classification = (.ORG, 0.78)
            } else if contextWords.contains(where: { personIndicators.contains($0) }) {
                classification = (.PERSON, 0.82)
            } else if entityWords.count >= 2 && entityWords.count <= 3 {
                classification = (.PERSON, 0.65)
            } else if contextWords.contains(where: { locIndicators.contains($0) }) ||
                      entityWords.contains(where: { locIndicators.contains($0) }) {
                classification = (.LOC, 0.75)
            } else if contextWords.contains(where: { eventIndicators.contains($0) }) ||
                      entityWords.contains(where: { eventIndicators.contains($0) }) {
                classification = (.EVENT, 0.70)
            }

            if let (entityType, confidence) = classification, confidence >= threshold {
                entities.append(NerEntity(
                    text: matchText, entityType: entityType,
                    start: start, end: end, confidence: confidence
                ))
            }
        }
        return entities
    }

    // MARK: - Helpers

    private func matchPattern(_ pattern: String, in text: String, type: NerEntityType, confidence: Double) -> [NerEntity] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let nsText = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        return matches.map { match in
            NerEntity(
                text: nsText.substring(with: match.range),
                entityType: type,
                start: match.range.location,
                end: match.range.location + match.range.length,
                confidence: confidence
            )
        }
    }

    private func getContextWords(text: String, start: Int, end: Int, window: Int) -> [String] {
        let nsText = text as NSString
        let beforeStart = max(0, start - window)
        let afterEnd = min(nsText.length, end + window)
        let before = nsText.substring(with: NSRange(location: beforeStart, length: start - beforeStart))
        let after = nsText.substring(with: NSRange(location: end, length: afterEnd - end))
        return (before + " " + after).lowercased()
            .components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
    }

    private func deduplicateEntities(_ entities: [NerEntity]) -> [NerEntity] {
        let sorted = entities.sorted { $0.confidence > $1.confidence }
        var result: [NerEntity] = []
        for entity in sorted {
            let overlaps = result.contains { e in entity.start < e.end && entity.end > e.start }
            if !overlaps { result.append(entity) }
        }
        return result.sorted { $0.start < $1.start }
    }
}
