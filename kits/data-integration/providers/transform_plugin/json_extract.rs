// Transform Plugin Provider: json_extract
// Extract values from JSON strings at a specified path.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "json_extract";
pub const PLUGIN_TYPE: &str = "transform_plugin";

#[derive(Debug, Clone)]
pub enum Value {
    String(String),
    Number(f64),
    Integer(i64),
    Boolean(bool),
    Null,
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct TransformConfig {
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct TypeSpec {
    pub type_name: String,
    pub nullable: bool,
}

#[derive(Debug)]
pub enum TransformError {
    InvalidInput(String),
    InvalidJson(String),
    PathNotFound(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            TransformError::InvalidJson(msg) => write!(f, "Invalid JSON: {}", msg),
            TransformError::PathNotFound(msg) => write!(f, "Path not found: {}", msg),
        }
    }
}

pub struct JsonExtractTransformProvider;

impl JsonExtractTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        if let Value::Null = value {
            return Ok(Value::Null);
        }

        let path = match config.options.get("path") {
            Some(Value::String(s)) => s.clone(),
            _ => "$".to_string(),
        };

        let default_value = config.options.get("default");
        let has_default = config.options.contains_key("default");

        // Parse JSON if string, otherwise use value directly
        let parsed = match value {
            Value::String(s) => {
                self.parse_json_string(s)?
            }
            other => other.clone(),
        };

