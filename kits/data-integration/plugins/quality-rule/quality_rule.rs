// Quality Rule Plugin — data quality validation and enforcement for the Data Integration Kit.
// Provides pluggable quality rules across six dimensions: completeness, uniqueness,
// validity, consistency, timeliness, and accuracy.
// See Data Integration Kit quality.concept for the parent Quality concept definition.

use std::collections::{HashMap, HashSet};
use std::fmt;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// The six standard data quality dimensions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QualityDimension {
    Completeness,
    Uniqueness,
    Validity,
    Consistency,
    Timeliness,
    Accuracy,
}

impl fmt::Display for QualityDimension {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Completeness => write!(f, "completeness"),
            Self::Uniqueness => write!(f, "uniqueness"),
            Self::Validity => write!(f, "validity"),
            Self::Consistency => write!(f, "consistency"),
            Self::Timeliness => write!(f, "timeliness"),
            Self::Accuracy => write!(f, "accuracy"),
        }
    }
}

/// Severity level for rule violations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

/// Describes a field's schema within a record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDef {
    pub name: String,
    pub field_type: FieldType,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub nullable: bool,
    pub parent_entity: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Supported field types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Date,
    Array,
    Object,
}

/// Provider-specific configuration for a quality rule.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RuleConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub severity: Option<Severity>,
    pub message_template: Option<String>,
    #[serde(default)]
    pub options: HashMap<String, serde_json::Value>,
}

fn default_true() -> bool { true }

/// Result of a single rule validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleResult {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<Severity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<serde_json::Value>,
}

impl RuleResult {
    fn ok() -> Self {
        Self { valid: true, message: None, severity: None, diagnostics: None }
    }

    fn fail(message: String, severity: Severity) -> Self {
        Self { valid: false, message: Some(message), severity: Some(severity), diagnostics: None }
    }

    fn fail_with_diagnostics(message: String, severity: Severity, diagnostics: serde_json::Value) -> Self {
        Self { valid: false, message: Some(message), severity: Some(severity), diagnostics: Some(diagnostics) }
    }
}

/// A record is a JSON object.
pub type Record = serde_json::Map<String, serde_json::Value>;

/// Errors that can occur during quality rule evaluation.
#[derive(Debug)]
pub enum QualityRuleError {
    InvalidConfiguration { rule: String, detail: String },
    StorageUnavailable { detail: String },
    KnowledgeBaseUnavailable { detail: String },
}

impl fmt::Display for QualityRuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConfiguration { rule, detail } => write!(f, "Rule '{rule}' config error: {detail}"),
            Self::StorageUnavailable { detail } => write!(f, "Storage unavailable: {detail}"),
            Self::KnowledgeBaseUnavailable { detail } => write!(f, "Knowledge base unavailable: {detail}"),
        }
    }
}

impl std::error::Error for QualityRuleError {}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Interface every quality-rule provider must implement.
#[async_trait]
pub trait QualityRulePlugin: Send + Sync {
    /// Unique identifier for this provider.
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// Default severity for violations from this rule.
    fn default_severity(&self) -> Severity;

    /// Validate a value against this rule.
    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        record: &Record,
        config: &RuleConfig,
    ) -> RuleResult;

    /// Check whether this rule applies to a given field definition.
    fn applies_to(&self, field: &FieldDef) -> bool;

    /// Return the quality dimension this rule measures.
    fn dimension(&self) -> QualityDimension;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn is_null_or_empty(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => true,
        serde_json::Value::String(s) => s.trim().is_empty(),
        serde_json::Value::Array(a) => a.is_empty(),
        serde_json::Value::Object(o) => o.is_empty(),
        _ => false,
    }
}

fn value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => "null".to_string(),
        other => other.to_string(),
    }
}

fn effective_severity(config: &RuleConfig, default: Severity) -> Severity {
    config.severity.unwrap_or(default)
}

fn option_bool(config: &RuleConfig, key: &str, default: bool) -> bool {
    config.options.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
}

fn option_str<'a>(config: &'a RuleConfig, key: &str) -> Option<&'a str> {
    config.options.get(key).and_then(|v| v.as_str())
}

fn option_f64(config: &RuleConfig, key: &str, default: f64) -> f64 {
    config.options.get(key).and_then(|v| v.as_f64()).unwrap_or(default)
}

// ---------------------------------------------------------------------------
// 1. RequiredRule — completeness: field must not be null/empty
// ---------------------------------------------------------------------------

pub struct RequiredRule;

#[async_trait]
impl QualityRulePlugin for RequiredRule {
    fn id(&self) -> &str { "required" }
    fn display_name(&self) -> &str { "Required Field" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Completeness }

    fn applies_to(&self, field: &FieldDef) -> bool {
        field.required
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let allow_whitespace = option_bool(config, "allowWhitespace", false);

        match value {
            serde_json::Value::Null => {
                RuleResult::fail(
                    format!("Field '{}' is required but was null", field.name),
                    severity,
                )
            }
            serde_json::Value::String(s) => {
                let empty = if allow_whitespace { s.is_empty() } else { s.trim().is_empty() };
                if empty {
                    RuleResult::fail(
                        format!("Field '{}' is required but was empty", field.name),
                        severity,
                    )
                } else {
                    RuleResult::ok()
                }
            }
            serde_json::Value::Array(a) if a.is_empty() => {
                RuleResult::fail(
                    format!("Field '{}' is required but was an empty array", field.name),
                    severity,
                )
            }
            serde_json::Value::Object(o) if o.is_empty() => {
                RuleResult::fail(
                    format!("Field '{}' is required but was an empty object", field.name),
                    severity,
                )
            }
            _ => RuleResult::ok(),
        }
    }
}

// ---------------------------------------------------------------------------
// 2. UniqueRule — uniqueness: value must be unique across all records
// ---------------------------------------------------------------------------

pub struct UniqueRule {
    /// Scope => field name => Set<serialized-value>
    seen: std::sync::Mutex<HashMap<String, HashMap<String, HashSet<String>>>>,
}

impl UniqueRule {
    pub fn new() -> Self {
        Self { seen: std::sync::Mutex::new(HashMap::new()) }
    }

    pub fn reset(&self, scope: Option<&str>) {
        let mut seen = self.seen.lock().unwrap();
        if let Some(scope) = scope {
            seen.remove(scope);
        } else {
            seen.clear();
        }
    }

