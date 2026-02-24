// Quality Rule Provider: Enum Check Validation
// Validates that field values belong to a set of allowed values.
// Dimension: validity

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "enum_check";
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

pub struct EnumCheckQualityProvider;

impl EnumCheckQualityProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        if value.is_null() {
            return RuleResult { valid: true, message: None, severity: Severity::Warning };
        }

        let allowed_values = match config.options.as_ref()
            .and_then(|o| o.get("values"))
            .and_then(|v| v.as_array())
        {
            Some(arr) if !arr.is_empty() => arr,
            _ => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Enum check for field '{}' is misconfigured: no allowed values provided.",
                    field.name
                )),
                severity: Severity::Warning,
            },
        };

        let case_sensitive = config.options.as_ref()
            .and_then(|o| o.get("caseSensitive"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let string_value = match value.as_str() {
            Some(s) => s.to_string(),
            None => value.to_string().trim_matches('"').to_string(),
        };

        let is_allowed = if case_sensitive {
            allowed_values.iter().any(|allowed| {
                match allowed.as_str() {
                    Some(s) => s == string_value,
                    None => allowed.to_string().trim_matches('"') == string_value,
                }
            })
        } else {
            let lower_value = string_value.to_lowercase();
            allowed_values.iter().any(|allowed| {
                let allowed_str = match allowed.as_str() {
                    Some(s) => s.to_string(),
                    None => allowed.to_string().trim_matches('"').to_string(),
                };
                allowed_str.to_lowercase() == lower_value
            })
        };

        if !is_allowed {
            let allowed_list: Vec<String> = allowed_values.iter()
                .map(|v| match v.as_str() {
                    Some(s) => s.to_string(),
                    None => v.to_string(),
                })
                .collect();
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' value '{}' is not in the allowed set [{}].",
                    field.name, string_value, allowed_list.join(", ")
                )),
                severity: Severity::Error,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    pub fn applies_to(&self, _field: &FieldDef) -> bool {
        true
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Validity
    }
}

impl Default for EnumCheckQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
