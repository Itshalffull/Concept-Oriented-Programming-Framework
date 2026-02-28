// Quality Rule Provider: Foreign Key Validation
// Ensures referenced entities exist in the target content type's storage.
// Dimension: consistency

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "foreign_key";
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

pub struct ForeignKeyQualityProvider {
    reference_store: HashMap<String, HashSet<String>>,
}

impl ForeignKeyQualityProvider {
    pub fn new() -> Self {
        Self {
            reference_store: HashMap::new(),
        }
    }

    /// Register known reference values for a given target type and field.
    pub fn register_references(&mut self, target_type: &str, target_field: &str, values: &[&str]) {
        let key = format!("{}::{}", target_type, target_field);
        let store = self.reference_store.entry(key).or_insert_with(HashSet::new);
        for v in values {
            store.insert(v.to_string());
        }
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

        let target_type = config.options.as_ref()
            .and_then(|o| o.get("targetType"))
            .and_then(|v| v.as_str());
        let target_field = config.options.as_ref()
            .and_then(|o| o.get("targetField"))
            .and_then(|v| v.as_str());

        let (target_type, target_field) = match (target_type, target_field) {
            (Some(t), Some(f)) => (t, f),
            _ => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Foreign key rule for field '{}' is misconfigured: targetType and targetField are required.",
                    field.name
                )),
                severity: Severity::Error,
            },
        };

        let store_key = format!("{}::{}", target_type, target_field);
        let store = match self.reference_store.get(&store_key) {
            Some(s) => s,
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Foreign key rule for field '{}': no reference data loaded for {}.{}.",
                    field.name, target_type, target_field
                )),
                severity: Severity::Error,
            },
        };

        let ref_value = match value.as_str() {
            Some(s) => s.to_string(),
            None => value.to_string().trim_matches('"').to_string(),
        };

        if !store.contains(&ref_value) {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Field '{}' references '{}' which does not exist in {}.{}. Dangling reference detected.",
                    field.name, ref_value, target_type, target_field
                )),
                severity: Severity::Error,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Error }
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        let ref_types = ["reference", "foreign_key", "fk", "relation"];
        ref_types.contains(&field.field_type.to_lowercase().as_str())
            || field.constraints.as_ref()
                .map(|c| c.contains_key("foreignKey"))
                .unwrap_or(false)
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Consistency
    }
}

impl Default for ForeignKeyQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}