    /// Batch check uniqueness, returning indices of duplicates.
    pub fn batch_check(
        &self,
        values: &[serde_json::Value],
        case_sensitive: bool,
    ) -> Vec<usize> {
        let mut seen = HashSet::new();
        let mut duplicates = Vec::new();

        for (i, val) in values.iter().enumerate() {
            if val.is_null() { continue; }
            let mut serialized = value_to_string(val);
            if !case_sensitive { serialized = serialized.to_lowercase(); }

            if seen.contains(&serialized) {
                duplicates.push(i);
            } else {
                seen.insert(serialized);
            }
        }

        duplicates
    }
}

#[async_trait]
impl QualityRulePlugin for UniqueRule {
    fn id(&self) -> &str { "unique" }
    fn display_name(&self) -> &str { "Unique Value" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Uniqueness }

    fn applies_to(&self, _field: &FieldDef) -> bool { true }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let scope = option_str(config, "scope").unwrap_or("global");
        let case_sensitive = option_bool(config, "caseSensitive", true);

        if value.is_null() {
            return RuleResult::ok();
        }

        let scope_key = if scope == "global" {
            "__global__".to_string()
        } else {
            format!("parent:{}", field.parent_entity.as_deref().unwrap_or("__none__"))
        };

        let mut serialized = value_to_string(value);
        if !case_sensitive { serialized = serialized.to_lowercase(); }

        let mut seen = self.seen.lock().unwrap();
        let scope_map = seen.entry(scope_key).or_default();
        let field_set = scope_map.entry(field.name.clone()).or_default();

        if field_set.contains(&serialized) {
            return RuleResult::fail_with_diagnostics(
                format!("Field '{}' value '{}' is not unique (scope: {})", field.name, serialized, scope),
                severity,
                serde_json::json!({ "scope": scope, "duplicateValue": serialized }),
            );
        }

        field_set.insert(serialized);
        RuleResult::ok()
    }
}

// ---------------------------------------------------------------------------
// 3. TypeCheckRule — validity: value must match declared type
// ---------------------------------------------------------------------------

pub struct TypeCheckRule;

#[async_trait]
impl QualityRulePlugin for TypeCheckRule {
    fn id(&self) -> &str { "type_check" }
    fn display_name(&self) -> &str { "Type Check" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Validity }

    fn applies_to(&self, _field: &FieldDef) -> bool { true }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let allow_coercion = option_bool(config, "allowCoercion", false);

        if value.is_null() {
            return RuleResult::ok(); // Null handling deferred to RequiredRule
        }

        let (matches, actual_type, coercible) = self.check_type(value, field.field_type, allow_coercion);

        if !matches {
            return RuleResult::fail_with_diagnostics(
                format!(
                    "Field '{}' expected type '{}' but got '{}'",
                    field.name,
                    format!("{:?}", field.field_type).to_lowercase(),
                    actual_type
                ),
                severity,
                serde_json::json!({
                    "expectedType": format!("{:?}", field.field_type).to_lowercase(),
                    "actualType": actual_type,
                    "coercible": coercible,
                }),
            );
        }

        RuleResult::ok()
    }
}

impl TypeCheckRule {
    fn check_type(
        &self,
        value: &serde_json::Value,
        expected: FieldType,
        allow_coercion: bool,
    ) -> (bool, String, bool) {
        match expected {
            FieldType::String => match value {
                serde_json::Value::String(_) => (true, "string".into(), false),
                serde_json::Value::Number(_) if allow_coercion => (true, "number".into(), true),
                serde_json::Value::Bool(_) if allow_coercion => (true, "boolean".into(), true),
                serde_json::Value::Number(_) => (false, "number".into(), true),
                serde_json::Value::Bool(_) => (false, "boolean".into(), true),
                other => (false, self.json_type_name(other), false),
            },

            FieldType::Number => match value {
                serde_json::Value::Number(n) => {
                    if n.is_f64() || n.is_i64() || n.is_u64() {
                        (true, "number".into(), false)
                    } else {
                        (false, "NaN".into(), false)
                    }
                }
                serde_json::Value::String(s) if allow_coercion => {
                    let coercible = s.parse::<f64>().is_ok();
                    (coercible, "string".into(), coercible)
                }
                serde_json::Value::String(s) => {
                    let coercible = s.parse::<f64>().is_ok();
                    (false, "string".into(), coercible)
                }
                other => (false, self.json_type_name(other), false),
            },

            FieldType::Boolean => match value {
                serde_json::Value::Bool(_) => (true, "boolean".into(), false),
                serde_json::Value::String(s) if allow_coercion => {
                    let valid = ["true", "false", "1", "0", "yes", "no"]
                        .contains(&s.to_lowercase().as_str());
                    (valid, "string".into(), valid)
                }
                serde_json::Value::Number(n) if allow_coercion => {
                    let valid = n.as_i64() == Some(0) || n.as_i64() == Some(1);
                    (valid, "number".into(), valid)
                }
                other => (false, self.json_type_name(other), false),
            },

            FieldType::Date => match value {
                serde_json::Value::String(s) => {
                    // Check ISO 8601 format
                    let iso_re = regex::Regex::new(
                        r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$"
                    ).unwrap();
                    if iso_re.is_match(s) {
                        let parseable = DateTime::parse_from_rfc3339(s).is_ok()
                            || chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok();
                        (parseable || allow_coercion, "string(ISO)".into(), true)
                    } else {
                        (false, "string".into(), false)
                    }
                }
                serde_json::Value::Number(_) if allow_coercion => {
                    (true, "number(timestamp)".into(), true)
                }
                other => (false, self.json_type_name(other), false),
            },

            FieldType::Array => match value {
                serde_json::Value::Array(_) => (true, "array".into(), false),
                serde_json::Value::String(s) if allow_coercion => {
                    let coercible = serde_json::from_str::<Vec<serde_json::Value>>(s).is_ok();
                    (coercible, "string".into(), coercible)
                }
                other => (false, self.json_type_name(other), false),
            },

            FieldType::Object => match value {
                serde_json::Value::Object(_) => (true, "object".into(), false),
                serde_json::Value::String(s) if allow_coercion => {
                    let coercible = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(s).is_ok();
                    (coercible, "string".into(), coercible)
                }
                other => (false, self.json_type_name(other), false),
            },
        }
    }

