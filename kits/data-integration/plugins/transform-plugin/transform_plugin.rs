// Transform Plugin — value transformation implementations for the Data Integration Kit
// Provides pluggable data value transformations: type casting, string manipulation,
// format conversion, lookup resolution, and expression evaluation.
// See Data Integration Kit transform.concept for the parent Transform concept definition.

use std::collections::HashMap;
use std::fmt;

use chrono::{Datelike, NaiveDate, NaiveDateTime, TimeZone, Timelike, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// Describes the expected input or output type of a transform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeSpec {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub element_type: Option<String>,
    #[serde(default)]
    pub nullable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

/// Provider-specific configuration for a transform operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformConfig {
    pub provider_id: String,
    #[serde(default)]
    pub options: HashMap<String, Value>,
}

/// Errors that can occur during transformation.
#[derive(Debug)]
pub enum TransformError {
    InvalidInput { provider: String, detail: String },
    CastFailed { from: String, to: String, value: String },
    LookupMissing { key: String, provider: String },
    InvalidExpression { expression: String, detail: String },
    InvalidPattern { pattern: String, detail: String },
    DateParseFailed { value: String },
}

impl fmt::Display for TransformError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput { provider, detail } =>
                write!(f, "{provider}: invalid input — {detail}"),
            Self::CastFailed { from, to, value } =>
                write!(f, "Cannot cast {from} to {to}: \"{value}\""),
            Self::LookupMissing { key, provider } =>
                write!(f, "{provider}: key \"{key}\" not found"),
            Self::InvalidExpression { expression, detail } =>
                write!(f, "Invalid expression \"{expression}\": {detail}"),
            Self::InvalidPattern { pattern, detail } =>
                write!(f, "Invalid regex pattern \"{pattern}\": {detail}"),
            Self::DateParseFailed { value } =>
                write!(f, "Cannot parse date from \"{value}\""),
        }
    }
}

impl std::error::Error for TransformError {}

/// Interface every transform-plugin provider must implement.
pub trait TransformPlugin: Send + Sync {
    /// Unique identifier for this provider.
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// Transform a single value according to config.
    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError>;

    /// Describe the expected input type.
    fn input_type(&self) -> TypeSpec;

    /// Describe the produced output type.
    fn output_type(&self) -> TypeSpec;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn option_str<'a>(config: &'a TransformConfig, key: &str) -> Option<&'a str> {
    config.options.get(key).and_then(|v| v.as_str())
}

fn option_bool(config: &TransformConfig, key: &str, default: bool) -> bool {
    config.options.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
}

fn option_u64(config: &TransformConfig, key: &str, default: u64) -> u64 {
    config.options.get(key).and_then(|v| v.as_u64()).unwrap_or(default)
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        _ => serde_json::to_string(v).unwrap_or_default(),
    }
}

// ---------------------------------------------------------------------------
// 1. TypeCastTransform
// ---------------------------------------------------------------------------

pub struct TypeCastTransform;

impl TransformPlugin for TypeCastTransform {
    fn id(&self) -> &str { "type_cast" }
    fn display_name(&self) -> &str { "Type Cast" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: true, format: None }
    }

    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: true, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let target_type = option_str(config, "targetType").unwrap_or("string");
        let strict = option_bool(config, "strict", false);

        if value.is_null() {
            if strict {
                return Err(TransformError::InvalidInput {
                    provider: self.id().into(),
                    detail: "cannot cast null in strict mode".into(),
                });
            }
            return Ok(self.default_for_type(target_type));
        }

        match target_type {
            "string" => Ok(Value::String(value_to_string(value))),
            "number" | "float" | "double" => self.cast_to_number(value, false, strict),
            "int" => self.cast_to_number(value, true, strict),
            "boolean" | "bool" => Ok(Value::Bool(self.cast_to_boolean(value))),
            "array" => Ok(self.cast_to_array(value)),
            "json" => self.cast_to_json(value, strict),
            _ => Err(TransformError::InvalidInput {
                provider: self.id().into(),
                detail: format!("unknown target type \"{target_type}\""),
            }),
        }
    }
}

impl TypeCastTransform {
    fn cast_to_number(&self, value: &Value, as_int: bool, strict: bool) -> Result<Value, TransformError> {
        match value {
            Value::Number(n) => {
                if as_int {
                    Ok(Value::Number(serde_json::Number::from(n.as_i64().unwrap_or(n.as_f64().unwrap_or(0.0) as i64))))
                } else {
                    Ok(Value::Number(n.clone()))
                }
            }
            Value::Bool(b) => Ok(serde_json::json!(if *b { 1 } else { 0 })),
            Value::String(s) => {
                // Strip currency symbols, commas, whitespace
                let cleaned: String = s.chars()
                    .filter(|c| !matches!(c, '$' | '\u{20AC}' | '\u{00A3}' | '\u{00A5}' | ',' | ' '))
                    .collect();
                if as_int {
                    if let Ok(i) = cleaned.parse::<i64>() { return Ok(serde_json::json!(i)); }
                    if let Ok(f) = cleaned.parse::<f64>() { return Ok(serde_json::json!(f as i64)); }
                } else {
                    if let Ok(f) = cleaned.parse::<f64>() {
                        return Ok(serde_json::Number::from_f64(f)
                            .map(Value::Number)
                            .unwrap_or(serde_json::json!(0)));
                    }
                }
                if strict {
                    Err(TransformError::CastFailed { from: "String".into(), to: if as_int { "int" } else { "number" }.into(), value: s.clone() })
                } else {
                    Ok(serde_json::json!(0))
                }
            }
            _ => {
                if strict {
                    Err(TransformError::CastFailed { from: "unknown".into(), to: "number".into(), value: value_to_string(value) })
                } else {
                    Ok(serde_json::json!(0))
                }
            }
        }
    }

    fn cast_to_boolean(&self, value: &Value) -> bool {
        match value {
            Value::Bool(b) => *b,
            Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
            Value::String(s) => {
                let lower = s.to_lowercase();
                let lower = lower.trim();
                matches!(lower, "true" | "yes" | "1" | "on" | "t" | "y")
            }
            Value::Null => false,
            _ => true,
        }
    }

    fn cast_to_array(&self, value: &Value) -> Value {
        match value {
            Value::Array(arr) => Value::Array(arr.clone()),
            Value::String(s) => {
                if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(s) {
                    return Value::Array(arr);
                }
                Value::Array(s.split(',').map(|p| Value::String(p.trim().to_string())).collect())
            }
            _ => Value::Array(vec![value.clone()]),
        }
    }

