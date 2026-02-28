// Clef Data Integration Kit - Named Entity Recognition enricher provider
// Tokenizes text, applies NER rules (pattern-based for known entity types), returns entity spans.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "ner_extract";
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

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum EntityType {
    PERSON,
    ORG,
    LOC,
    EVENT,
    DATE,
    MONEY,
    EMAIL,
    URL,
    PHONE,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Entity {
    pub text: String,
    pub entity_type: EntityType,
    pub start: usize,
    pub end: usize,
    pub confidence: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    ParseError(String),
}

const PERSON_INDICATORS: &[&str] = &[
    "mr", "mrs", "ms", "dr", "prof", "sir", "president", "ceo", "director",
    "said", "told", "according", "born", "died", "married", "senator",
];
const ORG_INDICATORS: &[&str] = &[
    "inc", "corp", "ltd", "llc", "company", "organization", "foundation",
    "university", "institute", "bank", "group", "association", "commission",
];
const LOC_INDICATORS: &[&str] = &[
    "city", "state", "country", "river", "mountain", "island", "street",
    "avenue", "boulevard", "county", "province", "district", "republic",
];
const EVENT_INDICATORS: &[&str] = &[
    "conference", "summit", "festival", "championship", "olympics", "election",
    "ceremony", "tournament", "expo", "convention", "meeting", "war", "battle",
];

fn find_email_entities(text: &str) -> Vec<Entity> {
    let mut entities = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'@' && i > 0 {
            // Scan backwards for local part
            let mut local_start = i;
            while local_start > 0 {
                let c = bytes[local_start - 1];
                if c.is_ascii_alphanumeric() || b"._%+-".contains(&c) {
                    local_start -= 1;
                } else {
                    break;
                }
            }
            // Scan forwards for domain
            let mut domain_end = i + 1;
            let mut has_dot = false;
            while domain_end < len {
                let c = bytes[domain_end];
                if c.is_ascii_alphanumeric() || c == b'.' || c == b'-' {
                    if c == b'.' { has_dot = true; }
                    domain_end += 1;
                } else {
                    break;
                }
            }
            if has_dot && domain_end > i + 1 && local_start < i {
                entities.push(Entity {
                    text: text[local_start..domain_end].to_string(),
                    entity_type: EntityType::EMAIL,
                    start: local_start,
                    end: domain_end,
                    confidence: 0.98,
                });
            }
        }
        i += 1;
    }
    entities
}

fn find_url_entities(text: &str) -> Vec<Entity> {
    let mut entities = Vec::new();
    let mut search_from = 0;
    while let Some(pos) = text[search_from..].find("http") {
        let abs_pos = search_from + pos;
        let remaining = &text[abs_pos..];
        if remaining.starts_with("http://") || remaining.starts_with("https://") {
            let end = remaining.find(|c: char| c.is_whitespace() || "<>\"'".contains(c))
                .unwrap_or(remaining.len());
            entities.push(Entity {
                text: remaining[..end].to_string(),
                entity_type: EntityType::URL,
                start: abs_pos,
                end: abs_pos + end,
                confidence: 0.97,
            });
            search_from = abs_pos + end;
        } else {
            search_from = abs_pos + 4;
        }
    }
    entities
}

fn find_date_entities(text: &str) -> Vec<Entity> {
    let mut entities = Vec::new();
    let months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ];
    let lower = text.to_lowercase();

    for month in &months {
        let mut pos = 0;
        while let Some(idx) = lower[pos..].find(month) {
            let abs_idx = pos + idx;
            // Look for "Month DD, YYYY" or "Month DD YYYY"
            let after_month = &text[abs_idx + month.len()..];
            let after_trimmed = after_month.trim_start();
            let digits_and_more: String = after_trimmed.chars()
                .take_while(|c| c.is_ascii_digit() || *c == ',' || *c == ' ')
                .collect();
            let numbers: Vec<&str> = digits_and_more.split(|c: char| !c.is_ascii_digit())
                .filter(|s| !s.is_empty())
                .collect();

            if numbers.len() >= 2 {
                let day: u32 = numbers[0].parse().unwrap_or(0);
                let year: u32 = numbers[1].parse().unwrap_or(0);
                if day >= 1 && day <= 31 && year >= 1900 && year <= 2100 {
                    let end_offset = abs_idx + month.len() + digits_and_more.len() + (after_month.len() - after_trimmed.len());
                    entities.push(Entity {
                        text: text[abs_idx..end_offset].trim().to_string(),
                        entity_type: EntityType::DATE,
                        start: abs_idx,
                        end: end_offset,
                        confidence: 0.92,
                    });
                }
            }
            pos = abs_idx + month.len();
        }
    }

    // ISO date pattern: YYYY-MM-DD
    let chars: Vec<char> = text.chars().collect();
    for i in 0..chars.len().saturating_sub(9) {
        if chars[i].is_ascii_digit() && chars[i+4] == '-' && chars[i+7] == '-' {
            let candidate: String = chars[i..i+10].iter().collect();
            if candidate.len() == 10 {
                let parts: Vec<&str> = candidate.split('-').collect();
                if parts.len() == 3 {
                    let y: u32 = parts[0].parse().unwrap_or(0);
                    let m: u32 = parts[1].parse().unwrap_or(0);
                    let d: u32 = parts[2].parse().unwrap_or(0);
                    if y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 {
                        entities.push(Entity {
                            text: candidate,
                            entity_type: EntityType::DATE,
                            start: i,
                            end: i + 10,
                            confidence: 0.95,
                        });
                    }
                }
            }
        }
    }
    entities
}