    fn json_type_name(&self, value: &serde_json::Value) -> String {
        match value {
            serde_json::Value::Null => "null",
            serde_json::Value::Bool(_) => "boolean",
            serde_json::Value::Number(_) => "number",
            serde_json::Value::String(_) => "string",
            serde_json::Value::Array(_) => "array",
            serde_json::Value::Object(_) => "object",
        }.to_string()
    }
}

// ---------------------------------------------------------------------------
// 4. RangeRule — validity: numeric value within min/max bounds
// ---------------------------------------------------------------------------

pub struct RangeRule;

#[async_trait]
impl QualityRulePlugin for RangeRule {
    fn id(&self) -> &str { "range" }
    fn display_name(&self) -> &str { "Range Check" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Validity }

    fn applies_to(&self, field: &FieldDef) -> bool {
        matches!(field.field_type, FieldType::Number | FieldType::Date | FieldType::String)
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let min_inclusive = option_bool(config, "minInclusive", true);
        let max_inclusive = option_bool(config, "maxInclusive", true);
        let check_length = option_bool(config, "checkLength", false);

        if value.is_null() {
            return RuleResult::ok();
        }

        let comparable: f64;
        let display_value: String;

        if check_length {
            if let Some(s) = value.as_str() {
                comparable = s.len() as f64;
                display_value = format!("length({})", s.len());
            } else {
                return RuleResult::ok();
            }
        } else if field.field_type == FieldType::Date {
            if let Some(s) = value.as_str() {
                if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                    comparable = dt.timestamp_millis() as f64;
                    display_value = s.to_string();
                } else if let Ok(nd) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                    comparable = nd.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp_millis() as f64;
                    display_value = s.to_string();
                } else {
                    return RuleResult::fail(
                        format!("Field '{}' has unparseable date for range check", field.name),
                        severity,
                    );
                }
            } else if let Some(n) = value.as_f64() {
                comparable = n;
                display_value = format!("{}", n);
            } else {
                return RuleResult::ok();
            }

            // Parse date bounds
            let min_val = config.options.get("min").and_then(|v| self.parse_date_bound(v));
            let max_val = config.options.get("max").and_then(|v| self.parse_date_bound(v));

            return self.check_range(
                comparable, min_val, max_val,
                min_inclusive, max_inclusive,
                field, &display_value, severity,
            );
        } else if let Some(n) = value.as_f64() {
            comparable = n;
            display_value = format!("{}", n);
        } else if let Some(s) = value.as_str() {
            if let Ok(parsed) = s.parse::<f64>() {
                comparable = parsed;
                display_value = s.to_string();
            } else {
                return RuleResult::fail(
                    format!("Field '{}' value '{}' is not numeric for range check", field.name, s),
                    severity,
                );
            }
        } else {
            return RuleResult::ok();
        }

        let num_min = config.options.get("min").and_then(|v| v.as_f64());
        let num_max = config.options.get("max").and_then(|v| v.as_f64());

        self.check_range(
            comparable, num_min, num_max,
            min_inclusive, max_inclusive,
            field, &display_value, severity,
        )
    }
}

impl RangeRule {
    fn check_range(
        &self,
        value: f64,
        min: Option<f64>,
        max: Option<f64>,
        min_inclusive: bool,
        max_inclusive: bool,
        field: &FieldDef,
        display_value: &str,
        severity: Severity,
    ) -> RuleResult {
        if let Some(min) = min {
            let below = if min_inclusive { value < min } else { value <= min };
            if below {
                let op = if min_inclusive { ">=" } else { ">" };
                return RuleResult::fail_with_diagnostics(
                    format!("Field '{}' value {} must be {} {}", field.name, display_value, op, min),
                    severity,
                    serde_json::json!({ "constraint": "min", "bound": min, "inclusive": min_inclusive, "actualValue": value }),
                );
            }
        }

        if let Some(max) = max {
            let above = if max_inclusive { value > max } else { value >= max };
            if above {
                let op = if max_inclusive { "<=" } else { "<" };
                return RuleResult::fail_with_diagnostics(
                    format!("Field '{}' value {} must be {} {}", field.name, display_value, op, max),
                    severity,
                    serde_json::json!({ "constraint": "max", "bound": max, "inclusive": max_inclusive, "actualValue": value }),
                );
            }
        }

        RuleResult::ok()
    }

    fn parse_date_bound(&self, value: &serde_json::Value) -> Option<f64> {
        if let Some(s) = value.as_str() {
            if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                return Some(dt.timestamp_millis() as f64);
            }
            if let Ok(nd) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                return Some(nd.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp_millis() as f64);
            }
        }
        value.as_f64()
    }
}

// ---------------------------------------------------------------------------
// 5. PatternRule — validity: string matches regex pattern
// ---------------------------------------------------------------------------

pub struct PatternRule;

impl PatternRule {
    /// Preset patterns for common validation scenarios.
    fn preset(name: &str) -> Option<(&'static str, &'static str)> {
        match name {
            "email" => Some((
                r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
                "RFC 5322 simplified email address",
            )),
            "url" => Some((
                r"^https?://[^\s/$.?#].[^\s]*$",
                "HTTP/HTTPS URL",
            )),
            "phone" => Some((
                r"^\+?[1-9]\d{1,14}$",
                "E.164 international phone number",
            )),
            "uuid" => Some((
                r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
                "RFC 4122 UUID",
            )),
            "iso_date" => Some((
                r"^\d{4}-\d{2}-\d{2}$",
                "ISO 8601 date (YYYY-MM-DD)",
            )),
            "iso_datetime" => Some((
                r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$",
                "ISO 8601 date-time",
            )),
            "ipv4" => Some((
                r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$",
                "IPv4 address",
            )),
            "slug" => Some((
                r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
                "URL slug",
            )),
            _ => None,
        }
    }

    pub fn available_presets() -> Vec<&'static str> {
        vec!["email", "url", "phone", "uuid", "iso_date", "iso_datetime", "ipv4", "slug"]
    }
}

#[async_trait]
impl QualityRulePlugin for PatternRule {
    fn id(&self) -> &str { "pattern" }
    fn display_name(&self) -> &str { "Pattern Match" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Validity }

