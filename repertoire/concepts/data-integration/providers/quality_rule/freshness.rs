// Quality Rule Provider: Freshness Validation
// Ensures data timestamps are within an acceptable recency window.
// Dimension: timeliness

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub const PROVIDER_ID: &str = "freshness";
pub const PLUGIN_TYPE: &str = "quality_rule";

#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub field_type: String,
    pub required: Option<bool>,
    pub constraints: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct RuleConfig {
    pub options: Option<HashMap<String, serde_json::Value>>,
    pub threshold: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity { Error, Warning, Info }

#[derive(Debug, Clone)]
pub struct RuleResult {
    pub valid: bool,
    pub message: Option<String>,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq)]
pub enum QualityDimension {
    Completeness, Uniqueness, Validity, Consistency, Timeliness, Accuracy,
}

pub struct FreshnessQualityProvider;

impl FreshnessQualityProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        let timestamp_field = config.options.as_ref()
            .and_then(|o| o.get("timestampField"))
            .and_then(|v| v.as_str())
            .unwrap_or(&field.name);

        let raw_timestamp = if timestamp_field == field.name {
            value
        } else {
            match record.get(timestamp_field) {
                Some(v) => v,
                None => return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Freshness check for '{}': timestamp field '{}' is missing.",
                        field.name, timestamp_field
                    )),
                    severity: Severity::Warning,
                },
            }
        };

        if raw_timestamp.is_null() {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Freshness check for '{}': timestamp field '{}' is missing.",
                    field.name, timestamp_field
                )),
                severity: Severity::Warning,
            };
        }

        let timestamp_ms = match self.parse_timestamp(raw_timestamp) {
            Some(ts) => ts,
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Freshness check for '{}': cannot parse timestamp value.",
                    field.name
                )),
                severity: Severity::Error,
            },
        };

        let max_age_ms = match self.parse_max_age(
            config.options.as_ref().and_then(|o| o.get("maxAge"))
        ) {
            Some(ms) => ms,
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Freshness rule for '{}' is misconfigured: invalid or missing maxAge.",
                    field.name
                )),
                severity: Severity::Warning,
            },
        };

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let age_ms = now_ms.saturating_sub(timestamp_ms);

        if age_ms > max_age_ms {
            let age_hours = age_ms as f64 / 3_600_000.0;
            let max_age_hours = max_age_ms as f64 / 3_600_000.0;
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' data is stale: age is {:.1}h, maximum allowed is {:.1}h.",
                    field.name, age_hours, max_age_hours
                )),
                severity: Severity::Error,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Info }
    }

    fn parse_timestamp(&self, value: &serde_json::Value) -> Option<u64> {
        if let Some(n) = value.as_u64() {
            // Assume milliseconds if large enough, otherwise seconds
            return Some(if n > 1_000_000_000_000 { n } else { n * 1000 });
        }
        if let Some(n) = value.as_f64() {
            let ms = if n > 1_000_000_000_000.0 { n as u64 } else { (n * 1000.0) as u64 };
            return Some(ms);
        }
        // ISO 8601 date string is not parsed here in pure Rust without chrono;
        // callers should provide epoch timestamps for Rust usage.
        None
    }

    fn parse_max_age(&self, max_age: Option<&serde_json::Value>) -> Option<u64> {
        let val = max_age?;
        if let Some(n) = val.as_u64() {
            return Some(n * 1000); // Assume seconds
        }
        if let Some(n) = val.as_f64() {
            return Some((n * 1000.0) as u64);
        }
        if let Some(s) = val.as_str() {
            return self.parse_duration_string(s);
        }
        None
    }

    fn parse_duration_string(&self, s: &str) -> Option<u64> {
        let s = s.trim();
        let (num_part, unit_part) = s.char_indices()
            .find(|(_, c)| c.is_alphabetic())
            .map(|(i, _)| (&s[..i], &s[i..]))
            .unwrap_or((s, "s"));

        let amount: f64 = num_part.trim().parse().ok()?;
        let unit = unit_part.trim().to_lowercase();

        let ms = if unit.starts_with('s') {
            amount * 1000.0
        } else if unit.starts_with("mi") || unit == "m" {
            amount * 60_000.0
        } else if unit.starts_with('h') {
            amount * 3_600_000.0
        } else if unit.starts_with('d') {
            amount * 86_400_000.0
        } else {
            return None;
        };

        Some(ms as u64)
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        let date_types = ["date", "datetime", "timestamp"];
        date_types.contains(&field.field_type.to_lowercase().as_str())
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Timeliness
    }
}

impl Default for FreshnessQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
