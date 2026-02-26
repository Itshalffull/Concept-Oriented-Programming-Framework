// Date/time pattern detector — finds ISO 8601, US, European, natural language dates,
// times, and durations in text content

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "date_detector";
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

const MONTHS: [&str; 12] = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december"
];
const MONTH_ABBR: [&str; 12] = [
    "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"
];

fn month_index(s: &str) -> Option<usize> {
    let lower = s.to_lowercase();
    MONTHS.iter().position(|m| *m == lower)
        .or_else(|| MONTH_ABBR.iter().position(|m| *m == lower))
}

pub struct DateDetectorProvider;

impl DateDetectorProvider {
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

        // ISO 8601 full datetime
        let iso_full = Regex::new(r"\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in iso_full.captures_iter(content) {
            let evidence = cap[0].to_string();
            if 0.98 >= threshold && seen.insert(format!("date:{}", evidence)) {
                detections.push(Detection {
                    field: "date".into(), value: Value::String(cap[1].into()),
                    r#type: "datetime".into(), confidence: 0.98, evidence,
                });
            }
        }

        // ISO 8601 date only
        let iso_date = Regex::new(r"\b(\d{4})-(\d{2})-(\d{2})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in iso_date.captures_iter(content) {
            let evidence = cap[0].to_string();
            if 0.95 >= threshold && seen.insert(format!("date:{}", evidence)) {
                detections.push(Detection {
                    field: "date".into(), value: Value::String(evidence.clone()),
                    r#type: "datetime".into(), confidence: 0.95, evidence,
                });
            }
        }

        // US format: MM/DD/YYYY
        let us_date = Regex::new(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in us_date.captures_iter(content) {
            let evidence = cap[0].to_string();
            let parsed = format!("{}-{:02}-{:02}", &cap[3], cap[1].parse::<u32>().unwrap_or(0), cap[2].parse::<u32>().unwrap_or(0));
            if 0.80 >= threshold && seen.insert(format!("date:{}", evidence)) {
                detections.push(Detection {
                    field: "date".into(), value: Value::String(parsed),
                    r#type: "datetime".into(), confidence: 0.80, evidence,
                });
            }
        }

        // European format: DD.MM.YYYY
        let eu_date = Regex::new(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in eu_date.captures_iter(content) {
            let evidence = cap[0].to_string();
            let parsed = format!("{}-{:02}-{:02}", &cap[3], cap[2].parse::<u32>().unwrap_or(0), cap[1].parse::<u32>().unwrap_or(0));
            if 0.80 >= threshold && seen.insert(format!("date:{}", evidence)) {
                detections.push(Detection {
                    field: "date".into(), value: Value::String(parsed),
                    r#type: "datetime".into(), confidence: 0.80, evidence,
                });
            }
        }

        // Natural language: March 15, 2026
        let natural = Regex::new(r"(?i)\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in natural.captures_iter(content) {
            let evidence = cap[0].to_string();
            if let Some(mi) = month_index(&cap[1]) {
                let parsed = format!("{}-{:02}-{:02}", &cap[3], mi + 1, cap[2].parse::<u32>().unwrap_or(0));
                if 0.90 >= threshold && seen.insert(format!("date:{}", evidence)) {
                    detections.push(Detection {
                        field: "date".into(), value: Value::String(parsed),
                        r#type: "datetime".into(), confidence: 0.90, evidence,
                    });
                }
            }
        }

        // Relative dates
        let relative = Regex::new(r"(?i)\b(last|next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in relative.captures_iter(content) {
            let evidence = cap[0].to_string();
            if 0.70 >= threshold && seen.insert(format!("date:{}", evidence)) {
                let mut val = serde_json::Map::new();
                val.insert("relative".into(), Value::String(cap[1].to_lowercase()));
                val.insert("unit".into(), Value::String(cap[2].to_lowercase()));
                detections.push(Detection {
                    field: "date".into(), value: Value::Object(val),
                    r#type: "relative_datetime".into(), confidence: 0.70, evidence,
                });
            }
        }

        // Time patterns: 3:30 PM, 15:30
        let time_re = Regex::new(r"\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in time_re.captures_iter(content) {
            let evidence = cap[0].to_string();
            let mut hours: u32 = cap[1].parse().unwrap_or(0);
            let minutes = &cap[2];
            let seconds = cap.get(3).map_or("00", |m| m.as_str());
            if let Some(m) = cap.get(4) {
                match m.as_str().to_uppercase().as_str() {
                    "PM" if hours < 12 => hours += 12,
                    "AM" if hours == 12 => hours = 0,
                    _ => {}
                }
            }
            let parsed = format!("{:02}:{}:{}", hours, minutes, seconds);
            if 0.85 >= threshold && seen.insert(format!("time:{}", evidence)) {
                detections.push(Detection {
                    field: "time".into(), value: Value::String(parsed),
                    r#type: "datetime".into(), confidence: 0.85, evidence,
                });
            }
        }

        // Durations: "2 hours", "3 days"
        let duration = Regex::new(r"(?i)\b(\d+)\s+(second|minute|hour|day|week|month|year)s?\b")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        for cap in duration.captures_iter(content) {
            let evidence = cap[0].to_string();
            if 0.85 >= threshold && seen.insert(format!("duration:{}", evidence)) {
                let mut val = serde_json::Map::new();
                val.insert("amount".into(), Value::Number(cap[1].parse::<u64>().unwrap_or(0).into()));
                val.insert("unit".into(), Value::String(cap[2].to_lowercase()));
                detections.push(Detection {
                    field: "duration".into(), value: Value::Object(val),
                    r#type: "duration".into(), confidence: 0.85, evidence,
                });
            }
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown" | "application/json")
    }
}