    fn applies_to(&self, field: &FieldDef) -> bool {
        field.field_type == FieldType::String
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let invert = option_bool(config, "invert", false);

        let str_value = match value.as_str() {
            Some(s) => s,
            None => return RuleResult::ok(),
        };

        let preset_name = option_str(config, "preset");
        let custom_pattern = option_str(config, "pattern");
        let case_insensitive = option_bool(config, "caseInsensitive", false);

        let (pattern, description) = if let Some(name) = preset_name {
            if let Some((p, d)) = Self::preset(name) {
                (p.to_string(), d.to_string())
            } else {
                return RuleResult::fail(
                    format!("Unknown preset pattern: '{}'", name),
                    Severity::Error,
                );
            }
        } else if let Some(p) = custom_pattern {
            (p.to_string(), p.to_string())
        } else {
            return RuleResult::ok(); // No pattern configured
        };

        let full_pattern = if case_insensitive {
            format!("(?i){}", pattern)
        } else {
            pattern.clone()
        };

        let regex = match regex::Regex::new(&full_pattern) {
            Ok(r) => r,
            Err(e) => {
                return RuleResult::fail(
                    format!("Field '{}' has invalid pattern configuration: {}", field.name, e),
                    Severity::Error,
                );
            }
        };

        let matches = regex.is_match(str_value);
        let valid = if invert { !matches } else { matches };

        if !valid {
            let invert_str = if invert { "exclusion " } else { "" };
            return RuleResult::fail_with_diagnostics(
                format!(
                    "Field '{}' value '{}' does not match {}pattern: {}",
                    field.name,
                    if str_value.len() > 50 { &str_value[..50] } else { str_value },
                    invert_str,
                    description,
                ),
                severity,
                serde_json::json!({ "pattern": pattern, "preset": preset_name, "invert": invert }),
            );
        }

        RuleResult::ok()
    }
}

// ---------------------------------------------------------------------------
// 6. EnumRule — validity: value must be in allowed set
// ---------------------------------------------------------------------------

pub struct EnumRule;

#[async_trait]
impl QualityRulePlugin for EnumRule {
    fn id(&self) -> &str { "enum" }
    fn display_name(&self) -> &str { "Enum Check" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Validity }

    fn applies_to(&self, _field: &FieldDef) -> bool { true }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let case_sensitive = option_bool(config, "caseSensitive", true);
        let allow_subset = option_bool(config, "allowSubset", false);

        if value.is_null() { return RuleResult::ok(); }

        let allowed = match config.options.get("values").and_then(|v| v.as_array()) {
            Some(a) if !a.is_empty() => a,
            _ => return RuleResult::ok(),
        };

        // Array subset validation
        if let Some(arr) = value.as_array() {
            if allow_subset {
                let invalid: Vec<_> = arr.iter()
                    .filter(|elem| !self.is_in_set(elem, allowed, case_sensitive))
                    .collect();

                if !invalid.is_empty() {
                    return RuleResult::fail_with_diagnostics(
                        format!("Field '{}' contains values not in allowed set: {:?}", field.name, invalid),
                        severity,
                        serde_json::json!({ "invalidCount": invalid.len(), "totalChecked": arr.len() }),
                    );
                }
                return RuleResult::ok();
            }
        }

        // Single value check
        if !self.is_in_set(value, allowed, case_sensitive) {
            let truncated: Vec<_> = if allowed.len() > 10 {
                let mut t: Vec<String> = allowed.iter().take(10).map(|v| value_to_string(v)).collect();
                t.push(format!("... ({} total)", allowed.len()));
                t
            } else {
                allowed.iter().map(|v| value_to_string(v)).collect()
            };

            let closest = self.find_closest_match(value, allowed);

            return RuleResult::fail_with_diagnostics(
                format!(
                    "Field '{}' value '{}' is not in allowed set: [{}]",
                    field.name,
                    value_to_string(value),
                    truncated.join(", "),
                ),
                severity,
                serde_json::json!({
                    "receivedValue": value,
                    "closestMatch": closest,
                }),
            );
        }

        RuleResult::ok()
    }
}

impl EnumRule {
    fn is_in_set(&self, value: &serde_json::Value, allowed: &[serde_json::Value], case_sensitive: bool) -> bool {
        if case_sensitive {
            allowed.contains(value)
        } else {
            let lower = value_to_string(value).to_lowercase();
            allowed.iter().any(|a| value_to_string(a).to_lowercase() == lower)
        }
    }

    fn find_closest_match(&self, value: &serde_json::Value, allowed: &[serde_json::Value]) -> Option<String> {
        let val_str = value.as_str()?;
        let mut closest: Option<(String, usize)> = None;

        for a in allowed {
            if let Some(a_str) = a.as_str() {
                let dist = levenshtein_distance(&val_str.to_lowercase(), &a_str.to_lowercase());
                if closest.as_ref().map_or(true, |(_, d)| dist < *d) {
                    closest = Some((a_str.to_string(), dist));
                }
            }
        }

        closest.and_then(|(s, d)| if d <= val_str.len().max(3) { Some(s) } else { None })
    }
}

fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();

    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 0..=m { dp[i][0] = i; }
    for j in 0..=n { dp[0][j] = j; }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }

    dp[m][n]
}

// ---------------------------------------------------------------------------
// 7. ForeignKeyRule — consistency: referenced entity must exist
// ---------------------------------------------------------------------------

/// Storage adapter trait for foreign key checking.
#[async_trait]
pub trait StorageAdapter: Send + Sync {
    async fn entity_exists(&self, entity_type: &str, key: &str) -> bool;
    async fn entities_batch_exist(&self, entity_type: &str, keys: &[String]) -> HashMap<String, bool>;
}

pub struct ForeignKeyRule {
    storage: Option<Box<dyn StorageAdapter>>,
    cache: std::sync::Mutex<HashMap<String, HashSet<String>>>,
}

impl ForeignKeyRule {
    pub fn new(storage: Option<Box<dyn StorageAdapter>>) -> Self {
        Self { storage, cache: std::sync::Mutex::new(HashMap::new()) }
    }

    pub async fn prefetch(&self, entity_type: &str, keys: &[String]) {
        if let Some(ref storage) = self.storage {
            let results = storage.entities_batch_exist(entity_type, keys).await;
            let cache_key = format!("{}:id", entity_type);
            let mut cache = self.cache.lock().unwrap();
            let set = cache.entry(cache_key).or_default();
            for (key, exists) in results {
                if exists { set.insert(key); }
            }
        }
    }

