// Quality Rule Provider: Range Validation
// Checks numeric or date values fall within min/max bounds.
// Dimension: validity

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "range";
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

pub struct RangeQualityProvider;

impl RangeQualityProvider {
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

        let opts = config.options.as_ref();
        let min = opts.and_then(|o| o.get("min"));
        let max = opts.and_then(|o| o.get("max"));
        let exclusive_min = opts.and_then(|o| o.get("exclusiveMin"))
            .and_then(|v| v.as_bool()).unwrap_or(false);
        let exclusive_max = opts.and_then(|o| o.get("exclusiveMax"))
            .and_then(|v| v.as_bool()).unwrap_or(false);

        let field_type = field.field_type.to_lowercase();
        if field_type == "date" || field_type == "datetime" {
            return self.validate_date_range(value, field, min, max, exclusive_min, exclusive_max);
        }

        self.validate_numeric_range(value, field, min, max, exclusive_min, exclusive_max)
    }

    fn parse_as_f64(value: &serde_json::Value) -> Option<f64> {
        if let Some(n) = value.as_f64() { return Some(n); }
        if let Some(s) = value.as_str() { return s.parse::<f64>().ok(); }
        None
    }

    fn validate_numeric_range(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        min: Option<&serde_json::Value>,
        max: Option<&serde_json::Value>,
        exclusive_min: bool,
        exclusive_max: bool,
    ) -> RuleResult {
        let num = match Self::parse_as_f64(value) {
            Some(n) => n,
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' value cannot be parsed as a number for range check.", field.name
                )),
                severity: Severity::Error,
            },
        };

        if let Some(min_val) = min.and_then(|v| Self::parse_as_f64(v)) {
            let below = if exclusive_min { num <= min_val } else { num < min_val };
            if below {
                let bound = if exclusive_min { "exclusive" } else { "inclusive" };
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' value {} is below the minimum ({}) of {}.",
                        field.name, num, bound, min_val
                    )),
                    severity: Severity::Error,
                };
            }
        }

        if let Some(max_val) = max.and_then(|v| Self::parse_as_f64(v)) {
            let above = if exclusive_max { num >= max_val } else { num > max_val };
            if above {
                let bound = if exclusive_max { "exclusive" } else { "inclusive" };
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' value {} is above the maximum ({}) of {}.",
                        field.name, num, bound, max_val
                    )),
                    severity: Severity::Error,
                };
            }
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    fn validate_date_range(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        min: Option<&serde_json::Value>,
        max: Option<&serde_json::Value>,
        exclusive_min: bool,
        exclusive_max: bool,
    ) -> RuleResult {
        let date_str = match value.as_str() {
            Some(s) => s,
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' value cannot be parsed as a date for range check.", field.name
                )),
                severity: Severity::Error,
            },
        };

        if let Some(min_val) = min.and_then(|v| v.as_str()) {
            let below = if exclusive_min { date_str <= min_val } else { date_str < min_val };
            if below {
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' date is before the minimum allowed date.", field.name
                    )),
                    severity: Severity::Error,
                };
            }
        }

        if let Some(max_val) = max.and_then(|v| v.as_str()) {
            let above = if exclusive_max { date_str >= max_val } else { date_str > max_val };
            if above {
                return RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' date is after the maximum allowed date.", field.name
                    )),
                    severity: Severity::Error,
                };
            }
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        let numeric_types = ["number", "integer", "float", "date", "datetime"];
        numeric_types.contains(&field.field_type.to_lowercase().as_str())
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Validity
    }
}

impl Default for RangeQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