    fn cast_to_json(&self, value: &Value, strict: bool) -> Result<Value, TransformError> {
        if let Value::String(s) = value {
            serde_json::from_str(s).map_err(|e| {
                if strict {
                    TransformError::InvalidInput { provider: self.id().into(), detail: format!("invalid JSON: {e}") }
                } else {
                    TransformError::InvalidInput { provider: self.id().into(), detail: format!("invalid JSON: {e}") }
                }
            })
        } else {
            Ok(value.clone())
        }
    }

    fn default_for_type(&self, type_name: &str) -> Value {
        match type_name {
            "string" => Value::String(String::new()),
            "number" | "int" | "float" | "double" => serde_json::json!(0),
            "boolean" | "bool" => Value::Bool(false),
            "array" => Value::Array(vec![]),
            _ => Value::Null,
        }
    }
}

// ---------------------------------------------------------------------------
// 2. DefaultValueTransform
// ---------------------------------------------------------------------------

pub struct DefaultValueTransform;

impl TransformPlugin for DefaultValueTransform {
    fn id(&self) -> &str { "default_value" }
    fn display_name(&self) -> &str { "Default Value" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: true, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let default_val = config.options.get("default").cloned().unwrap_or(Value::Null);
        let treat_empty_string = option_bool(config, "treatEmptyStringAsNull", true);
        let treat_zero = option_bool(config, "treatZeroAsNull", false);
        let treat_empty_array = option_bool(config, "treatEmptyArrayAsNull", false);

        if value.is_null() { return Ok(default_val); }
        if treat_empty_string {
            if let Some(s) = value.as_str() {
                if s.trim().is_empty() { return Ok(default_val); }
            }
        }
        if treat_zero {
            if let Some(n) = value.as_f64() {
                if n == 0.0 { return Ok(default_val); }
            }
        }
        if treat_empty_array {
            if let Some(arr) = value.as_array() {
                if arr.is_empty() { return Ok(default_val); }
            }
        }
        Ok(value.clone())
    }
}

// ---------------------------------------------------------------------------
// 3. LookupTransform
// ---------------------------------------------------------------------------

pub struct LookupTransform;

impl TransformPlugin for LookupTransform {
    fn id(&self) -> &str { "lookup" }
    fn display_name(&self) -> &str { "Lookup Table" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let table = config.options.get("table").and_then(|v| v.as_object()).cloned().unwrap_or_default();
        let case_sensitive = option_bool(config, "caseSensitive", false);
        let fallback = config.options.get("fallback");
        let error_on_missing = option_bool(config, "errorOnMissing", false);

        let key = value_to_string(value);

        if case_sensitive {
            if let Some(result) = table.get(&key) { return Ok(result.clone()); }
        } else {
            let lower_key = key.to_lowercase();
            for (k, v) in &table {
                if k.to_lowercase() == lower_key { return Ok(v.clone()); }
            }
        }

        if error_on_missing {
            return Err(TransformError::LookupMissing { key, provider: self.id().into() });
        }

        Ok(fallback.cloned().unwrap_or_else(|| value.clone()))
    }
}

// ---------------------------------------------------------------------------
// 4. MigrationLookupTransform
// ---------------------------------------------------------------------------

pub struct MigrationLookupTransform;

impl TransformPlugin for MigrationLookupTransform {
    fn id(&self) -> &str { "migration_lookup" }
    fn display_name(&self) -> &str { "Migration Lookup (Provenance)" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("id".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("uuid".into()) }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let provenance_map = config.options.get("provenanceMap")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        let entity_type = option_str(config, "entityType").unwrap_or("");
        let error_on_missing = option_bool(config, "errorOnMissing", true);
        let fallback_prefix = option_str(config, "fallbackPrefix").unwrap_or("");

        let old_id = value_to_string(value);
        if old_id.is_empty() { return Ok(Value::Null); }

        let composite_key = if entity_type.is_empty() {
            old_id.clone()
        } else {
            format!("{entity_type}:{old_id}")
        };

        if let Some(resolved) = provenance_map.get(&composite_key).or_else(|| provenance_map.get(&old_id)) {
            return Ok(resolved.clone());
        }

        if error_on_missing {
            return Err(TransformError::LookupMissing { key: old_id, provider: self.id().into() });
        }

        if !fallback_prefix.is_empty() {
            return Ok(Value::String(format!("{fallback_prefix}{old_id}")));
        }

        Ok(Value::Null)
    }
}

// ---------------------------------------------------------------------------
// 5. ConcatTransform
// ---------------------------------------------------------------------------

pub struct ConcatTransform;

impl TransformPlugin for ConcatTransform {
    fn id(&self) -> &str { "concat" }
    fn display_name(&self) -> &str { "Concatenate" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "array".into(), element_type: Some("any".into()), nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let separator = option_str(config, "separator").unwrap_or(" ");
        let skip_nulls = option_bool(config, "skipNulls", true);
        let skip_empty = option_bool(config, "skipEmpty", true);

        // Template interpolation for object values
        if let Some(template) = option_str(config, "template") {
            if let Some(obj) = value.as_object() {
                let mut result = template.to_string();
                for (k, v) in obj {
                    result = result.replace(&format!("{{{k}}}"), &value_to_string(v));
                }
                return Ok(Value::String(result));
            }
        }

        let values: Vec<&Value> = match value {
            Value::Array(arr) => arr.iter().collect(),
            _ => vec![value],
        };

        let mut parts: Vec<String> = Vec::new();
        for v in values {
            if skip_nulls && v.is_null() { continue; }
            let s = value_to_string(v);
            if skip_empty && s.trim().is_empty() { continue; }
            parts.push(s);
        }

        Ok(Value::String(parts.join(separator)))
    }
}

// ---------------------------------------------------------------------------
// 6. SplitTransform
// ---------------------------------------------------------------------------

pub struct SplitTransform;