    pub fn clear_cache(&self) {
        self.cache.lock().unwrap().clear();
    }
}

#[async_trait]
impl QualityRulePlugin for ForeignKeyRule {
    fn id(&self) -> &str { "foreign_key" }
    fn display_name(&self) -> &str { "Foreign Key Check" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Consistency }

    fn applies_to(&self, field: &FieldDef) -> bool {
        field.metadata.as_ref()
            .and_then(|m| m.get("referencedEntity"))
            .is_some()
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let soft = option_bool(config, "soft", false);

        if value.is_null() { return RuleResult::ok(); }

        let referenced_entity = option_str(config, "referencedEntity")
            .or_else(|| field.metadata.as_ref()?.get("referencedEntity")?.as_str());
        let referenced_field = option_str(config, "referencedField").unwrap_or("id");

        let referenced_entity = match referenced_entity {
            Some(e) => e,
            None => return RuleResult::ok(),
        };

        let storage = match &self.storage {
            Some(s) => s,
            None => return RuleResult {
                valid: true,
                message: None,
                severity: None,
                diagnostics: Some(serde_json::json!({
                    "warning": "No storage adapter configured; foreign key not verified",
                    "referencedEntity": referenced_entity,
                })),
            },
        };

        let key = value_to_string(value);
        let cache_key = format!("{}:{}", referenced_entity, referenced_field);

        // Check cache
        {
            let cache = self.cache.lock().unwrap();
            if cache.get(&cache_key).map_or(false, |s| s.contains(&key)) {
                return RuleResult::ok();
            }
        }

        // Query storage
        let exists = storage.entity_exists(referenced_entity, &key).await;

        if exists {
            let mut cache = self.cache.lock().unwrap();
            cache.entry(cache_key).or_default().insert(key);
            return RuleResult::ok();
        }

        let effective_severity = if soft { Severity::Warning } else { severity };
        RuleResult::fail_with_diagnostics(
            format!(
                "Field '{}' references non-existent {}.{} = '{}'",
                field.name, referenced_entity, referenced_field, value_to_string(value)
            ),
            effective_severity,
            serde_json::json!({
                "referencedEntity": referenced_entity,
                "referencedField": referenced_field,
                "missingKey": value_to_string(value),
                "softEnforcement": soft,
            }),
        )
    }
}

// ---------------------------------------------------------------------------
// 8. CrossFieldRule — consistency: multi-field rules
// ---------------------------------------------------------------------------

pub struct CrossFieldRule;

#[async_trait]
impl QualityRulePlugin for CrossFieldRule {
    fn id(&self) -> &str { "cross_field" }
    fn display_name(&self) -> &str { "Cross-Field Validation" }
    fn default_severity(&self) -> Severity { Severity::Error }
    fn dimension(&self) -> QualityDimension { QualityDimension::Consistency }

    fn applies_to(&self, _field: &FieldDef) -> bool { true }

    async fn validate(
        &self,
        _value: &serde_json::Value,
        field: &FieldDef,
        record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());

        let rules = match config.options.get("rules").and_then(|v| v.as_array()) {
            Some(r) if !r.is_empty() => r,
            _ => return RuleResult::ok(),
        };

        let mut violations = Vec::new();

        for rule in rules {
            let left_field = match rule.get("leftField").and_then(|v| v.as_str()) {
                Some(f) => f,
                None => continue,
            };
            let operator = match rule.get("operator").and_then(|v| v.as_str()) {
                Some(o) => o,
                None => continue,
            };

            // Check conditional
            if let Some(cond) = rule.get("condition").and_then(|v| v.as_object()) {
                if let (Some(cond_field), Some(cond_op)) = (
                    cond.get("field").and_then(|v| v.as_str()),
                    cond.get("operator").and_then(|v| v.as_str()),
                ) {
                    let cond_val = record.get(cond_field).unwrap_or(&serde_json::Value::Null);
                    let cond_right = cond.get("value").unwrap_or(&serde_json::Value::Null);
                    if !self.compare(cond_val, cond_op, cond_right) {
                        continue;
                    }
                }
            }

            let left_val = record.get(left_field).unwrap_or(&serde_json::Value::Null);
            let right_val = if let Some(right_field) = rule.get("rightField").and_then(|v| v.as_str()) {
                record.get(right_field).unwrap_or(&serde_json::Value::Null)
            } else {
                rule.get("rightValue").unwrap_or(&serde_json::Value::Null)
            };

            if left_val.is_null() || right_val.is_null() {
                continue;
            }

            if !self.compare(left_val, operator, right_val) {
                let right_desc = rule.get("rightField")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| value_to_string(right_val));
                violations.push(format!(
                    "{} ({}) must be {} {} ({})",
                    left_field, value_to_string(left_val),
                    operator, right_desc, value_to_string(right_val)
                ));
            }
        }

        if !violations.is_empty() {
            return RuleResult::fail_with_diagnostics(
                format!("Cross-field validation failed for '{}': {}", field.name, violations.join("; ")),
                severity,
                serde_json::json!({ "violations": violations, "ruleCount": rules.len(), "failedCount": violations.len() }),
            );
        }

        RuleResult::ok()
    }
}

impl CrossFieldRule {
    fn compare(&self, left: &serde_json::Value, op: &str, right: &serde_json::Value) -> bool {
        let left_num = self.to_comparable(left);
        let right_num = self.to_comparable(right);

        match op {
            "eq" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { (l - r).abs() < f64::EPSILON } else { left == right }
            }
            "neq" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { (l - r).abs() >= f64::EPSILON } else { left != right }
            }
            "gt" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { l > r } else { value_to_string(left) > value_to_string(right) }
            }
            "gte" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { l >= r } else { value_to_string(left) >= value_to_string(right) }
            }
            "lt" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { l < r } else { value_to_string(left) < value_to_string(right) }
            }
            "lte" => {
                if let (Some(l), Some(r)) = (left_num, right_num) { l <= r } else { value_to_string(left) <= value_to_string(right) }
            }
            "contains" => value_to_string(left).contains(&value_to_string(right)),
            "not_contains" => !value_to_string(left).contains(&value_to_string(right)),
            _ => false,
        }
    }

    fn to_comparable(&self, value: &serde_json::Value) -> Option<f64> {
        if let Some(n) = value.as_f64() { return Some(n); }
        if let Some(s) = value.as_str() {
            // Try date parsing
            if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                return Some(dt.timestamp_millis() as f64);
            }
            // Try number
            if let Ok(n) = s.parse::<f64>() { return Some(n); }
        }
        None
    }
}

