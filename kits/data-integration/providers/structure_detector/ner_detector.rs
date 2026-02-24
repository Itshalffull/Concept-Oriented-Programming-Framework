// Named entity recognition detector — rule-based NER using capitalization patterns,
// known location lists, date patterns, and context heuristics

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "ner_detector";
pub const PLUGIN_TYPE: &str = "structure_detector";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectorConfig {
    pub options: Option<HashMap<String, Value>>,
    pub confidence_threshold: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    pub field: String,
    pub value: Value,
    pub r#type: String,
    pub confidence: f64,
    pub evidence: String,
}

#[derive(Debug)]
pub enum DetectorError {
    ParseError(String),
    RegexError(String),
}

impl std::fmt::Display for DetectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectorError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DetectorError::RegexError(msg) => write!(f, "Regex error: {}", msg),
        }
    }
}

fn is_person_prefix(word: &str) -> bool {
    let w = word.to_lowercase().trim_end_matches('.').to_string();
    matches!(w.as_str(),
        "mr" | "mrs" | "ms" | "dr" | "prof" | "sir" | "madam" |
        "president" | "ceo" | "cto" | "director" | "senator" |
        "governor" | "judge" | "captain" | "general"
    )
}

fn is_org_suffix(word: &str) -> bool {
    let w = word.to_lowercase();
    matches!(w.as_str(),
        "inc" | "corp" | "ltd" | "llc" | "co" | "company" | "corporation" |
        "group" | "foundation" | "institute" | "university" | "association" |
        "organization" | "bank" | "hospital" | "agency" | "department" | "committee"
    )
}

fn is_known_location(text: &str) -> bool {
    let lower = text.to_lowercase();
    matches!(lower.as_str(),
        "new york" | "los angeles" | "chicago" | "london" | "paris" | "tokyo" |
        "berlin" | "sydney" | "toronto" | "san francisco" | "washington" | "boston" |
        "seattle" | "amsterdam" | "beijing" | "shanghai" | "mumbai" | "dubai" |
        "singapore" | "california" | "texas" | "florida" | "europe" | "asia" |
        "africa" | "america" | "united states" | "united kingdom" | "canada" |
        "australia" | "germany" | "france" | "japan" | "china" | "india" |
        "brazil" | "mexico" | "russia"
    )
}

fn is_location_context(word: &str) -> bool {
    matches!(word,
        "in" | "at" | "from" | "near" | "to" | "across" | "throughout" |
        "between" | "around" | "city" | "state" | "country" | "region" |
        "province" | "county"
    )
}

fn is_person_context(word: &str) -> bool {
    matches!(word,
        "said" | "says" | "told" | "asked" | "wrote" | "met" | "called" |
        "named" | "according" | "by" | "with" | "interview"
    )
}

pub struct NerDetectorProvider;

impl NerDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let mut detections = Vec::new();
        let mut seen = HashSet::new();

        // Capitalized word sequences for PERSON/ORG/LOC
        let caps_re = Regex::new(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        for cap in caps_re.captures_iter(content) {
            let span = &cap[1];
            let start = cap.get(1).unwrap().start();
            let end = cap.get(1).unwrap().end();
            let words: Vec<&str> = span.split_whitespace().collect();
            if words.is_empty() { continue; }

            // Context: word before
            let before_start = start.saturating_sub(30);
            let before_text = &content[before_start..start];
            let word_before = before_text.split_whitespace().last()
                .unwrap_or("").to_lowercase();

            // Context: word after
            let after_end = (end + 30).min(content.len());
            let after_text = &content[end..after_end];
            let word_after = after_text.split_whitespace().next()
                .unwrap_or("").to_lowercase();

            let (entity_type, confidence) = if is_person_prefix(&word_before) {
                ("PERSON", 0.92)
            } else if is_person_context(&word_after) || is_person_context(&word_before) {
                ("PERSON", 0.78)
            } else if is_known_location(span) {
                ("LOC", 0.90)
            } else if is_location_context(&word_before) {
                ("LOC", 0.75)
            } else if is_org_suffix(&words[words.len() - 1].to_lowercase()) {
                ("ORG", 0.88)
            } else if words.len() >= 2 && words.len() <= 3 {
                ("PERSON", 0.60)
            } else {
                continue;
            };

            if confidence < threshold { continue; }

            let key = format!("{}:{}", entity_type, span.to_lowercase());
            if !seen.insert(key) { continue; }

            let mut val = serde_json::Map::new();
            val.insert("text".into(), Value::String(span.to_string()));
            val.insert("start".into(), Value::Number(start.into()));
            val.insert("end".into(), Value::Number(end.into()));

            detections.push(Detection {
                field: format!("entity_{}", entity_type.to_lowercase()),
                value: Value::Object(val),
                r#type: entity_type.to_string(),
                confidence,
                evidence: span.to_string(),
            });
        }

        // CONTACT entities (email)
        let email_re = Regex::new(r"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        for cap in email_re.captures_iter(content) {
            let email = cap[1].to_lowercase();
            let key = format!("CONTACT:{}", email);
            if !seen.insert(key) { continue; }
            let start = cap.get(1).unwrap().start();
            let end = cap.get(1).unwrap().end();

            let mut val = serde_json::Map::new();
            val.insert("text".into(), Value::String(email.clone()));
            val.insert("start".into(), Value::Number(start.into()));
            val.insert("end".into(), Value::Number(end.into()));

            detections.push(Detection {
                field: "entity_contact".into(),
                value: Value::Object(val),
                r#type: "CONTACT".into(),
                confidence: 0.95,
                evidence: email,
            });
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown")
    }
}
