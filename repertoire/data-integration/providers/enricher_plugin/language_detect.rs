// COPF Data Integration Kit - Language detection enricher provider
// Uses character n-gram frequency profiles compared against language profiles.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "language_detect";
pub const PLUGIN_TYPE: &str = "enricher_plugin";

#[derive(Debug, Clone)]
pub struct ContentItem {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnricherConfig {
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub threshold: Option<f64>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnrichmentResult {
    pub fields: HashMap<String, serde_json::Value>,
    pub confidence: f64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SchemaRef {
    pub name: String,
    pub fields: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct CostEstimate {
    pub tokens: Option<u64>,
    pub api_calls: Option<u64>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug)]
pub enum EnricherError {
    ConfigError(String),
}

struct LanguageProfile {
    code: &'static str,
    script: &'static str,
    trigrams: Vec<&'static str>,
}

fn build_language_profiles() -> Vec<LanguageProfile> {
    vec![
        LanguageProfile {
            code: "en", script: "Latin",
            trigrams: vec![
                "the", "and", "ing", "tion", "her", "hat", "tha", "ere", "for", "ent",
                "ion", "ter", "was", "you", "ith", "ver", "all", "wit", "thi", "ate",
                "his", "ght", "rig", "are", "not", "ons", "ess", "com", "pro", "hou",
            ],
        },
        LanguageProfile {
            code: "es", script: "Latin",
            trigrams: vec![
                "que", "ent", "aci", "ado", "est", "las", "los", "con", "del", "par",
                "res", "nte", "era", "cia", "com", "una", "ara", "ien", "sta", "mos",
                "tos", "ido", "tra", "tad", "nes", "ues", "des", "ero", "ici", "las",
            ],
        },
        LanguageProfile {
            code: "fr", script: "Latin",
            trigrams: vec![
                "les", "ent", "ion", "que", "des", "ait", "est", "ous", "ire", "tio",
                "ans", "par", "con", "ons", "our", "com", "men", "pas", "eur", "dan",
                "ais", "une", "ell", "ien", "eme", "uit", "ant", "nte", "ter", "ait",
            ],
        },
        LanguageProfile {
            code: "de", script: "Latin",
            trigrams: vec![
                "ein", "ich", "der", "die", "und", "den", "sch", "ung", "che", "ine",
                "gen", "ver", "ber", "ten", "ter", "hen", "eit", "auf", "ent", "ges",
                "ach", "lic", "ier", "ste", "ren", "nde", "ers", "ige", "erd", "ann",
            ],
        },
        LanguageProfile {
            code: "pt", script: "Latin",
            trigrams: vec![
                "que", "ent", "ade", "est", "nte", "com", "par", "res", "ido", "ais",
                "dos", "mos", "uma", "men", "sta", "tos", "tra", "era", "ado", "ica",
                "oss", "con", "por", "ria", "ame", "ura", "tem", "ado", "ais", "nos",
            ],
        },
        LanguageProfile {
            code: "it", script: "Latin",
            trigrams: vec![
                "che", "ell", "ion", "ent", "con", "per", "ato", "zia", "tti", "nte",
                "eri", "sta", "del", "ita", "are", "gli", "tto", "ess", "ano", "lia",
                "ali", "ame", "oni", "com", "ino", "ore", "ona", "est", "ato", "non",
            ],
        },
        LanguageProfile {
            code: "ru", script: "Cyrillic",
            trigrams: vec![
                "ого", "ени", "ста", "ать", "ние", "про", "что", "ест", "ова", "ных",
                "ком", "нов", "ска", "ные", "ель", "раз", "все", "при", "пер", "ори",
            ],
        },
        LanguageProfile {
            code: "ja", script: "CJK",
            trigrams: vec!["の", "に", "は", "を", "た", "が", "で", "て", "と", "し"],
        },
        LanguageProfile {
            code: "zh", script: "CJK",
            trigrams: vec!["的", "了", "在", "是", "我", "不", "人", "有", "这", "他"],
        },
        LanguageProfile {
            code: "ko", script: "Hangul",
            trigrams: vec!["이", "의", "는", "을", "에", "가", "한", "하", "다", "로"],
        },
        LanguageProfile {
            code: "ar", script: "Arabic",
            trigrams: vec!["ال", "في", "من", "على", "ان", "ما", "هذ", "كا", "وا", "لا"],
        },
    ]
}

fn extract_ngrams(text: &str, n: usize) -> HashMap<String, f64> {
    let mut ngrams: HashMap<String, f64> = HashMap::new();
    let lower = text.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();

    for window in chars.windows(n) {
        let ngram: String = window.iter().collect();
        let trimmed = ngram.trim().to_string();
        if !trimmed.is_empty() {
            *ngrams.entry(trimmed).or_insert(0.0) += 1.0;
        }
    }

    let total: f64 = ngrams.values().sum();
    if total > 0.0 {
        for val in ngrams.values_mut() {
            *val /= total;
        }
    }
    ngrams
}

fn detect_script(text: &str) -> &'static str {
    let mut latin = 0u32;
    let mut cyrillic = 0u32;
    let mut cjk = 0u32;
    let mut hangul = 0u32;
    let mut arabic = 0u32;
    let mut devanagari = 0u32;

    for ch in text.chars() {
        let cp = ch as u32;
        if (0x0041..=0x007A).contains(&cp) || (0x00C0..=0x024F).contains(&cp) { latin += 1; }
        else if (0x0400..=0x04FF).contains(&cp) { cyrillic += 1; }
        else if (0x3040..=0x9FFF).contains(&cp) { cjk += 1; }
        else if (0xAC00..=0xD7AF).contains(&cp) { hangul += 1; }
        else if (0x0600..=0x06FF).contains(&cp) { arabic += 1; }
        else if (0x0900..=0x097F).contains(&cp) { devanagari += 1; }
    }

    let counts = [
        (latin, "Latin"), (cyrillic, "Cyrillic"), (cjk, "CJK"),
        (hangul, "Hangul"), (arabic, "Arabic"), (devanagari, "Devanagari"),
    ];
    counts.iter().max_by_key(|(c, _)| *c).map(|(_, s)| *s).unwrap_or("Latin")
}

fn compute_profile_distance(text_ngrams: &HashMap<String, f64>, profile_trigrams: &[&str]) -> f64 {
    let mut score = 0.0;
    let profile_len = profile_trigrams.len() as f64;

    for trigram in profile_trigrams {
        if let Some(&freq) = text_ngrams.get(*trigram) {
            score += freq * profile_len;
        }
    }

    // Also measure overlap of top text ngrams with profile
    let mut sorted: Vec<(&String, &f64)> = text_ngrams.iter().collect();
    sorted.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

    for (ngram, _) in sorted.iter().take(50) {
        if profile_trigrams.contains(&ngram.as_str()) {
            score += 1.0;
        }
    }

    score
}

pub struct LanguageDetectEnricherProvider;

impl LanguageDetectEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let profiles = build_language_profiles();
        let text = &item.content;

