// Tag detector — finds #hashtags and @mentions in text content
// Normalizes CamelCase to kebab-case, deduplicates, strips trailing punctuation

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "tag_detector";
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

fn camel_to_kebab(s: &str) -> String {
    let mut result = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            let prev = s.chars().nth(i - 1).unwrap_or('A');
            if prev.is_lowercase() || prev.is_ascii_digit() {
                result.push('-');
            } else if let Some(next) = s.chars().nth(i + 1) {
                if next.is_lowercase() {
                    result.push('-');
                }
            }
        }
        result.push(ch.to_lowercase().next().unwrap_or(ch));
    }
    result
}

fn strip_trailing_punctuation(s: &str) -> &str {
    s.trim_end_matches(|c: char| matches!(c, '.' | ',' | ';' | ':' | '!' | '?' | ')'))
}

fn normalize_tag(raw: &str) -> String {
    let stripped = strip_trailing_punctuation(raw);
    camel_to_kebab(stripped)
}

pub struct TagDetectorProvider;

impl TagDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let mut detections = Vec::new();

        // Detect hashtags
        let hashtag_re = Regex::new(r"(?:^|\s)#([A-Za-z_]\w{0,138})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        let mut seen_tags = HashSet::new();
        let mut tag_values = Vec::new();

        for cap in hashtag_re.captures_iter(content) {
            let raw = &cap[1];
            let normalized = normalize_tag(raw);
            if normalized.is_empty() || !seen_tags.insert(normalized.clone()) {
                continue;
            }
            let confidence = if normalized.len() >= 3 { 0.90 } else { 0.75 };
            if confidence < threshold { continue; }

            tag_values.push(Value::String(normalized.clone()));
            detections.push(Detection {
                field: "tags".into(),
                value: Value::String(normalized),
                r#type: "hashtag".into(),
                confidence,
                evidence: format!("#{}", raw),
            });
        }

        // Detect mentions
        let mention_re = Regex::new(r"(?:^|\s)@([A-Za-z_]\w{0,38})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        let mut seen_mentions = HashSet::new();
        let mut mention_values = Vec::new();

        for cap in mention_re.captures_iter(content) {
            let raw = &cap[1];
            let normalized = strip_trailing_punctuation(raw).to_lowercase();
            if normalized.is_empty() || !seen_mentions.insert(normalized.clone()) {
                continue;
            }
            let confidence = if normalized.len() >= 2 { 0.90 } else { 0.70 };
            if confidence < threshold { continue; }

            mention_values.push(Value::String(normalized.clone()));
            detections.push(Detection {
                field: "mentions".into(),
                value: Value::String(normalized),
                r#type: "mention".into(),
                confidence,
                evidence: format!("@{}", raw),
            });
        }

        // Aggregate summaries
        if !tag_values.is_empty() {
            detections.push(Detection {
                field: "tags".into(),
                value: Value::Array(tag_values.clone()),
                r#type: "hashtag_list".into(),
                confidence: 0.90,
                evidence: format!("Found {} hashtag(s)", tag_values.len()),
            });
        }
        if !mention_values.is_empty() {
            detections.push(Detection {
                field: "mentions".into(),
                value: Value::Array(mention_values.clone()),
                r#type: "mention_list".into(),
                confidence: 0.90,
                evidence: format!("Found {} mention(s)", mention_values.len()),
            });
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown" | "application/json")
    }
}