impl TransformPlugin for SplitTransform {
    fn id(&self) -> &str { "split" }
    fn display_name(&self) -> &str { "Split String" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "array".into(), element_type: Some("string".into()), nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let delimiter = option_str(config, "delimiter").unwrap_or(",");
        let is_regex = option_bool(config, "regex", false);
        let trim_parts = option_bool(config, "trim", true);
        let remove_empty = option_bool(config, "removeEmpty", true);
        let limit = config.options.get("limit").and_then(|v| v.as_u64()).map(|n| n as usize);

        let s = value_to_string(value);
        if s.is_empty() { return Ok(Value::Array(vec![])); }

        let mut parts: Vec<String> = if is_regex {
            match Regex::new(delimiter) {
                Ok(re) => re.split(&s).map(|p| p.to_string()).collect(),
                Err(_) => vec![s],
            }
        } else {
            s.split(delimiter).map(|p| p.to_string()).collect()
        };

        if let Some(limit) = limit {
            parts.truncate(limit);
        }
        if trim_parts { parts = parts.into_iter().map(|p| p.trim().to_string()).collect(); }
        if remove_empty { parts.retain(|p| !p.is_empty()); }

        Ok(Value::Array(parts.into_iter().map(Value::String).collect()))
    }
}

// ---------------------------------------------------------------------------
// 7. FormatTransform
// ---------------------------------------------------------------------------

pub struct FormatTransform;

impl TransformPlugin for FormatTransform {
    fn id(&self) -> &str { "format" }
    fn display_name(&self) -> &str { "String Format" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let template = option_str(config, "template").unwrap_or("{value}");
        let mut result = template.to_string();

        // Object interpolation
        if let Some(obj) = value.as_object() {
            for (key, val) in obj {
                result = result.replace(&format!("{{{key}}}"), &value_to_string(val));
            }
            return Ok(Value::String(result));
        }

        // Scalar interpolation
        let display_val = value_to_string(value);
        result = result.replace("{value}", &display_val);
        result = result.replace("{0}", &display_val);

        // Array element interpolation
        if let Some(arr) = value.as_array() {
            for (idx, item) in arr.iter().enumerate() {
                result = result.replace(&format!("{{{idx}}}"), &value_to_string(item));
            }
        }

        Ok(Value::String(result))
    }
}

// ---------------------------------------------------------------------------
// 8. SlugifyTransform
// ---------------------------------------------------------------------------

pub struct SlugifyTransform;

impl TransformPlugin for SlugifyTransform {
    fn id(&self) -> &str { "slugify" }
    fn display_name(&self) -> &str { "Slugify" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("slug".into()) }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let separator = option_str(config, "separator").unwrap_or("-");
        let max_length = option_u64(config, "maxLength", 200) as usize;
        let lowercase = option_bool(config, "lowercase", true);

        let mut slug = value_to_string(value);

        // 1. Transliterate common special characters and diacritics
        let char_map: Vec<(&str, &str)> = vec![
            ("\u{00E6}", "ae"), ("\u{00C6}", "AE"), ("\u{00F8}", "o"), ("\u{00D8}", "O"),
            ("\u{00DF}", "ss"), ("\u{00F0}", "d"), ("\u{00D0}", "D"),
            ("\u{00FE}", "th"), ("\u{00DE}", "TH"),
            ("\u{0142}", "l"), ("\u{0141}", "L"),
            ("\u{00E0}", "a"), ("\u{00E1}", "a"), ("\u{00E2}", "a"), ("\u{00E3}", "a"), ("\u{00E4}", "a"),
            ("\u{00E8}", "e"), ("\u{00E9}", "e"), ("\u{00EA}", "e"), ("\u{00EB}", "e"),
            ("\u{00EC}", "i"), ("\u{00ED}", "i"), ("\u{00EE}", "i"), ("\u{00EF}", "i"),
            ("\u{00F2}", "o"), ("\u{00F3}", "o"), ("\u{00F4}", "o"), ("\u{00F5}", "o"), ("\u{00F6}", "o"),
            ("\u{00F9}", "u"), ("\u{00FA}", "u"), ("\u{00FB}", "u"), ("\u{00FC}", "u"),
            ("\u{00F1}", "n"), ("\u{00D1}", "N"), ("\u{00E7}", "c"), ("\u{00C7}", "C"),
            ("&", "and"), ("@", "at"), ("#", "number"),
        ];
        for (from, to) in &char_map {
            slug = slug.replace(from, to);
        }

        // 2. Unicode normalization: remove combining marks (U+0300..U+036F)
        slug = slug.chars()
            .filter(|c| !('\u{0300}'..='\u{036F}').contains(c))
            .collect();

        // 3. Case conversion
        if lowercase { slug = slug.to_lowercase(); }

        // 4. Replace non-alphanumeric characters with separator
        if let Ok(re) = Regex::new(r"[^a-zA-Z0-9]+") {
            slug = re.replace_all(&slug, separator).to_string();
        }

        // 5. Collapse consecutive separators
        let escaped_sep = regex::escape(separator);
        if let Ok(re) = Regex::new(&format!("{escaped_sep}{{2,}}")) {
            slug = re.replace_all(&slug, separator).to_string();
        }

        // 6. Trim separators from start and end
        while slug.starts_with(separator) { slug = slug[separator.len()..].to_string(); }
        while slug.ends_with(separator) { slug = slug[..slug.len() - separator.len()].to_string(); }

        // 7. Enforce max length with word-boundary awareness
        if slug.len() > max_length {
            slug = slug[..max_length].to_string();
            if let Some(last_sep) = slug.rfind(separator) {
                if last_sep > (max_length as f64 * 0.7) as usize {
                    slug = slug[..last_sep].to_string();
                }
            }
        }

        Ok(Value::String(slug))
    }
}

// ---------------------------------------------------------------------------
// 9. HtmlToMarkdownTransform
// ---------------------------------------------------------------------------

pub struct HtmlToMarkdownTransform;