// ---------------------------------------------------------------------------
// 9. FreshnessRule — timeliness: data must be newer than threshold
// ---------------------------------------------------------------------------

pub struct FreshnessRule;

#[async_trait]
impl QualityRulePlugin for FreshnessRule {
    fn id(&self) -> &str { "freshness" }
    fn display_name(&self) -> &str { "Data Freshness" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn dimension(&self) -> QualityDimension { QualityDimension::Timeliness }

    fn applies_to(&self, field: &FieldDef) -> bool {
        field.field_type == FieldType::Date
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());

        if value.is_null() { return RuleResult::ok(); }

        let timestamp = match value.as_str() {
            Some(s) => {
                match DateTime::parse_from_rfc3339(s) {
                    Ok(dt) => dt.with_timezone(&Utc),
                    Err(_) => {
                        if let Ok(nd) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                            nd.and_hms_opt(0, 0, 0).unwrap().and_utc()
                        } else {
                            return RuleResult::fail(
                                format!("Field '{}' has unparseable date for freshness check", field.name),
                                severity,
                            );
                        }
                    }
                }
            }
            None => {
                if let Some(n) = value.as_f64() {
                    DateTime::from_timestamp_millis(n as i64).unwrap_or(Utc::now())
                } else {
                    return RuleResult::fail(
                        format!("Field '{}' has invalid type for freshness check", field.name),
                        severity,
                    );
                }
            }
        };

        let reference_time = Utc::now();

        // Parse threshold
        let max_age = option_str(config, "maxAge");
        let not_before = config.options.get("notBefore");

        let threshold = if let Some(duration_str) = max_age {
            match self.parse_duration(duration_str) {
                Some(dur) => reference_time - dur,
                None => return RuleResult::fail(
                    format!("Invalid maxAge duration format: '{}'. Use formats like '24h', '7d', '30m'", duration_str),
                    Severity::Error,
                ),
            }
        } else if let Some(abs_val) = not_before {
            if let Some(s) = abs_val.as_str() {
                match DateTime::parse_from_rfc3339(s) {
                    Ok(dt) => dt.with_timezone(&Utc),
                    Err(_) => return RuleResult::ok(),
                }
            } else {
                return RuleResult::ok();
            }
        } else {
            return RuleResult::ok(); // No threshold configured
        };

        let age = reference_time.signed_duration_since(timestamp);
        let age_human = self.format_age(age);

        if timestamp < threshold {
            return RuleResult::fail_with_diagnostics(
                format!(
                    "Field '{}' data is stale (age: {}, max allowed: {})",
                    field.name, age_human,
                    max_age.unwrap_or("N/A")
                ),
                severity,
                serde_json::json!({
                    "timestamp": timestamp.to_rfc3339(),
                    "ageSeconds": age.num_seconds(),
                    "ageHuman": age_human,
                    "maxAge": max_age,
                }),
            );
        }

        // Check for future timestamps
        let allow_future = option_bool(config, "allowFuture", false);
        let ahead = timestamp.signed_duration_since(reference_time);
        if !allow_future && ahead.num_seconds() > 60 {
            return RuleResult::fail_with_diagnostics(
                format!("Field '{}' has a future timestamp: {}", field.name, timestamp.to_rfc3339()),
                Severity::Warning,
                serde_json::json!({ "aheadBySeconds": ahead.num_seconds() }),
            );
        }

        RuleResult {
            valid: true,
            message: None,
            severity: None,
            diagnostics: Some(serde_json::json!({ "ageSeconds": age.num_seconds(), "ageHuman": age_human })),
        }
    }
}

impl FreshnessRule {
    /// Parse duration strings like "24h", "7d", "30m", "1y" to chrono::Duration.
    fn parse_duration(&self, s: &str) -> Option<chrono::Duration> {
        let re = regex::Regex::new(r"^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$").ok()?;
        let caps = re.captures(s)?;
        let amount: f64 = caps.get(1)?.as_str().parse().ok()?;
        let unit = caps.get(2)?.as_str();

        let seconds = match unit {
            "ms" => amount / 1000.0,
            "s" => amount,
            "m" => amount * 60.0,
            "h" => amount * 3600.0,
            "d" => amount * 86400.0,
            "w" => amount * 604800.0,
            "M" => amount * 2592000.0,
            "y" => amount * 31536000.0,
            _ => return None,
        };

        Some(chrono::Duration::seconds(seconds as i64))
    }

    fn format_age(&self, duration: chrono::Duration) -> String {
        let secs = duration.num_seconds().unsigned_abs();
        if secs < 60 { return format!("{}s", secs); }
        if secs < 3600 { return format!("{}m", secs / 60); }
        if secs < 86400 { return format!("{:.1}h", secs as f64 / 3600.0); }
        if secs < 604800 { return format!("{:.1}d", secs as f64 / 86400.0); }
        format!("{:.1}w", secs as f64 / 604800.0)
    }
}

// ---------------------------------------------------------------------------
// 10. NoDuplicatesRule — uniqueness: record-level dedup
// ---------------------------------------------------------------------------

pub struct NoDuplicatesRule {
    seen: std::sync::Mutex<HashMap<String, (usize, serde_json::Map<String, serde_json::Value>)>>,
    index: std::sync::atomic::AtomicUsize,
}

impl NoDuplicatesRule {
    pub fn new() -> Self {
        Self {
            seen: std::sync::Mutex::new(HashMap::new()),
            index: std::sync::atomic::AtomicUsize::new(0),
        }
    }

    pub fn reset(&self) {
        self.seen.lock().unwrap().clear();
        self.index.store(0, std::sync::atomic::Ordering::SeqCst);
    }

    fn compute_exact_signature(record: &Record, fields: &[&str]) -> String {
        fields.iter()
            .map(|f| format!("{}:{}", f, record.get(*f).map_or("null".to_string(), |v| v.to_string())))
            .collect::<Vec<_>>()
            .join("|")
    }

