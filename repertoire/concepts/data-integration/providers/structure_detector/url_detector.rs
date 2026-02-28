// URL/email/phone detector — finds URLs, email addresses, and phone numbers
// Validates URL structure, normalizes phone numbers to E.164 format

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "url_detector";
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

const DEFAULT_COUNTRY_CODE: &str = "+1";

fn normalize_phone_to_e164(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
    if digits.starts_with('+') {
        return digits;
    }
    if digits.len() == 10 {
        return format!("{}{}", DEFAULT_COUNTRY_CODE, digits);
    }
    if digits.len() == 11 && digits.starts_with('1') {
        return format!("+{}", digits);
    }
    format!("+{}", digits)
}

fn strip_trailing_url_punct(s: &str) -> String {
    s.trim_end_matches(|c: char| matches!(c, '.' | ',' | ';' | ':' | '!' | '?' | ')'))
        .to_string()
}

fn is_valid_url_structure(url: &str) -> bool {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return false;
    }
    let after_scheme = if url.starts_with("https://") { &url[8..] } else { &url[7..] };
    let host = after_scheme.split('/').next().unwrap_or("");
    let host_no_port = host.split(':').next().unwrap_or("");
    host_no_port.contains('.')
        && host_no_port.len() >= 3
        && !host_no_port.starts_with('.')
        && !host_no_port.ends_with('.')
}

pub struct UrlDetectorProvider;

impl UrlDetectorProvider {
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

        // HTTP(S) URLs
        let url_re = Regex::new(r"https?://[A-Za-z0-9][-A-Za-z0-9]*(?:\.[A-Za-z0-9][-A-Za-z0-9]*)+(?::\d{1,5})?(?:/[^\s<>\"{}|\\^\[\]`]*)?")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        for cap in url_re.captures_iter(content) {
            let raw = &cap[0];
            let url = strip_trailing_url_punct(raw);
            if !is_valid_url_structure(&url) || !seen.insert(url.clone()) {
                continue;
            }
            let has_path = url.split("://").nth(1).map_or(false, |rest| {
                rest.contains('/') && !rest.ends_with('/')
            });
            let has_query = url.contains('?');
            let confidence = if has_query { 0.98 } else if has_path { 0.95 } else { 0.92 };
            if confidence < threshold { continue; }

            detections.push(Detection {
                field: "url".into(), value: Value::String(url.clone()),
                r#type: "url".into(), confidence, evidence: url,
            });
        }

        // Email addresses
        let email_re = Regex::new(r"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        for cap in email_re.captures_iter(content) {
            let email = cap[1].to_lowercase();
            if !seen.insert(email.clone()) { continue; }
            let domain = email.split('@').nth(1).unwrap_or("");
            if !domain.contains('.') { continue; }
            let tld = domain.rsplit('.').next().unwrap_or("");
            let confidence = if tld.len() >= 2 && tld.len() <= 6 { 0.95 } else { 0.80 };
            if confidence < threshold { continue; }

            detections.push(Detection {
                field: "email".into(), value: Value::String(email),
                r#type: "email".into(), confidence, evidence: cap[0].to_string(),
            });
        }

        // Phone: international +1-234-567-8900
        let phone_intl = Regex::new(r"\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        // Phone: US parenthetical (234) 567-8900
        let phone_paren = Regex::new(r"\(\d{3}\)\s*\d{3}[-.\s]?\d{4}")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        // Phone: US standard 234-567-8900
        let phone_std = Regex::new(r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        let phone_patterns: Vec<(&Regex, f64)> = vec![
            (&phone_intl, 0.90), (&phone_paren, 0.88), (&phone_std, 0.82),
        ];

        for (re, confidence) in phone_patterns {
            if confidence < threshold { continue; }
            for cap in re.captures_iter(content) {
                let raw = cap[0].to_string();
                let normalized = normalize_phone_to_e164(&raw);
                let digits: String = normalized.chars().filter(|c| c.is_ascii_digit()).collect();
                if digits.len() < 7 || digits.len() > 15 { continue; }
                let key = format!("phone:{}", digits);
                if !seen.insert(key) { continue; }

                detections.push(Detection {
                    field: "phone".into(), value: Value::String(normalized),
                    r#type: "phone".into(), confidence, evidence: raw,
                });
            }
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown" | "text/csv" | "application/json")
    }
}
