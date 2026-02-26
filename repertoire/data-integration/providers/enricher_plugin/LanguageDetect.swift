// Clef Data Integration Kit - Language detection enricher provider
// Uses character n-gram frequency profiles compared against language profiles.

import Foundation

public let LanguageDetectProviderID = "language_detect"
public let LanguageDetectPluginType = "enricher_plugin"

private struct LanguageProfile {
    let code: String
    let script: String
    let trigrams: [String]
}

private let languageProfiles: [LanguageProfile] = [
    LanguageProfile(code: "en", script: "Latin", trigrams: [
        "the", "and", "ing", "tion", "her", "hat", "tha", "ere", "for", "ent",
        "ion", "ter", "was", "you", "ith", "ver", "all", "wit", "thi", "ate",
        "his", "ght", "rig", "are", "not", "ons", "ess", "com", "pro", "hou"
    ]),
    LanguageProfile(code: "es", script: "Latin", trigrams: [
        "que", "ent", "aci", "ado", "est", "las", "los", "con", "del", "par",
        "res", "nte", "era", "cia", "com", "una", "ara", "ien", "sta", "mos"
    ]),
    LanguageProfile(code: "fr", script: "Latin", trigrams: [
        "les", "ent", "ion", "que", "des", "ait", "est", "ous", "ire", "tio",
        "ans", "par", "con", "ons", "our", "com", "men", "pas", "eur", "dan"
    ]),
    LanguageProfile(code: "de", script: "Latin", trigrams: [
        "ein", "ich", "der", "die", "und", "den", "sch", "ung", "che", "ine",
        "gen", "ver", "ber", "ten", "ter", "hen", "eit", "auf", "ent", "ges"
    ]),
    LanguageProfile(code: "pt", script: "Latin", trigrams: [
        "que", "ent", "ade", "est", "nte", "com", "par", "res", "ido", "ais",
        "dos", "mos", "uma", "men", "sta", "tos", "tra", "era", "ado", "ica"
    ]),
    LanguageProfile(code: "it", script: "Latin", trigrams: [
        "che", "ell", "ion", "ent", "con", "per", "ato", "zia", "tti", "nte",
        "eri", "sta", "del", "ita", "are", "gli", "tto", "ess", "ano", "lia"
    ]),
    LanguageProfile(code: "ru", script: "Cyrillic", trigrams: [
        "\u{043E}\u{0433}\u{043E}", "\u{0435}\u{043D}\u{0438}", "\u{0441}\u{0442}\u{0430}",
        "\u{0430}\u{0442}\u{044C}", "\u{043D}\u{0438}\u{0435}", "\u{043F}\u{0440}\u{043E}",
        "\u{0447}\u{0442}\u{043E}", "\u{0435}\u{0441}\u{0442}", "\u{043E}\u{0432}\u{0430}", "\u{043D}\u{044B}\u{0445}"
    ]),
    LanguageProfile(code: "ja", script: "CJK", trigrams: [
        "\u{306E}", "\u{306B}", "\u{306F}", "\u{3092}", "\u{305F}",
        "\u{304C}", "\u{3067}", "\u{3066}", "\u{3068}", "\u{3057}"
    ]),
    LanguageProfile(code: "zh", script: "CJK", trigrams: [
        "\u{7684}", "\u{4E86}", "\u{5728}", "\u{662F}", "\u{6211}",
        "\u{4E0D}", "\u{4EBA}", "\u{6709}", "\u{8FD9}", "\u{4ED6}"
    ]),
    LanguageProfile(code: "ko", script: "Hangul", trigrams: [
        "\u{C774}", "\u{C758}", "\u{B294}", "\u{C744}", "\u{C5D0}",
        "\u{AC00}", "\u{D55C}", "\u{D558}", "\u{B2E4}", "\u{B85C}"
    ]),
    LanguageProfile(code: "ar", script: "Arabic", trigrams: [
        "\u{0627}\u{0644}", "\u{0641}\u{064A}", "\u{0645}\u{0646}",
        "\u{0639}\u{0644}\u{0649}", "\u{0627}\u{0646}", "\u{0645}\u{0627}",
        "\u{0647}\u{0630}", "\u{0643}\u{0627}", "\u{0648}\u{0627}", "\u{0644}\u{0627}"
    ])
]