        if text.trim().len() < 10 {
            let mut fields = HashMap::new();
            fields.insert("language".to_string(), serde_json::json!("und"));
            fields.insert("confidence".to_string(), serde_json::json!(0));
            fields.insert("script".to_string(), serde_json::json!("Unknown"));
            return Ok(EnrichmentResult { fields, confidence: 0.0, metadata: None });
        }

        let opts = config.options.as_ref();
        let candidates: Vec<String> = opts.and_then(|o| o.get("candidateLanguages"))
            .and_then(|c| c.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_else(|| profiles.iter().map(|p| p.code.to_string()).collect());

        let script = detect_script(text);
        let text_trigrams = extract_ngrams(text, 3);
        let text_bigrams = extract_ngrams(text, 2);

        let mut scores: Vec<(String, f64, String)> = Vec::new();

        for profile in &profiles {
            if !candidates.contains(&profile.code.to_string()) { continue; }
            if profile.script != script && script != "Latin" { continue; }

            let trigram_score = compute_profile_distance(&text_trigrams, &profile.trigrams);
            let bigram_trigrams: Vec<&str> = profile.trigrams.iter()
                .filter(|t| t.chars().count() == 2).copied().collect();
            let bigram_score = compute_profile_distance(&text_bigrams, &bigram_trigrams);

            let mut total = trigram_score + bigram_score * 0.5;
            if profile.script != script { total *= 0.1; }

            scores.push((profile.code.to_string(), total, profile.script.to_string()));
        }

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let best = scores.first().cloned().unwrap_or(("und".to_string(), 0.0, "Unknown".to_string()));
        let second = scores.get(1);

        let mut confidence = 0.0;
        if best.1 > 0.0 {
            let margin = second.map(|s| (best.1 - s.1) / best.1).unwrap_or(1.0);
            confidence = (0.5 + margin * 0.5).min(0.99);
            confidence = (confidence * (text.len() as f64 / 200.0).min(1.0)).min(0.99);
        }

        let alternatives: Vec<serde_json::Value> = scores.iter().skip(1).take(3).map(|(code, sc, _)| {
            serde_json::json!({"language": code, "confidence": (sc / best.1.max(1.0) * 1000.0).round() / 1000.0})
        }).collect();

        let mut fields = HashMap::new();
        fields.insert("language".to_string(), serde_json::json!(best.0));
        fields.insert("confidence".to_string(), serde_json::json!((confidence * 1000.0).round() / 1000.0));
        fields.insert("script".to_string(), serde_json::json!(script));
        fields.insert("alternatives".to_string(), serde_json::json!(alternatives));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("candidateCount".to_string(), serde_json::json!(candidates.len()));
        metadata.insert("textLength".to_string(), serde_json::json!(text.len()));
        metadata.insert("method".to_string(), serde_json::json!("ngram_frequency"));

        Ok(EnrichmentResult {
            fields,
            confidence,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let applicable = ["text", "article", "document", "content", "post", "message", "page"];
        let name_lower = schema.name.to_lowercase();
        applicable.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let char_count = item.content.len() as u64;
        CostEstimate {
            tokens: None,
            api_calls: Some(0),
            duration_ms: Some((char_count / 5000).max(5)),
        }
    }
}
