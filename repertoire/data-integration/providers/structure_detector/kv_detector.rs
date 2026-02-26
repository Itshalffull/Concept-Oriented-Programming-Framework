// Key-value detector — finds "Key: Value", "Key = Value", "Key -> Value" patterns
// Infers value types: numbers, dates, booleans, URLs, plain strings

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "kv_detector";
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

fn infer_value_type(raw: &str) -> (Value, &'static str) {
    let trimmed = raw.trim();

    // Boolean
    let lower = trimmed.to_lowercase();
    if matches!(lower.as_str(), "true" | "yes" | "on") {
        return (Value::Bool(true), "boolean");
    }
    if matches!(lower.as_str(), "false" | "no" | "off") {
        return (Value::Bool(false), "boolean");
    }

    // Integer
    if let Ok(n) = trimmed.parse::<i64>() {
        if trimmed.len() <= 15 {
            return (Value::Number(n.into()), "number");
        }
    }

    // Float
    if trimmed.contains('.') {
        if let Ok(f) = trimmed.parse::<f64>() {
            if let Some(n) = serde_json::Number::from_f64(f) {
                return (Value::Number(n), "number");
            }
        }
    }

    // ISO date
    let date_re = Regex::new(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?").unwrap();
    if date_re.is_match(trimmed) {
        return (Value::String(trimmed.to_string()), "date");
    }

    // URL
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return (Value::String(trimmed.to_string()), "url");
    }

    // Email
    let email_re = Regex::new(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$").unwrap();
    if email_re.is_match(trimmed) {
        return (Value::String(trimmed.to_string()), "email");
    }

    (Value::String(trimmed.to_string()), "string")
}

fn normalize_key(raw: &str) -> String {
    raw.trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_whitespace() { '_' } else { c })
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect()
}

struct KvPattern {
    regex: Regex,
    confidence: f64,
}

pub struct KvDetectorProvider;

impl KvDetectorProvider {
    pub fn new() -> Self { Self }

    fn build_patterns() -> Vec<KvPattern> {
        vec![
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*:\s+(.+)$").unwrap(),
                confidence: 0.92,
            },
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*=\s+(.+)$").unwrap(),
                confidence: 0.88,
            },
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*->\s+(.+)$").unwrap(),
                confidence: 0.85,
            },
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*=>\s+(.+)$").unwrap(),
                confidence: 0.85,
            },
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*\u{2192}\s+(.+)$").unwrap(),
                confidence: 0.85,
            },
            KvPattern {
                regex: Regex::new(r"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s+-\s+(.+)$").unwrap(),
                confidence: 0.70,
            },
        ]
    }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let patterns = Self::build_patterns();
        let mut detections = Vec::new();
        let mut seen = HashSet::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() { continue; }

            for pattern in &patterns {
                if let Some(cap) = pattern.regex.captures(trimmed) {
                    let raw_key = &cap[1];
                    let raw_value = &cap[2];
                    let key = normalize_key(raw_key);

                    if key.is_empty() || key.len() > 50 { continue; }
                    if raw_value.trim().is_empty() { continue; }
                    if !seen.insert(key.clone()) { continue; }

                    let (value, vtype) = infer_value_type(raw_value);
                    let mut confidence = pattern.confidence;
                    if vtype != "string" {
                        confidence = (confidence + 0.05).min(0.99);
                    }
                    if raw_key.trim().len() <= 2 {
                        confidence -= 0.15;
                    }
                    if confidence < threshold { continue; }

                    detections.push(Detection {
                        field: key,
                        value,
                        r#type: vtype.to_string(),
                        confidence,
                        evidence: trimmed.to_string(),
                    });
                    break; // first matching separator wins
                }
            }
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/markdown" | "text/yaml" | "application/x-yaml")
    }
}