    fn compute_normalized_signature(record: &Record, fields: &[&str]) -> String {
        fields.iter()
            .map(|f| {
                let val = record.get(*f);
                if let Some(serde_json::Value::String(s)) = val {
                    let normalized: String = s.to_lowercase()
                        .chars()
                        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
                        .collect::<String>()
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ");
                    format!("{}:{}", f, normalized)
                } else {
                    format!("{}:{}", f, val.map_or("null".to_string(), |v| v.to_string()))
                }
            })
            .collect::<Vec<_>>()
            .join("|")
    }

    fn compute_jaccard_similarity(record_a: &Record, record_b: &Record, fields: &[&str]) -> f64 {
        let mut total_intersection = 0usize;
        let mut total_union = 0usize;

        for f in fields {
            let a = record_a.get(*f).map_or(String::new(), |v| value_to_string(v).to_lowercase());
            let b = record_b.get(*f).map_or(String::new(), |v| value_to_string(v).to_lowercase());

            let bigrams_a: HashSet<String> = Self::bigrams(&a).into_iter().collect();
            let bigrams_b: HashSet<String> = Self::bigrams(&b).into_iter().collect();

            let intersection = bigrams_a.intersection(&bigrams_b).count();
            let union = bigrams_a.union(&bigrams_b).count();

            total_intersection += intersection;
            total_union += union;
        }

        if total_union == 0 { 1.0 } else { total_intersection as f64 / total_union as f64 }
    }

    fn bigrams(s: &str) -> Vec<String> {
        let chars: Vec<char> = s.chars().collect();
        if chars.len() < 2 { return vec![]; }
        (0..chars.len() - 1).map(|i| format!("{}{}", chars[i], chars[i + 1])).collect()
    }
}

#[async_trait]
impl QualityRulePlugin for NoDuplicatesRule {
    fn id(&self) -> &str { "no_duplicates" }
    fn display_name(&self) -> &str { "No Duplicate Records" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn dimension(&self) -> QualityDimension { QualityDimension::Uniqueness }

    fn applies_to(&self, _field: &FieldDef) -> bool { true }

    async fn validate(
        &self,
        _value: &serde_json::Value,
        field: &FieldDef,
        record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let compare_fields_val = config.options.get("compareFields").and_then(|v| v.as_array());
        let match_mode = option_str(config, "matchMode").unwrap_or("exact");
        let similarity_threshold = option_f64(config, "similarityThreshold", 0.9);

        let compare_fields: Vec<&str> = match compare_fields_val {
            Some(arr) => arr.iter().filter_map(|v| v.as_str()).collect(),
            None => return RuleResult::ok(),
        };

        if compare_fields.is_empty() { return RuleResult::ok(); }

        let current_index = self.index.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        match match_mode {
            "exact" => {
                let signature = Self::compute_exact_signature(record, &compare_fields);
                let mut seen = self.seen.lock().unwrap();
                if let Some((idx, _)) = seen.get(&signature) {
                    return RuleResult::fail_with_diagnostics(
                        format!("Duplicate record detected for '{}' (matches record at index {})", field.name, idx),
                        severity,
                        serde_json::json!({ "matchMode": "exact", "matchedIndex": idx }),
                    );
                }
                seen.insert(signature, (current_index, record.clone()));
            }

            "normalized" => {
                let signature = Self::compute_normalized_signature(record, &compare_fields);
                let mut seen = self.seen.lock().unwrap();
                if let Some((idx, _)) = seen.get(&signature) {
                    return RuleResult::fail_with_diagnostics(
                        format!("Duplicate record detected (normalized match at index {})", idx),
                        severity,
                        serde_json::json!({ "matchMode": "normalized", "matchedIndex": idx }),
                    );
                }
                seen.insert(signature, (current_index, record.clone()));
            }

            "fuzzy" => {
                let seen = self.seen.lock().unwrap();
                for (_, (idx, existing_record)) in seen.iter() {
                    let similarity = Self::compute_jaccard_similarity(record, existing_record, &compare_fields);
                    if similarity >= similarity_threshold {
                        return RuleResult::fail_with_diagnostics(
                            format!("Probable duplicate record detected (similarity: {:.1}%, threshold: {:.1}%)",
                                    similarity * 100.0, similarity_threshold * 100.0),
                            severity,
                            serde_json::json!({
                                "matchMode": "fuzzy",
                                "similarity": similarity,
                                "threshold": similarity_threshold,
                                "matchedIndex": idx,
                            }),
                        );
                    }
                }
                drop(seen);
                let signature = Self::compute_exact_signature(record, &compare_fields);
                self.seen.lock().unwrap().insert(signature, (current_index, record.clone()));
            }

            _ => {}
        }

        RuleResult::ok()
    }
}

// ---------------------------------------------------------------------------
// 11. ReconciliationRule — accuracy: value matches external knowledge base
// ---------------------------------------------------------------------------

/// Knowledge base adapter trait for reconciliation.
#[async_trait]
pub trait KnowledgeBaseAdapter: Send + Sync {
    async fn lookup(&self, value: &str, entity_type: Option<&str>) -> Vec<KBMatch>;
}

#[derive(Debug, Clone)]
pub struct KBMatch {
    pub matched_value: String,
    pub confidence: f64,
    pub source: String,
}

pub struct ReconciliationRule {
    kb: Option<Box<dyn KnowledgeBaseAdapter>>,
    cache: std::sync::Mutex<HashMap<String, KBMatch>>,
}

impl ReconciliationRule {
    pub fn new(kb: Option<Box<dyn KnowledgeBaseAdapter>>) -> Self {
        Self { kb, cache: std::sync::Mutex::new(HashMap::new()) }
    }

