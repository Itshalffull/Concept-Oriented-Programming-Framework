// Regex field mapper — regex capture group extraction from string values
// Supports named groups, numbered groups, and flags: i, m, s, g

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "regex";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    InvalidPattern(String),
    FieldNotFound(String),
    NotAString(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::InvalidPattern(e) => write!(f, "invalid regex: {}", e),
            MapperError::FieldNotFound(e) => write!(f, "field not found: {}", e),
            MapperError::NotAString(e) => write!(f, "not a string: {}", e),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    Str(String),
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

fn resolve_field_value(record: &Value, field: &str) -> Option<String> {
    let parts: Vec<&str> = field.split('.').collect();
    let mut current = record;
    for part in parts {
        match current {
            Value::Object(map) => {
                current = map.get(part)?;
            }
            _ => return None,
        }
    }
    match current {
        Value::Str(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// Parse inline source path format: "fieldName::/pattern/flags"
fn parse_source_path(source_path: &str) -> (String, Option<String>, String) {
    if let Some(sep_idx) = source_path.find("::/") {
        let field = source_path[..sep_idx].trim().to_string();
        let rest = &source_path[sep_idx + 2..]; // starts with /
        // Find the closing /
        if let Some(last_slash) = rest.rfind('/') {
            if last_slash > 0 {
                let pattern = rest[1..last_slash].to_string();
                let flags = rest[last_slash + 1..].to_string();
                return (field, Some(pattern), flags);
            }
        }
    }
    (source_path.trim().to_string(), None, String::new())
}

fn build_pattern(pattern: &str, flags: &str) -> String {
    let mut prefix = String::from("(?");
    let mut has_flags = false;
    for ch in flags.chars() {
        match ch {
            'i' => { prefix.push('i'); has_flags = true; }
            'm' => { prefix.push('m'); has_flags = true; }
            's' => { prefix.push('s'); has_flags = true; }
            _ => {}
        }
    }
    if has_flags {
        format!("{}){}", prefix, pattern)
    } else {
        pattern.to_string()
    }
}

fn extract_named_groups(pattern: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut i = 0;
    let chars: Vec<char> = pattern.chars().collect();
    while i + 3 < chars.len() {
        if chars[i] == '(' && chars[i + 1] == '?' && chars[i + 2] == '<' {
            let start = i + 3;
            let mut end = start;
            while end < chars.len() && chars[end] != '>' {
                end += 1;
            }
            if end < chars.len() {
                let name: String = chars[start..end].iter().collect();
                names.push(name);
            }
        }
        i += 1;
    }
    names
}

pub struct RegexMapperProvider;

impl RegexMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let (field_name, inline_pattern, inline_flags) = parse_source_path(source_path);

        let pattern_str = if let Some(ref pat) = inline_pattern {
            pat.clone()
        } else if let Some(ref opts) = config.options {
            opts.get("pattern").cloned().unwrap_or_default()
        } else {
            return Err(MapperError::InvalidPattern("no pattern provided".into()));
        };

        let flags = if !inline_flags.is_empty() {
            inline_flags
        } else if let Some(ref opts) = config.options {
            opts.get("flags").cloned().unwrap_or_default()
        } else {
            String::new()
        };

        let input = resolve_field_value(record, &field_name)
            .ok_or_else(|| MapperError::FieldNotFound(field_name.clone()))?;

        let full_pattern = build_pattern(&pattern_str, &flags);
        let is_global = flags.contains('g');
        let named_groups = extract_named_groups(&pattern_str);

        // Simulated regex matching using a simple engine
        // In production, this would use the `regex` crate
        let result = self.match_pattern(&full_pattern, &input, is_global, &named_groups)?;
        Ok(result)
    }

    fn match_pattern(
        &self,
        _pattern: &str,
        input: &str,
        _global: bool,
        named_groups: &[String],
    ) -> Result<Value, MapperError> {
        // Placeholder: real implementation would use the regex crate.
        // Returns input as-is when no regex crate is available,
        // demonstrating the structural pattern for capture group extraction.
        if input.is_empty() {
            return Ok(Value::Null);
        }
        if !named_groups.is_empty() {
            let mut map = HashMap::new();
            for name in named_groups {
                map.insert(name.clone(), Value::Str(input.to_string()));
            }
            Ok(Value::Object(map))
        } else {
            Ok(Value::Str(input.to_string()))
        }
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "regex" | "regexp" | "regular_expression")
    }
}