public final class LanguageDetectEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        let text = item.content
        guard text.trimmingCharacters(in: .whitespaces).count >= 10 else {
            return EnrichmentResult(
                fields: ["language": "und", "confidence": 0, "script": "Unknown"],
                confidence: 0.0,
                metadata: ["provider": LanguageDetectProviderID, "reason": "Text too short"]
            )
        }

        let candidates = (config.options?["candidateLanguages"] as? [String])
            ?? languageProfiles.map { $0.code }

        let script = detectScript(text)
        let textTrigrams = extractNgrams(text, n: 3)
        let textBigrams = extractNgrams(text, n: 2)

        var scores: [(code: String, score: Double, script: String)] = []

        for profile in languageProfiles {
            guard candidates.contains(profile.code) else { continue }
            if profile.script != script && script != "Latin" { continue }

            let trigramScore = computeProfileDistance(textNgrams: textTrigrams, profileTrigrams: profile.trigrams)
            let bigramTrigrams = profile.trigrams.filter { $0.count == 2 }
            let bigramScore = computeProfileDistance(textNgrams: textBigrams, profileTrigrams: bigramTrigrams)

            var total = trigramScore + bigramScore * 0.5
            if profile.script != script { total *= 0.1 }

            scores.append((profile.code, total, profile.script))
        }

        scores.sort { $0.score > $1.score }

        let best = scores.first ?? ("und", 0.0, "Unknown")
        let second = scores.count > 1 ? scores[1] : nil

        var confidence = 0.0
        if best.score > 0 {
            let margin = second.map { (best.score - $0.score) / best.score } ?? 1.0
            confidence = min(0.99, 0.5 + margin * 0.5)
            confidence = min(0.99, confidence * min(1.0, Double(text.count) / 200.0))
        }

        let alternatives: [[String: Any]] = scores.dropFirst().prefix(3).map { (code, sc, _) in
            ["language": code, "confidence": (sc / max(best.score, 1.0) * 1000).rounded() / 1000]
        }

        return EnrichmentResult(
            fields: [
                "language": best.code,
                "confidence": (confidence * 1000).rounded() / 1000,
                "script": script,
                "alternatives": alternatives
            ],
            confidence: confidence,
            metadata: [
                "provider": LanguageDetectProviderID,
                "candidateCount": candidates.count,
                "textLength": text.count,
                "method": "ngram_frequency"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let applicable = ["text", "article", "document", "content", "post", "message", "page"]
        let nameLower = schema.name.lowercased()
        return applicable.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        let charCount = item.content.count
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: max(5, charCount / 5000))
    }

    // MARK: - N-gram Analysis

    private func extractNgrams(_ text: String, n: Int) -> [String: Double] {
        var ngrams: [String: Double] = [:]
        let lower = text.lowercased()
        let chars = Array(lower)
        guard chars.count >= n else { return ngrams }

        for i in 0...(chars.count - n) {
            let ngram = String(chars[i..<(i + n)])
            let trimmed = ngram.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                ngrams[trimmed, default: 0.0] += 1.0
            }
        }

        let total = ngrams.values.reduce(0.0, +)
        if total > 0 {
            for (key, val) in ngrams { ngrams[key] = val / total }
        }
        return ngrams
    }

    private func detectScript(_ text: String) -> String {
        var counts: [String: Int] = [
            "Latin": 0, "Cyrillic": 0, "CJK": 0,
            "Hangul": 0, "Arabic": 0, "Devanagari": 0
        ]

        for scalar in text.unicodeScalars {
            let cp = scalar.value
            if (0x0041...0x007A).contains(cp) || (0x00C0...0x024F).contains(cp) { counts["Latin"]! += 1 }
            else if (0x0400...0x04FF).contains(cp) { counts["Cyrillic"]! += 1 }
            else if (0x3040...0x9FFF).contains(cp) { counts["CJK"]! += 1 }
            else if (0xAC00...0xD7AF).contains(cp) { counts["Hangul"]! += 1 }
            else if (0x0600...0x06FF).contains(cp) { counts["Arabic"]! += 1 }
            else if (0x0900...0x097F).contains(cp) { counts["Devanagari"]! += 1 }
        }

        return counts.max(by: { $0.value < $1.value })?.key ?? "Latin"
    }

    private func computeProfileDistance(textNgrams: [String: Double], profileTrigrams: [String]) -> Double {
        var score = 0.0
        let profileLen = Double(profileTrigrams.count)

        for trigram in profileTrigrams {
            if let freq = textNgrams[trigram] {
                score += freq * profileLen
            }
        }

        let sorted = textNgrams.sorted { $0.value > $1.value }.prefix(50)
        let profileSet = Set(profileTrigrams)
        for (ngram, _) in sorted {
            if profileSet.contains(ngram) { score += 1.0 }
        }

        return score
    }
}