impl TransformPlugin for HtmlToMarkdownTransform {
    fn id(&self) -> &str { "html_to_markdown" }
    fn display_name(&self) -> &str { "HTML to Markdown" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("html".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("markdown".into()) }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let bullet_marker = option_str(config, "bulletMarker").unwrap_or("-");
        let mut html = value_to_string(value);

        // Code blocks: <pre><code class="language-X">...</code></pre>
        if let Ok(re) = Regex::new(r#"(?is)<pre[^>]*>\s*<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>(.*?)</code>\s*</pre>"#) {
            html = re.replace_all(&html, |caps: &regex::Captures| {
                let lang = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let code = Self::decode_entities(caps.get(2).map(|m| m.as_str()).unwrap_or(""));
                format!("\n\n```{lang}\n{code}\n```\n\n")
            }).to_string();
        }

        // Headings h1-h6
        for level in 1..=6 {
            let prefix = "#".repeat(level);
            let pattern = format!(r"(?is)<h{level}[^>]*>(.*?)</h{level}>");
            if let Ok(re) = Regex::new(&pattern) {
                html = re.replace_all(&html, |caps: &regex::Captures| {
                    let text = Self::strip_tags(caps.get(1).map(|m| m.as_str()).unwrap_or("")).trim().to_string();
                    format!("\n\n{prefix} {text}\n\n")
                }).to_string();
            }
        }

        // Blockquotes
        if let Ok(re) = Regex::new(r"(?is)<blockquote[^>]*>(.*?)</blockquote>") {
            html = re.replace_all(&html, |caps: &regex::Captures| {
                let text = Self::strip_tags(caps.get(1).map(|m| m.as_str()).unwrap_or(""));
                let lines: Vec<String> = text.trim().lines().map(|l| format!("> {}", l.trim())).collect();
                format!("\n\n{}\n\n", lines.join("\n"))
            }).to_string();
        }

        // Ordered lists
        if let Ok(re) = Regex::new(r"(?is)<ol[^>]*>(.*?)</ol>") {
            html = re.replace_all(&html, |caps: &regex::Captures| {
                let content = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let li_re = Regex::new(r"(?is)<li[^>]*>(.*?)</li>").unwrap();
                let mut counter = 0;
                let mut result = String::from("\n\n");
                for li_caps in li_re.captures_iter(content) {
                    counter += 1;
                    let text = Self::strip_tags(li_caps.get(1).map(|m| m.as_str()).unwrap_or("")).trim().to_string();
                    result.push_str(&format!("{counter}. {text}\n"));
                }
                result.push('\n');
                result
            }).to_string();
        }

        // Unordered lists
        if let Ok(re) = Regex::new(r"(?is)<ul[^>]*>(.*?)</ul>") {
            html = re.replace_all(&html, |caps: &regex::Captures| {
                let content = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let li_re = Regex::new(r"(?is)<li[^>]*>(.*?)</li>").unwrap();
                let mut result = String::from("\n\n");
                for li_caps in li_re.captures_iter(content) {
                    let text = Self::strip_tags(li_caps.get(1).map(|m| m.as_str()).unwrap_or("")).trim().to_string();
                    result.push_str(&format!("{bullet_marker} {text}\n"));
                }
                result.push('\n');
                result
            }).to_string();
        }

        // Paragraphs
        if let Ok(re) = Regex::new(r"(?is)<p[^>]*>(.*?)</p>") {
            html = re.replace_all(&html, "\n\n$1\n\n").to_string();
        }

        // Horizontal rules
        if let Ok(re) = Regex::new(r"(?i)<hr\s*/?>") {
            html = re.replace_all(&html, "\n\n---\n\n").to_string();
        }

        // Line breaks
        if let Ok(re) = Regex::new(r"(?i)<br\s*/?>") {
            html = re.replace_all(&html, "  \n").to_string();
        }

        // Links
        if let Ok(re) = Regex::new(r#"(?is)<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>"#) {
            html = re.replace_all(&html, |caps: &regex::Captures| {
                let href = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let text = Self::strip_tags(caps.get(2).map(|m| m.as_str()).unwrap_or("")).trim().to_string();
                format!("[{text}]({href})")
            }).to_string();
        }

        // Images
        if let Ok(re) = Regex::new(r#"(?i)<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*/?>""#) {
            html = re.replace_all(&html, "![$2]($1)").to_string();
        }

        // Bold
        for tag in &["strong", "b"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = Regex::new(&pattern) {
                html = re.replace_all(&html, "**$1**").to_string();
            }
        }

        // Italic
        for tag in &["em", "i"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = Regex::new(&pattern) {
                html = re.replace_all(&html, "_$1_").to_string();
            }
        }

        // Strikethrough
        for tag in &["del", "s", "strike"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = Regex::new(&pattern) {
                html = re.replace_all(&html, "~~$1~~").to_string();
            }
        }

        // Inline code
        if let Ok(re) = Regex::new(r"(?is)<code[^>]*>(.*?)</code>") {
            html = re.replace_all(&html, "`$1`").to_string();
        }

        // Strip remaining tags
        html = Self::strip_tags(&html);

        // Decode entities
        html = Self::decode_entities(&html);

        // Collapse excessive newlines
        if let Ok(re) = Regex::new(r"\n{3,}") {
            html = re.replace_all(&html, "\n\n").to_string();
        }

        Ok(Value::String(html.trim().to_string()))
    }
}

impl HtmlToMarkdownTransform {
    fn strip_tags(html: &str) -> String {
        Regex::new(r"<[^>]+>")
            .map(|re| re.replace_all(html, "").to_string())
            .unwrap_or_else(|_| html.to_string())
    }

    fn decode_entities(html: &str) -> String {
        html.replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
    }
}

// ---------------------------------------------------------------------------
// 10. MarkdownToHtmlTransform
// ---------------------------------------------------------------------------

pub struct MarkdownToHtmlTransform;

impl TransformPlugin for MarkdownToHtmlTransform {
    fn id(&self) -> &str { "markdown_to_html" }
    fn display_name(&self) -> &str { "Markdown to HTML" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("markdown".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("html".into()) }
    }

