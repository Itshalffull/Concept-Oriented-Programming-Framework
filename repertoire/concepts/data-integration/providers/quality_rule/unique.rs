// Quality Rule Provider: Unique Value Validation
// Ensures field values are unique across records of the same type.
// Dimension: uniqueness

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "unique";
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

pub struct UniqueQualityProvider {
    global_index: HashSet<String>,
    scoped_index: HashMap<String, HashSet<String>>,
}

impl UniqueQualityProvider {
    pub fn new() -> Self {
        Self {
            global_index: HashSet::new(),
            scoped_index: HashMap::new(),
        }
    }

    pub fn validate(
        &mut self,
        value: &serde_json::Value,
        field: &FieldDef,
        record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        if value.is_null() {
            return RuleResult { valid: true, message: None, severity: Severity::Error };
        }

        let case_sensitive = config.options.as_ref()
            .and_then(|o| o.get("caseSensitive"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let scope = config.options.as_ref()
            .and_then(|o| o.get("scope"))
            .and_then(|v| v.as_str())
            .unwrap_or("global");

        let raw_value = match value {
            serde_json::Value::String(s) => s.clone(),
            other => other.to_string(),
        };
        let normalized = if case_sensitive {
            raw_value
        } else {
            raw_value.to_lowercase()
        };

        if scope == "per-type" {
            let record_type = record.get("_type")
                .and_then(|v| v.as_str())
                .unwrap_or("__default__")
                .to_string();

            let type_index = self.scoped_index
                .entry(record_type.clone())
                .or_insert_with(HashSet::new);
            let key = format!("{}::{}", field.name, normalized);

            if type_index.contains(&key) {
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' value is not unique within type '{}'.",
                        field.name, record_type
                    )),
                    severity: Severity::Error,
                };
            }
            type_index.insert(key);
        } else {
            let key = format!("{}::{}", field.name, normalized);
            if self.global_index.contains(&key) {
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' value is not unique.",
                        field.name
                    )),
                    severity: Severity::Error,
                };
            }
            self.global_index.insert(key);
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        field.constraints.as_ref()
            .and_then(|c| c.get("unique"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Uniqueness
    }

    pub fn reset(&mut self) {
        self.global_index.clear();
        self.scoped_index.clear();
    }
}

impl Default for UniqueQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