fn find_title_case_entities(text: &str, threshold: f64) -> Vec<Entity> {
    let mut entities = Vec::new();
    let words: Vec<(usize, &str)> = text.split_whitespace()
        .scan(0usize, |pos, word| {
            let start = text[*pos..].find(word).map(|i| *pos + i).unwrap_or(*pos);
            *pos = start + word.len();
            Some((start, word))
        })
        .collect();

    let mut i = 0;
    while i < words.len() {
        let (start, word) = words[i];
        if word.len() > 1 && word.chars().next().map_or(false, |c| c.is_uppercase())
            && word.chars().skip(1).any(|c| c.is_lowercase()) {
            // Collect consecutive title-case words (allow connectors)
            let connectors = ["of", "the", "and", "de", "van", "von", "al", "el"];
            let mut j = i + 1;
            while j < words.len() {
                let next_word = words[j].1;
                if connectors.contains(&next_word) && j + 1 < words.len() {
                    j += 1;
                    continue;
                }
                if next_word.len() > 1 && next_word.chars().next().map_or(false, |c| c.is_uppercase())
                    && next_word.chars().skip(1).any(|c| c.is_lowercase()) {
                    j += 1;
                } else {
                    break;
                }
            }

            if j > i + 1 || (i > 0 && !text[..start].ends_with(". ")) {
                let end = words[j - 1].0 + words[j - 1].1.len();
                let entity_text = text[start..end].trim().to_string();
                let context = get_context_words(text, start, end, 100);
                let entity_words: Vec<&str> = entity_text.to_lowercase().split_whitespace().collect();

                // Classify based on context
                let last_word = entity_words.last().map(|s| *s).unwrap_or("");
                let org_suffixes = ["inc", "corp", "ltd", "llc", "co"];

                let classification = if org_suffixes.contains(&last_word) {
                    Some((EntityType::ORG, 0.92))
                } else if context.iter().any(|w| ORG_INDICATORS.contains(&w.as_str())) {
                    Some((EntityType::ORG, 0.78))
                } else if context.iter().any(|w| PERSON_INDICATORS.contains(&w.as_str())) {
                    Some((EntityType::PERSON, 0.82))
                } else if entity_words.len() >= 2 && entity_words.len() <= 3 {
                    Some((EntityType::PERSON, 0.65))
                } else if context.iter().any(|w| LOC_INDICATORS.contains(&w.as_str())) {
                    Some((EntityType::LOC, 0.75))
                } else if context.iter().any(|w| EVENT_INDICATORS.contains(&w.as_str())) {
                    Some((EntityType::EVENT, 0.70))
                } else {
                    None
                };

                if let Some((etype, conf)) = classification {
                    if conf >= threshold {
                        entities.push(Entity {
                            text: entity_text,
                            entity_type: etype,
                            start, end,
                            confidence: conf,
                        });
                    }
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    entities
}

fn get_context_words(text: &str, start: usize, end: usize, window: usize) -> Vec<String> {
    let before_start = start.saturating_sub(window);
    let after_end = (end + window).min(text.len());
    let context = format!("{} {}", &text[before_start..start], &text[end..after_end]);
    context.to_lowercase().split_whitespace().map(String::from).collect()
}

fn deduplicate_entities(mut entities: Vec<Entity>) -> Vec<Entity> {
    entities.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
    let mut result = Vec::new();
    for entity in entities {
        let overlaps = result.iter().any(|e: &Entity| entity.start < e.end && entity.end > e.start);
        if !overlaps {
            result.push(entity);
        }
    }
    result.sort_by_key(|e| e.start);
    result
}

pub struct NerExtractEnricherProvider;

impl NerExtractEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let threshold = config.threshold.unwrap_or(0.5);
        let text = &item.content;

        let mut all_entities = Vec::new();
        all_entities.extend(find_email_entities(text));
        all_entities.extend(find_url_entities(text));
        all_entities.extend(find_date_entities(text));
        all_entities.extend(find_title_case_entities(text, threshold));

        let filtered: Vec<Entity> = all_entities.into_iter()
            .filter(|e| e.confidence >= threshold)
            .collect();
        let deduplicated = deduplicate_entities(filtered);

        let avg_conf = if deduplicated.is_empty() {
            0.0
        } else {
            deduplicated.iter().map(|e| e.confidence).sum::<f64>() / deduplicated.len() as f64
        };

        let entity_count = deduplicated.len();
        let mut type_counts = HashMap::new();
        for entity in &deduplicated {
            *type_counts.entry(format!("{:?}", entity.entity_type)).or_insert(0u64) += 1;
        }

        let mut fields = HashMap::new();
        fields.insert("entities".to_string(), serde_json::json!(deduplicated));
        fields.insert("entity_count".to_string(), serde_json::json!(entity_count));
        fields.insert("entity_type_counts".to_string(), serde_json::json!(type_counts));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("threshold".to_string(), serde_json::json!(threshold));
        metadata.insert("mode".to_string(), serde_json::json!("pattern_based"));

        Ok(EnrichmentResult {
            fields,
            confidence: avg_conf,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let text_schemas = ["text", "article", "document", "content", "post", "message", "note"];
        let name_lower = schema.name.to_lowercase();
        text_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let char_count = item.content.len();
        let duration_ms = (char_count / 1000).max(10) as u64;
        CostEstimate {
            tokens: None,
            api_calls: Some(0),
            duration_ms: Some(duration_ms),
        }
    }
}