    fn transform(&self, value: &Value, _config: &TransformConfig) -> Result<Value, TransformError> {
        let mut md = value_to_string(value);

        // Fenced code blocks
        if let Ok(re) = Regex::new(r"```(\w*)\n([\s\S]*?)\n```") {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let lang = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let code = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                let escaped = code.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
                let lang_attr = if lang.is_empty() { String::new() } else { format!(r#" class="language-{lang}""#) };
                format!("<pre><code{lang_attr}>{escaped}</code></pre>")
            }).to_string();
        }

        // ATX headings
        if let Ok(re) = Regex::new(r"(?m)^(#{1,6})\s+(.+?)(?:\s+#+)?$") {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let level = caps.get(1).map(|m| m.as_str().len()).unwrap_or(1);
                let text = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");
                format!("<h{level}>{text}</h{level}>")
            }).to_string();
        }

        // Horizontal rules
        if let Ok(re) = Regex::new(r"(?m)^(?:[-*_]\s*){3,}$") {
            md = re.replace_all(&md, "<hr />").to_string();
        }

        // Blockquotes
        if let Ok(re) = Regex::new(r"(?m)(?:^>\s?.+\n?)+") {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let block = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let text: String = block.lines()
                    .map(|l| l.strip_prefix("> ").or_else(|| l.strip_prefix(">")).unwrap_or(l))
                    .collect::<Vec<_>>()
                    .join("\n");
                format!("<blockquote><p>{}</p></blockquote>", text.trim())
            }).to_string();
        }

        // Unordered lists
        if let Ok(re) = Regex::new(r"(?m)(?:^[*+\-]\s+.+\n?)+") {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let block = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let items: Vec<String> = block.trim().lines().map(|line| {
                    let text = Regex::new(r"^[*+\-]\s+").unwrap().replace(line, "").to_string();
                    format!("<li>{text}</li>")
                }).collect();
                format!("<ul>\n{}\n</ul>", items.join("\n"))
            }).to_string();
        }

        // Ordered lists
        if let Ok(re) = Regex::new(r"(?m)(?:^\d+\.\s+.+\n?)+") {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let block = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let items: Vec<String> = block.trim().lines().map(|line| {
                    let text = Regex::new(r"^\d+\.\s+").unwrap().replace(line, "").to_string();
                    format!("<li>{text}</li>")
                }).collect();
                format!("<ol>\n{}\n</ol>", items.join("\n"))
            }).to_string();
        }

        // Images
        if let Ok(re) = Regex::new(r#"!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)"#) {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let alt = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let src = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                let title = caps.get(3).map(|m| format!(r#" title="{}""#, m.as_str())).unwrap_or_default();
                format!(r#"<img src="{src}" alt="{alt}"{title} />"#)
            }).to_string();
        }

        // Links
        if let Ok(re) = Regex::new(r#"\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)"#) {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let text = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let href = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                let title = caps.get(3).map(|m| format!(r#" title="{}""#, m.as_str())).unwrap_or_default();
                format!(r#"<a href="{href}"{title}>{text}</a>"#)
            }).to_string();
        }

        // Bold: **text** or __text__
        if let Ok(re) = Regex::new(r"(\*\*|__)(.+?)\1") {
            md = re.replace_all(&md, "<strong>$2</strong>").to_string();
        }

        // Italic: *text* or _text_
        if let Ok(re) = Regex::new(r"(\*|_)(.+?)\1") {
            md = re.replace_all(&md, "<em>$2</em>").to_string();
        }

        // Strikethrough
        if let Ok(re) = Regex::new(r"~~(.+?)~~") {
            md = re.replace_all(&md, "<del>$1</del>").to_string();
        }

        // Inline code
        if let Ok(re) = Regex::new(r"`([^`]+)`") {
            md = re.replace_all(&md, "<code>$1</code>").to_string();
        }

        Ok(Value::String(md))
    }
}

// ---------------------------------------------------------------------------
// 11. StripTagsTransform
// ---------------------------------------------------------------------------

pub struct StripTagsTransform;

impl TransformPlugin for StripTagsTransform {
    fn id(&self) -> &str { "strip_tags" }
    fn display_name(&self) -> &str { "Strip HTML Tags" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("html".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let allowed_tags: Vec<String> = config.options.get("allowedTags")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_lowercase())).collect())
            .unwrap_or_default();
        let decode_entities = option_bool(config, "decodeEntities", true);
        let collapse_whitespace = option_bool(config, "collapseWhitespace", true);

        let mut html = value_to_string(value);

        if allowed_tags.is_empty() {
            // Remove all tags
            if let Ok(re) = Regex::new(r"<[^>]+>") {
                html = re.replace_all(&html, "").to_string();
            }
        } else {
            // Remove only non-allowlisted tags
            // Closing tags
            if let Ok(re) = Regex::new(r"</([a-zA-Z][a-zA-Z0-9]*)\s*>") {
                html = re.replace_all(&html, |caps: &regex::Captures| {
                    let tag = caps.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
                    if allowed_tags.contains(&tag) {
                        caps.get(0).map(|m| m.as_str().to_string()).unwrap_or_default()
                    } else {
                        String::new()
                    }
                }).to_string();
            }
            // Opening tags
            if let Ok(re) = Regex::new(r"<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\s*/?>") {
                html = re.replace_all(&html, |caps: &regex::Captures| {
                    let tag = caps.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
                    if allowed_tags.contains(&tag) {
                        caps.get(0).map(|m| m.as_str().to_string()).unwrap_or_default()
                    } else {
                        String::new()
                    }
                }).to_string();
            }
        }

        if decode_entities {
            html = html.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'");
        }

        if collapse_whitespace {
            if let Ok(re) = Regex::new(r"\s+") {
                html = re.replace_all(&html, " ").to_string();
            }
            html = html.trim().to_string();
        }

        Ok(Value::String(html))
    }
}

// ---------------------------------------------------------------------------
// 12. TruncateTransform
// ---------------------------------------------------------------------------

pub struct TruncateTransform;

impl TransformPlugin for TruncateTransform {
    fn id(&self) -> &str { "truncate" }
    fn display_name(&self) -> &str { "Truncate" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let max_length = option_u64(config, "maxLength", 100) as usize;
        let ellipsis = option_str(config, "ellipsis").unwrap_or("...");
        let position = option_str(config, "position").unwrap_or("end");
        let word_boundary = option_bool(config, "wordBoundary", false);

        let s = value_to_string(value);
        let chars: Vec<char> = s.chars().collect();
        if chars.len() <= max_length { return Ok(Value::String(s)); }

        let ellipsis_len = ellipsis.chars().count();
        let trunc_len = if max_length > ellipsis_len { max_length - ellipsis_len } else { 0 };
        if trunc_len == 0 {
            return Ok(Value::String(ellipsis.chars().take(max_length).collect()));
        }

        let result = match position {
            "start" => {
                let start = chars.len() - trunc_len;
                format!("{}{}", ellipsis, chars[start..].iter().collect::<String>())
            }
            "middle" => {
                let half = trunc_len / 2;
                let first: String = chars[..half].iter().collect();
                let second: String = chars[chars.len() - (trunc_len - half)..].iter().collect();
                format!("{first}{ellipsis}{second}")
            }
            _ => {
                let mut truncated: String = chars[..trunc_len].iter().collect();
                if word_boundary {
                    if let Some(last_space) = truncated.rfind(' ') {
                        if last_space > (trunc_len as f64 * 0.5) as usize {
                            truncated = truncated[..last_space].to_string();
                        }
                    }
                }
                format!("{truncated}{ellipsis}")
            }
        };

        Ok(Value::String(result))
    }
}

