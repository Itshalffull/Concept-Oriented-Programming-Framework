// Quality Rule Provider: Type Check Validation
// Validates that field values match their declared type.
// Dimension: validity

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "type_check";
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

pub struct TypeCheckQualityProvider;

impl TypeCheckQualityProvider {
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
            return RuleResult { valid: true, message: None, severity: Severity::Error };
        }

        let strict = config.options.as_ref()
            .and_then(|o| o.get("strict"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let declared_type = field.field_type.to_lowercase();
        let valid = self.check_type(value, &declared_type, strict);

        if !valid {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' expected type '{}' but received incompatible value.",
                    field.name, declared_type
                )),
                severity: Severity::Error,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    fn check_type(&self, value: &serde_json::Value, declared_type: &str, strict: bool) -> bool {
        match declared_type {
            "string" => {
                if value.is_string() { return true; }
                if !strict {
                    return value.is_number() || value.is_boolean();
                }
                false
            }
            "number" | "float" => {
                if value.is_number() { return true; }
                if !strict {
                    if let Some(s) = value.as_str() {
                        return s.parse::<f64>().is_ok();
                    }
                }
                false
            }
            "integer" => {
                if let Some(n) = value.as_f64() {
                    let is_int = n.fract() == 0.0;
                    if strict { return value.is_i64() || value.is_u64(); }
                    return is_int;
                }
                if !strict {
                    if let Some(s) = value.as_str() {
                        return s.parse::<i64>().is_ok();
                    }
                }
                false
            }
            "boolean" => {
                if value.is_boolean() { return true; }
                if !strict {
                    if let Some(s) = value.as_str() {
                        return s == "true" || s == "false";
                    }
                }
                false
            }
            "date" | "datetime" => {
                if let Some(s) = value.as_str() {
                    // Check ISO 8601 date patterns
                    if s.len() >= 10 {
                        let date_part = &s[..10];
                        if date_part.len() == 10
                            && date_part.as_bytes()[4] == b'-'
                            && date_part.as_bytes()[7] == b'-'
                        {
                            let year = date_part[..4].parse::<u32>();
                            let month = date_part[5..7].parse::<u32>();
                            let day = date_part[8..10].parse::<u32>();
                            if let (Ok(y), Ok(m), Ok(d)) = (year, month, day) {
                                return y >= 1 && (1..=12).contains(&m) && (1..=31).contains(&d);
                            }
                        }
                    }
                    return false;
                }
                false
            }
            "array" => value.is_array(),
            "object" => value.is_object(),
            _ => true,
        }
    }

    pub fn applies_to(&self, _field: &FieldDef) -> bool {
        true
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Validity
    }
}

impl Default for TypeCheckQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
