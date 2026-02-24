// Quality Rule Provider: Required Field Validation
// Ensures fields marked as required contain non-empty values.
// Dimension: completeness

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "required";
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
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone)]
pub struct RuleResult {
    pub valid: bool,
    pub message: Option<String>,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq)]
pub enum QualityDimension {
    Completeness,
    Uniqueness,
    Validity,
    Consistency,
    Timeliness,
    Accuracy,
}

pub struct RequiredQualityProvider;

impl RequiredQualityProvider {
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
        let treat_whitespace_as_empty = config
            .options
            .as_ref()
            .and_then(|o| o.get("treatWhitespaceAsEmpty"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if value.is_null() {
            return RuleResult {
                valid: false,
                message: Some(format!("Field '{}' is required but has no value.", field.name)),
                severity: Severity::Error,
            };
        }

        if let Some(s) = value.as_str() {
            let test_value = if treat_whitespace_as_empty {
                s.trim()
            } else {
                s
            };
            if test_value.is_empty() {
                return RuleResult {
                    valid: false,
                    message: Some(format!("Field '{}' is required but is empty.", field.name)),
                    severity: Severity::Error,
                };
            }
        }

        if let Some(arr) = value.as_array() {
            if arr.is_empty() {
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' is required but is an empty array.",
                        field.name
                    )),
                    severity: Severity::Error,
                };
            }
        }

        RuleResult {
            valid: true,
            message: None,
            severity: Severity::Error,
        }
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        field.required.unwrap_or(false)
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Completeness
    }
}

impl Default for RequiredQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