// ---------------------------------------------------------------------------
// 13. RegexReplaceTransform
// ---------------------------------------------------------------------------

pub struct RegexReplaceTransform;

impl TransformPlugin for RegexReplaceTransform {
    fn id(&self) -> &str { "regex_replace" }
    fn display_name(&self) -> &str { "Regex Replace" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let pattern = option_str(config, "pattern").unwrap_or("");
        let replacement = option_str(config, "replacement").unwrap_or("");
        let case_insensitive = option_bool(config, "caseInsensitive", false);

        if pattern.is_empty() { return Ok(value.clone()); }

        let s = value_to_string(value);
        let full_pattern = if case_insensitive {
            format!("(?i){pattern}")
        } else {
            pattern.to_string()
        };

        let re = Regex::new(&full_pattern).map_err(|e| TransformError::InvalidPattern {
            pattern: pattern.to_string(),
            detail: e.to_string(),
        })?;

        // The regex crate uses $1, $2 for captures which matches common conventions
        Ok(Value::String(re.replace_all(&s, replacement).to_string()))
    }
}

// ---------------------------------------------------------------------------
// 14. DateFormatTransform
// ---------------------------------------------------------------------------

pub struct DateFormatTransform;

impl TransformPlugin for DateFormatTransform {
    fn id(&self) -> &str { "date_format" }
    fn display_name(&self) -> &str { "Date Format" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("date".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let output_format = option_str(config, "outputFormat").unwrap_or("YYYY-MM-DD");

        let date = self.parse_date(value).ok_or_else(|| TransformError::DateParseFailed {
            value: value_to_string(value),
        })?;

        let formatted = self.format_date(&date, output_format);
        Ok(Value::String(formatted))
    }
}

impl DateFormatTransform {
    fn parse_date(&self, value: &Value) -> Option<NaiveDateTime> {
        match value {
            Value::Number(n) => {
                let ts = n.as_f64()?;
                let secs = if ts < 1e12 { ts as i64 } else { (ts / 1000.0) as i64 };
                chrono::DateTime::from_timestamp(secs, 0).map(|dt| dt.naive_utc())
            }
            Value::String(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() { return None; }

                // Relative dates
                if let Some(dt) = self.parse_relative(trimmed) { return Some(dt); }

                // ISO 8601: 2026-02-23T10:30:00Z
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(trimmed) {
                    return Some(dt.naive_utc());
                }

                // yyyy-MM-dd
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }
                // yyyy-MM-dd HH:mm:ss
                if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S") {
                    return Some(dt);
                }

                // US format: MM/DD/YYYY
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%m/%d/%Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }

                // European: DD.MM.YYYY
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%d.%m.%Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }
                // European: DD-MM-YYYY
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%d-%m-%Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }

                // "Feb 23, 2026" / "23 Feb 2026"
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%b %d, %Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%d %b %Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }
                if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%B %d, %Y") {
                    return Some(d.and_hms_opt(0, 0, 0)?);
                }

                // Unix timestamp as string
                if let Ok(ts) = trimmed.parse::<f64>() {
                    let secs = if ts < 1e12 { ts as i64 } else { (ts / 1000.0) as i64 };
                    return chrono::DateTime::from_timestamp(secs, 0).map(|dt| dt.naive_utc());
                }

                None
            }
            _ => None,
        }
    }

    fn parse_relative(&self, s: &str) -> Option<NaiveDateTime> {
        let lower = s.to_lowercase();
        let now = Utc::now().naive_utc();

        if lower == "now" || lower == "today" { return Some(now); }
        if lower == "yesterday" { return Some(now - chrono::Duration::days(1)); }
        if lower == "tomorrow" { return Some(now + chrono::Duration::days(1)); }

        // "N unit(s) ago"
        let ago_re = Regex::new(r"^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$").ok()?;
        if let Some(caps) = ago_re.captures(&lower) {
            let amount: i64 = caps.get(1)?.as_str().parse().ok()?;
            let unit = caps.get(2)?.as_str();
            return Some(self.offset_date(now, -amount, unit));
        }

        // "in N unit(s)"
        let in_re = Regex::new(r"^in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?$").ok()?;
        if let Some(caps) = in_re.captures(&lower) {
            let amount: i64 = caps.get(1)?.as_str().parse().ok()?;
            let unit = caps.get(2)?.as_str();
            return Some(self.offset_date(now, amount, unit));
        }

        None
    }

    fn offset_date(&self, date: NaiveDateTime, amount: i64, unit: &str) -> NaiveDateTime {
        match unit {
            "second" => date + chrono::Duration::seconds(amount),
            "minute" => date + chrono::Duration::minutes(amount),
            "hour" => date + chrono::Duration::hours(amount),
            "day" => date + chrono::Duration::days(amount),
            "week" => date + chrono::Duration::weeks(amount),
            "month" => {
                let months = date.month0() as i64 + amount;
                let new_year = date.year() + (months / 12) as i32;
                let new_month = ((months % 12 + 12) % 12) as u32 + 1;
                date.with_year(new_year).and_then(|d| d.with_month(new_month)).unwrap_or(date)
            }
            "year" => date.with_year(date.year() + amount as i32).unwrap_or(date),
            _ => date,
        }
    }

    fn format_date(&self, date: &NaiveDateTime, format: &str) -> String {
        static MONTH_SHORT: &[&str] = &[
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        static MONTH_LONG: &[&str] = &[
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];
        static DAY_SHORT: &[&str] = &["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        static DAY_LONG: &[&str] = &["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        let year = date.year();
        let month = date.month();
        let day = date.day();
        let hour = date.hour();
        let minute = date.minute();
        let second = date.second();
        let weekday = date.weekday().num_days_from_monday() as usize;

        let mut result = format.to_string();
        result = result.replace("YYYY", &format!("{year:04}"));
        result = result.replace("YY", &format!("{:02}", year % 100));
        result = result.replace("MMMM", MONTH_LONG[(month - 1) as usize]);
        result = result.replace("MMM", MONTH_SHORT[(month - 1) as usize]);
        result = result.replace("MM", &format!("{month:02}"));
        result = result.replace("dddd", DAY_LONG[weekday]);
        result = result.replace("ddd", DAY_SHORT[weekday]);
        result = result.replace("DD", &format!("{day:02}"));
        result = result.replace("HH", &format!("{hour:02}"));
        result = result.replace("hh", &format!("{:02}", if hour > 12 { hour - 12 } else if hour == 0 { 12 } else { hour }));
        result = result.replace("mm", &format!("{minute:02}"));
        result = result.replace("ss", &format!("{second:02}"));
        result = result.replace("A", if hour >= 12 { "PM" } else { "AM" });
        result = result.replace('a', if hour >= 12 { "pm" } else { "am" });

        result
    }
}

// ---------------------------------------------------------------------------
// 15. JsonExtractTransform
// ---------------------------------------------------------------------------

pub struct JsonExtractTransform;

impl TransformPlugin for JsonExtractTransform {
    fn id(&self) -> &str { "json_extract" }
    fn display_name(&self) -> &str { "JSON Extract" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "string".into(), element_type: None, nullable: false, format: Some("json".into()) }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: true, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let path = option_str(config, "path").unwrap_or("$");
        let default_value = config.options.get("default").cloned().unwrap_or(Value::Null);
        let parse_input = option_bool(config, "parseInput", true);

        let data = if let Value::String(s) = value {
            if parse_input {
                serde_json::from_str(s).map_err(|e| TransformError::InvalidInput {
                    provider: self.id().into(),
                    detail: format!("invalid JSON: {e}"),
                })?
            } else {
                value.clone()
            }
        } else {
            value.clone()
        };

        let result = self.evaluate_path(&data, path);
        Ok(if result.is_null() { default_value } else { result })
    }
}