    pub fn clear_cache(&self) {
        self.cache.lock().unwrap().clear();
    }
}

#[async_trait]
impl QualityRulePlugin for ReconciliationRule {
    fn id(&self) -> &str { "reconciliation" }
    fn display_name(&self) -> &str { "External Reconciliation" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn dimension(&self) -> QualityDimension { QualityDimension::Accuracy }

    fn applies_to(&self, field: &FieldDef) -> bool {
        field.field_type == FieldType::String
    }

    async fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &Record,
        config: &RuleConfig,
    ) -> RuleResult {
        let severity = effective_severity(config, self.default_severity());
        let confidence_threshold = option_f64(config, "confidenceThreshold", 0.8);
        let entity_type = option_str(config, "entityType");
        let fuzzy_matching = option_bool(config, "fuzzyMatching", true);
        let source = option_str(config, "source").unwrap_or("default");

        let str_value = match value.as_str() {
            Some(s) if !s.trim().is_empty() => s,
            _ => return RuleResult::ok(),
        };

        let kb = match &self.kb {
            Some(k) => k,
            None => return RuleResult {
                valid: true, message: None, severity: None,
                diagnostics: Some(serde_json::json!({
                    "warning": "No knowledge base adapter configured; reconciliation skipped",
                    "source": source,
                })),
            },
        };

        // Check cache
        let cache_key = format!("{}:{}:{}", source, entity_type.unwrap_or("*"), str_value);
        {
            let cache = self.cache.lock().unwrap();
            if let Some(cached) = cache.get(&cache_key) {
                if cached.confidence >= confidence_threshold {
                    return RuleResult {
                        valid: true, message: None, severity: None,
                        diagnostics: Some(serde_json::json!({
                            "matchedValue": cached.matched_value,
                            "confidence": cached.confidence,
                            "fromCache": true,
                        })),
                    };
                }
                return RuleResult::fail_with_diagnostics(
                    format!(
                        "Field '{}' value '{}' has low confidence match ({:.1}% < {:.1}% threshold). Best: '{}'",
                        field.name, str_value, cached.confidence * 100.0, confidence_threshold * 100.0, cached.matched_value
                    ),
                    severity,
                    serde_json::json!({
                        "closestMatch": cached.matched_value,
                        "confidence": cached.confidence,
                        "threshold": confidence_threshold,
                    }),
                );
            }
        }

        // Query knowledge base
        let mut matches = kb.lookup(str_value, entity_type).await;

        if matches.is_empty() {
            return RuleResult::fail_with_diagnostics(
                format!("Field '{}' value '{}' not found in knowledge base (source: {})", field.name, str_value, source),
                severity,
                serde_json::json!({ "source": source, "matchCount": 0, "confidenceThreshold": confidence_threshold }),
            );
        }

        matches.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        let best = matches[0].clone();

        // Cache result
        self.cache.lock().unwrap().insert(cache_key, best.clone());

        if best.confidence >= confidence_threshold {
            return RuleResult {
                valid: true, message: None, severity: None,
                diagnostics: Some(serde_json::json!({
                    "matchedValue": best.matched_value,
                    "confidence": best.confidence,
                    "source": best.source,
                    "isExactMatch": (best.confidence - 1.0).abs() < f64::EPSILON,
                })),
            };
        }

        if !fuzzy_matching && best.confidence < 1.0 {
            return RuleResult::fail_with_diagnostics(
                format!("Field '{}' value '{}' does not exactly match any entry in {}", field.name, str_value, source),
                severity,
                serde_json::json!({ "closestMatch": best.matched_value, "confidence": best.confidence }),
            );
        }

        RuleResult::fail_with_diagnostics(
            format!(
                "Field '{}' value '{}' has low confidence match ({:.1}% < {:.1}% threshold). Best: '{}'",
                field.name, str_value, best.confidence * 100.0, confidence_threshold * 100.0, best.matched_value
            ),
            severity,
            serde_json::json!({
                "closestMatch": best.matched_value,
                "confidence": best.confidence,
                "source": best.source,
                "threshold": confidence_threshold,
                "suggestedCorrection": best.matched_value,
            }),
        )
    }
}

// ---------------------------------------------------------------------------
// Factory function — create provider by ID
// ---------------------------------------------------------------------------

/// Create a quality-rule provider by its unique identifier.
///
/// Returns `None` if the given ID does not match any known provider.
/// Note: `foreign_key` and `reconciliation` are created without adapters;
/// use their constructors directly for full functionality.
pub fn create_provider(id: &str) -> Option<Box<dyn QualityRulePlugin>> {
    match id {
        "required" => Some(Box::new(RequiredRule)),
        "unique" => Some(Box::new(UniqueRule::new())),
        "type_check" => Some(Box::new(TypeCheckRule)),
        "range" => Some(Box::new(RangeRule)),
        "pattern" => Some(Box::new(PatternRule)),
        "enum" => Some(Box::new(EnumRule)),
        "foreign_key" => Some(Box::new(ForeignKeyRule::new(None))),
        "cross_field" => Some(Box::new(CrossFieldRule)),
        "freshness" => Some(Box::new(FreshnessRule)),
        "no_duplicates" => Some(Box::new(NoDuplicatesRule::new())),
        "reconciliation" => Some(Box::new(ReconciliationRule::new(None))),
        _ => None,
    }
}

/// Return all available provider IDs.
pub fn available_providers() -> Vec<&'static str> {
    vec![
        "required", "unique", "type_check", "range", "pattern", "enum",
        "foreign_key", "cross_field", "freshness", "no_duplicates", "reconciliation",
    ]
}

/// Resolve all applicable quality rules for a given field definition.
pub fn resolve_rules_for_field(field: &FieldDef) -> Vec<Box<dyn QualityRulePlugin>> {
    available_providers()
        .iter()
        .filter_map(|id| {
            let provider = create_provider(id)?;
            if provider.applies_to(field) { Some(provider) } else { None }
        })
        .collect()
}

/// Validate a record against all applicable quality rules.
pub async fn validate_record(
    record: &Record,
    fields: &[FieldDef],
    rule_configs: &HashMap<String, RuleConfig>,
) -> HashMap<String, Vec<RuleResult>> {
    let mut results: HashMap<String, Vec<RuleResult>> = HashMap::new();
    let providers: Vec<Box<dyn QualityRulePlugin>> = available_providers()
        .iter()
        .filter_map(|id| create_provider(id))
        .collect();

    for field in fields {
        let mut field_results = Vec::new();
        let value = record.get(&field.name).unwrap_or(&serde_json::Value::Null);

        for provider in &providers {
            let config = rule_configs.get(provider.id()).cloned().unwrap_or_default();
            if !config.enabled { continue; }
            if !provider.applies_to(field) { continue; }

            let result = provider.validate(value, field, record, &config).await;
            if !result.valid {
                field_results.push(result);
            }
        }

        if !field_results.is_empty() {
            results.insert(field.name.clone(), field_results);
        }
    }

    results
}
