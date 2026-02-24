// Quality Rule Provider: Pattern (Regex) Validation
// Validates that string values match a configured regular expression.
// Dimension: validity

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "pattern";
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

pub struct PatternQualityProvider {
    regex_cache: HashMap<String, regex::Regex>,
}

impl PatternQualityProvider {
    pub fn new() -> Self {
        Self {
            regex_cache: HashMap::new(),
        }
    }

    pub fn validate(
        &mut self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        if value.is_null() {
            return RuleResult { valid: true, message: None, severity: Severity::Warning };
        }

        let pattern_str = match config.options.as_ref()
            .and_then(|o| o.get("pattern"))
            .and_then(|v| v.as_str())
        {
            Some(p) => p.to_string(),
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Pattern rule for field '{}' is misconfigured: no pattern provided.", field.name
                )),
                severity: Severity::Warning,
            },
        };

        let flags = config.options.as_ref()
            .and_then(|o| o.get("flags"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let string_value = match value.as_str() {
            Some(s) => s.to_string(),
            None => value.to_string(),
        };

        // Build regex pattern with flags
        let full_pattern = if flags.contains('i') {
            format!("(?i){}", pattern_str)
        } else {
            pattern_str.clone()
        };

        let cache_key = full_pattern.clone();

        if !self.regex_cache.contains_key(&cache_key) {
            match regex::Regex::new(&full_pattern) {
                Ok(re) => { self.regex_cache.insert(cache_key.clone(), re); }
                Err(err) => return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Pattern rule for field '{}' has an invalid regex: {}",
                        field.name, err
                    )),
                    severity: Severity::Error,
                },
            }
        }

        let re = self.regex_cache.get(&cache_key).unwrap();
        if !re.is_match(&string_value) {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' value '{}' does not match pattern '{}'.",
                    field.name, string_value, pattern_str
                )),
                severity: Severity::Error,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        field.field_type.to_lowercase() == "string"
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Validity
    }
}

impl Default for PatternQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