impl JsonExtractTransform {
    fn evaluate_path(&self, data: &Value, path: &str) -> Value {
        if path == "$" || path.is_empty() { return data.clone(); }

        let mut normalized = path.to_string();
        if normalized.starts_with("$.") { normalized = normalized[2..].to_string(); }
        else if normalized.starts_with('$') { normalized = normalized[1..].to_string(); }

        // Recursive descent
        if normalized.starts_with("..") {
            let key = normalized[2..].split(|c: char| c == '.' || c == '[').next().unwrap_or("");
            return self.recursive_descend(data, key);
        }

        let segments = self.parse_path(&normalized);
        let mut current = data.clone();

        for segment in segments {
            if current.is_null() { return Value::Null; }

            if segment == "*" {
                return match &current {
                    Value::Array(arr) => Value::Array(arr.clone()),
                    Value::Object(obj) => Value::Array(obj.values().cloned().collect()),
                    _ => Value::Null,
                };
            }

            current = match &current {
                Value::Array(arr) => {
                    if let Ok(idx) = segment.parse::<i64>() {
                        let effective = if idx < 0 { arr.len() as i64 + idx } else { idx } as usize;
                        arr.get(effective).cloned().unwrap_or(Value::Null)
                    } else {
                        // Map over array elements
                        Value::Array(arr.iter().filter_map(|item| {
                            item.as_object().and_then(|obj| obj.get(&segment)).cloned()
                        }).collect())
                    }
                }
                Value::Object(obj) => obj.get(&segment).cloned().unwrap_or(Value::Null),
                _ => Value::Null,
            };
        }

        current
    }

