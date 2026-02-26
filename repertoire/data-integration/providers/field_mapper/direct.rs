// Direct field mapper — key-to-key mapping with dot notation for nested traversal
// Supports dot-separated paths and bracket notation for array indexing

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "direct";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    PathNotFound(String),
    InvalidPath(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::PathNotFound(p) => write!(f, "path not found: {}", p),
            MapperError::InvalidPath(p) => write!(f, "invalid path: {}", p),
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

#[derive(Debug)]
enum Segment {
    Key(String),
    Index(usize),
}

fn parse_segments(source_path: &str) -> Result<Vec<Segment>, MapperError> {
    let mut segments = Vec::new();
    for part in source_path.split('.') {
        if part.is_empty() {
            continue;
        }
        if let Some(bracket_start) = part.find('[') {
            let key = &part[..bracket_start];
            if !key.is_empty() {
                segments.push(Segment::Key(key.to_string()));
            }
            let rest = &part[bracket_start..];
            let mut i = 0;
            let chars: Vec<char> = rest.chars().collect();
            while i < chars.len() {
                if chars[i] == '[' {
                    let end = rest[i..].find(']').ok_or_else(|| {
                        MapperError::InvalidPath(format!("unclosed bracket in '{}'", part))
                    })?;
                    let idx_str = &rest[i + 1..i + end];
                    let idx: usize = idx_str.parse().map_err(|_| {
                        MapperError::InvalidPath(format!("non-numeric index '{}'", idx_str))
                    })?;
                    segments.push(Segment::Index(idx));
                    i += end + 1;
                } else {
                    i += 1;
                }
            }
        } else {
            segments.push(Segment::Key(part.to_string()));
        }
    }
    Ok(segments)
}

fn traverse(root: &Value, segments: &[Segment]) -> Option<Value> {
    let mut current = root;
    for seg in segments {
        match seg {
            Segment::Key(key) => {
                if let Value::Object(map) = current {
                    current = map.get(key)?;
                } else {
                    return None;
                }
            }
            Segment::Index(idx) => {
                if let Value::Array(arr) = current {
                    current = arr.get(*idx)?;
                } else {
                    return None;
                }
            }
        }
    }
    Some(current.clone())
}

pub struct DirectMapperProvider;

impl DirectMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        _config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let trimmed = source_path.trim();
        if trimmed.is_empty() {
            return Err(MapperError::InvalidPath("empty path".to_string()));
        }
        let segments = parse_segments(trimmed)?;
        Ok(traverse(record, &segments).unwrap_or(Value::Null))
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "dot_notation" | "direct" | "bracket")
    }
}