        match self.navigate_path(&parsed, &path) {
            Some(result) => Ok(result),
            None => {
                if has_default {
                    Ok(default_value.cloned().unwrap_or(Value::Null))
                } else {
                    Ok(Value::Null)
                }
            }
        }
    }

    fn parse_json_string(&self, json: &str) -> Result<Value, TransformError> {
        let trimmed = json.trim();
        if trimmed.is_empty() {
            return Err(TransformError::InvalidJson("Empty JSON string".to_string()));
        }

        self.parse_json_value(trimmed, 0)
            .map(|(v, _)| v)
            .ok_or_else(|| TransformError::InvalidJson("Failed to parse JSON".to_string()))
    }

    fn parse_json_value(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        let trimmed_pos = self.skip_whitespace(json, pos);
        if trimmed_pos >= json.len() {
            return None;
        }

        let ch = json.as_bytes()[trimmed_pos];
        match ch {
            b'"' => self.parse_json_string_literal(json, trimmed_pos),
            b'{' => self.parse_json_object(json, trimmed_pos),
            b'[' => self.parse_json_array(json, trimmed_pos),
            b't' | b'f' => self.parse_json_bool(json, trimmed_pos),
            b'n' => self.parse_json_null(json, trimmed_pos),
            b'-' | b'0'..=b'9' => self.parse_json_number(json, trimmed_pos),
            _ => None,
        }
    }

    fn skip_whitespace(&self, json: &str, mut pos: usize) -> usize {
        let bytes = json.as_bytes();
        while pos < bytes.len() && (bytes[pos] == b' ' || bytes[pos] == b'\n' || bytes[pos] == b'\t' || bytes[pos] == b'\r') {
            pos += 1;
        }
        pos
    }

    fn parse_json_string_literal(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        let mut i = pos + 1;
        let mut s = String::new();
        let bytes = json.as_bytes();
        while i < bytes.len() {
            if bytes[i] == b'\\' && i + 1 < bytes.len() {
                match bytes[i + 1] {
                    b'"' => { s.push('"'); i += 2; }
                    b'\\' => { s.push('\\'); i += 2; }
                    b'n' => { s.push('\n'); i += 2; }
                    b't' => { s.push('\t'); i += 2; }
                    b'r' => { s.push('\r'); i += 2; }
                    _ => { s.push(bytes[i + 1] as char); i += 2; }
                }
            } else if bytes[i] == b'"' {
                return Some((Value::String(s), i + 1));
            } else {
                s.push(bytes[i] as char);
                i += 1;
            }
        }
        None
    }

    fn parse_json_object(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        let mut map = HashMap::new();
        let mut i = pos + 1;
        i = self.skip_whitespace(json, i);

        if i < json.len() && json.as_bytes()[i] == b'}' {
            return Some((Value::Object(map), i + 1));
        }

        loop {
            i = self.skip_whitespace(json, i);
            let (key_val, next) = self.parse_json_string_literal(json, i)?;
            let key = match key_val {
                Value::String(s) => s,
                _ => return None,
            };
            i = self.skip_whitespace(json, next);
            if i >= json.len() || json.as_bytes()[i] != b':' { return None; }
            i += 1;
            let (val, next) = self.parse_json_value(json, i)?;
            map.insert(key, val);
            i = self.skip_whitespace(json, next);
            if i >= json.len() { return None; }
            if json.as_bytes()[i] == b'}' { return Some((Value::Object(map), i + 1)); }
            if json.as_bytes()[i] != b',' { return None; }
            i += 1;
        }
    }

    fn parse_json_array(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        let mut arr = Vec::new();
        let mut i = pos + 1;
        i = self.skip_whitespace(json, i);

        if i < json.len() && json.as_bytes()[i] == b']' {
            return Some((Value::Array(arr), i + 1));
        }

        loop {
            let (val, next) = self.parse_json_value(json, i)?;
            arr.push(val);
            i = self.skip_whitespace(json, next);
            if i >= json.len() { return None; }
            if json.as_bytes()[i] == b']' { return Some((Value::Array(arr), i + 1)); }
            if json.as_bytes()[i] != b',' { return None; }
            i += 1;
        }
    }

    fn parse_json_number(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        let mut i = pos;
        let bytes = json.as_bytes();
        let mut has_dot = false;
        if i < bytes.len() && bytes[i] == b'-' { i += 1; }
        while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
            if bytes[i] == b'.' { has_dot = true; }
            i += 1;
        }
        let num_str = &json[pos..i];
        if has_dot {
            let n: f64 = num_str.parse().ok()?;
            Some((Value::Number(n), i))
        } else {
            let n: i64 = num_str.parse().ok()?;
            Some((Value::Integer(n), i))
        }
    }

    fn parse_json_bool(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        if json[pos..].starts_with("true") {
            Some((Value::Boolean(true), pos + 4))
        } else if json[pos..].starts_with("false") {
            Some((Value::Boolean(false), pos + 5))
        } else {
            None
        }
    }

    fn parse_json_null(&self, json: &str, pos: usize) -> Option<(Value, usize)> {
        if json[pos..].starts_with("null") {
            Some((Value::Null, pos + 4))
        } else {
            None
        }
    }

    fn navigate_path(&self, root: &Value, path: &str) -> Option<Value> {
        if path == "$" || path.is_empty() {
            return Some(root.clone());
        }

        let mut normalized = path.to_string();
        if normalized.starts_with("$.") {
            normalized = normalized[2..].to_string();
        } else if normalized.starts_with('$') {
            normalized = normalized[1..].to_string();
        }

        let segments = self.tokenize_path(&normalized);
        let mut current = root.clone();

        for segment in &segments {
            match &current {
                Value::Object(map) => {
                    current = map.get(segment)?.clone();
                }
                Value::Array(arr) => {
                    // Try array index
                    let trimmed = segment.trim_start_matches('[').trim_end_matches(']');
                    let idx: usize = trimmed.parse().ok()?;
                    current = arr.get(idx)?.clone();
                }
                _ => return None,
            }
        }

        Some(current)
    }

    fn tokenize_path(&self, path: &str) -> Vec<String> {
        let mut segments = Vec::new();
        let mut current = String::new();

        for ch in path.chars() {
            match ch {
                '.' => {
                    if !current.is_empty() {
                        segments.push(current.clone());
                        current.clear();
                    }
                }
                '[' => {
                    if !current.is_empty() {
                        segments.push(current.clone());
                        current.clear();
                    }
                    current.push(ch);
                }
                ']' => {
                    current.push(ch);
                    // Strip quotes from ['key'] notation
                    let inner = current.trim_start_matches('[').trim_end_matches(']');
                    if (inner.starts_with('\'') && inner.ends_with('\''))
                        || (inner.starts_with('"') && inner.ends_with('"'))
                    {
                        segments.push(inner[1..inner.len() - 1].to_string());
                    } else {
                        segments.push(current.clone());
                    }
                    current.clear();
                }
                _ => {
                    current.push(ch);
                }
            }
        }
        if !current.is_empty() {
            segments.push(current);
        }
        segments
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }
}