    fn parse_path(&self, path: &str) -> Vec<String> {
        let mut segments = Vec::new();
        let re = Regex::new(r#"\.?([^.\[\]]+)|\[(\d+|"[^"]+"|'[^']+'|\*)\]"#).unwrap();
        for caps in re.captures_iter(path) {
            let segment = caps.get(1).or_else(|| caps.get(2))
                .map(|m| m.as_str().trim_matches(|c: char| c == '"' || c == '\'').to_string())
                .unwrap_or_default();
            if !segment.is_empty() {
                segments.push(segment);
            }
        }
        segments
    }

    fn recursive_descend(&self, data: &Value, key: &str) -> Value {
        let mut results = Vec::new();
        self.search(data, key, &mut results);
        match results.len() {
            0 => Value::Null,
            1 => results.into_iter().next().unwrap(),
            _ => Value::Array(results),
        }
    }

    fn search(&self, obj: &Value, key: &str, results: &mut Vec<Value>) {
        match obj {
            Value::Object(map) => {
                if let Some(val) = map.get(key) { results.push(val.clone()); }
                for val in map.values() { self.search(val, key, results); }
            }
            Value::Array(arr) => {
                for item in arr { self.search(item, key, results); }
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------------------
// 16. ExpressionTransform
// ---------------------------------------------------------------------------

pub struct ExpressionTransform;

impl TransformPlugin for ExpressionTransform {
    fn id(&self) -> &str { "expression" }
    fn display_name(&self) -> &str { "Expression" }

    fn input_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: false, format: None }
    }
    fn output_type(&self) -> TypeSpec {
        TypeSpec { kind: "any".into(), element_type: None, nullable: true, format: None }
    }

    fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let expression = option_str(config, "expression").unwrap_or("");
        let variables = config.options.get("variables")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        if expression.is_empty() {
            return Err(TransformError::InvalidExpression {
                expression: String::new(),
                detail: "expression is required".into(),
            });
        }

        // Build context: merge value properties and explicit variables
        let mut context: HashMap<String, Value> = HashMap::new();
        context.insert("value".into(), value.clone());
        for (k, v) in &variables { context.insert(k.clone(), v.clone()); }
        if let Some(obj) = value.as_object() {
            for (k, v) in obj { context.insert(k.clone(), v.clone()); }
        }

        self.evaluate(expression, &context)
    }
}

impl ExpressionTransform {
    /// Simple expression evaluator for arithmetic on numeric values.
    /// Substitutes variable names with their numeric values and evaluates
    /// basic arithmetic: +, -, *, /, %
    fn evaluate(&self, expr: &str, context: &HashMap<String, Value>) -> Result<Value, TransformError> {
        let mut processed = expr.to_string();

        // Sort keys by length (longest first) to avoid partial replacements
        let mut keys: Vec<&String> = context.keys().collect();
        keys.sort_by(|a, b| b.len().cmp(&a.len()));

        // Substitute variables with numeric values
        let mut all_numeric = true;
        for key in &keys {
            if let Some(val) = context.get(*key) {
                if let Some(n) = val.as_f64() {
                    processed = processed.replace(key.as_str(), &n.to_string());
                } else if let Some(s) = val.as_str() {
                    processed = processed.replace(key.as_str(), &format!("\"{s}\""));
                    all_numeric = false;
                } else {
                    all_numeric = false;
                }
            }
        }

        // If all values are numeric, evaluate arithmetic
        if all_numeric {
            if let Some(result) = self.eval_arithmetic(&processed) {
                return Ok(if result.fract() == 0.0 {
                    serde_json::json!(result as i64)
                } else {
                    serde_json::Number::from_f64(result)
                        .map(Value::Number)
                        .unwrap_or(serde_json::json!(result as i64))
                });
            }
        }

        // Handle string concatenation
        if processed.contains('"') && processed.contains('+') {
            let parts: Vec<String> = processed.split('+').map(|part| {
                let trimmed = part.trim();
                if trimmed.starts_with('"') && trimmed.ends_with('"') {
                    trimmed[1..trimmed.len()-1].to_string()
                } else {
                    trimmed.to_string()
                }
            }).collect();
            return Ok(Value::String(parts.join("")));
        }

        Err(TransformError::InvalidExpression {
            expression: expr.to_string(),
            detail: "could not evaluate expression".into(),
        })
    }

    /// Basic arithmetic evaluator supporting +, -, *, /, %, parentheses.
    fn eval_arithmetic(&self, expr: &str) -> Option<f64> {
        let trimmed = expr.trim();
        // Try direct parse
        if let Ok(n) = trimmed.parse::<f64>() { return Some(n); }

        // Handle parentheses by evaluating innermost first
        let mut s = trimmed.to_string();
        while s.contains('(') {
            // Find innermost parentheses
            let mut start = 0;
            for (i, c) in s.char_indices() {
                if c == '(' { start = i; }
                if c == ')' {
                    let inner = &s[start + 1..i];
                    let result = self.eval_arithmetic(inner)?;
                    s = format!("{}{}{}", &s[..start], result, &s[i + 1..]);
                    break;
                }
            }
        }

        // Parse addition and subtraction (lowest precedence, left to right)
        self.eval_add_sub(&s)
    }

    fn eval_add_sub(&self, expr: &str) -> Option<f64> {
        // Find the rightmost + or - not inside a number (not after e/E for scientific notation)
        let bytes = expr.as_bytes();
        let mut depth = 0;
        let mut last_op_pos = None;
        let mut last_op = b'+';

        for i in (0..bytes.len()).rev() {
            match bytes[i] {
                b')' => depth += 1,
                b'(' => depth -= 1,
                b'+' | b'-' if depth == 0 && i > 0 => {
                    // Make sure this is an operator, not a sign or part of scientific notation
                    let prev = bytes[i - 1];
                    if prev != b'e' && prev != b'E' && prev != b'(' {
                        last_op_pos = Some(i);
                        last_op = bytes[i];
                        break;
                    }
                }
                _ => {}
            }
        }

        if let Some(pos) = last_op_pos {
            let left = self.eval_mul_div(expr[..pos].trim())?;
            let right = self.eval_mul_div(expr[pos + 1..].trim())?;
            return Some(if last_op == b'+' { left + right } else { left - right });
        }

        self.eval_mul_div(expr)
    }

    fn eval_mul_div(&self, expr: &str) -> Option<f64> {
        let bytes = expr.as_bytes();
        let mut depth = 0;
        let mut last_op_pos = None;
        let mut last_op = b'*';

        for i in (0..bytes.len()).rev() {
            match bytes[i] {
                b')' => depth += 1,
                b'(' => depth -= 1,
                b'*' | b'/' | b'%' if depth == 0 => {
                    last_op_pos = Some(i);
                    last_op = bytes[i];
                    break;
                }
                _ => {}
            }
        }

        if let Some(pos) = last_op_pos {
            let left = self.eval_mul_div(expr[..pos].trim())?;
            let right = expr[pos + 1..].trim().parse::<f64>().ok().or_else(|| self.eval_arithmetic(expr[pos + 1..].trim()))?;
            return Some(match last_op {
                b'*' => left * right,
                b'/' => if right != 0.0 { left / right } else { f64::NAN },
                b'%' => if right != 0.0 { left % right } else { f64::NAN },
                _ => unreachable!(),
            });
        }

        expr.trim().parse::<f64>().ok()
    }
}

// ---------------------------------------------------------------------------
// Factory function and registry
// ---------------------------------------------------------------------------

/// Create a transform provider by its unique identifier.
pub fn create_provider(id: &str) -> Option<Box<dyn TransformPlugin>> {
    match id {
        "type_cast" => Some(Box::new(TypeCastTransform)),
        "default_value" => Some(Box::new(DefaultValueTransform)),
        "lookup" => Some(Box::new(LookupTransform)),
        "migration_lookup" => Some(Box::new(MigrationLookupTransform)),
        "concat" => Some(Box::new(ConcatTransform)),
        "split" => Some(Box::new(SplitTransform)),
        "format" => Some(Box::new(FormatTransform)),
        "slugify" => Some(Box::new(SlugifyTransform)),
        "html_to_markdown" => Some(Box::new(HtmlToMarkdownTransform)),
        "markdown_to_html" => Some(Box::new(MarkdownToHtmlTransform)),
        "strip_tags" => Some(Box::new(StripTagsTransform)),
        "truncate" => Some(Box::new(TruncateTransform)),
        "regex_replace" => Some(Box::new(RegexReplaceTransform)),
        "date_format" => Some(Box::new(DateFormatTransform)),
        "json_extract" => Some(Box::new(JsonExtractTransform)),
        "expression" => Some(Box::new(ExpressionTransform)),
        _ => None,
    }
}

/// Return all available provider IDs.
pub fn available_providers() -> Vec<&'static str> {
    vec![
        "type_cast", "default_value", "lookup", "migration_lookup",
        "concat", "split", "format", "slugify",
        "html_to_markdown", "markdown_to_html", "strip_tags", "truncate",
        "regex_replace", "date_format", "json_extract", "expression",
    ]
}

/// Execute a transform by provider ID, value, and config.
pub fn execute_transform(value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
    let provider = create_provider(&config.provider_id).ok_or_else(|| {
        TransformError::InvalidInput {
            provider: "registry".into(),
            detail: format!("provider \"{}\" not found", config.provider_id),
        }
    })?;
    provider.transform(value, config)
}
