// Transform Plugin Provider: truncate
// Limit string length with configurable ellipsis and word-boundary awareness.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "truncate";
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
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

pub struct TruncateTransformProvider;

impl TruncateTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let input = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            _ => return Err(TransformError::InvalidInput("Expected string input".to_string())),
        };

        let max_length = match config.options.get("maxLength") {
            Some(Value::Integer(n)) => *n as usize,
            Some(Value::Number(n)) => *n as usize,
            _ => 100,
        };

        let suffix = match config.options.get("suffix") {
            Some(Value::String(s)) => s.clone(),
            _ => "...".to_string(),
        };

        let word_boundary = match config.options.get("wordBoundary") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        if input.len() <= max_length {
            return Ok(Value::String(input));
        }

        let effective_max = if max_length > suffix.len() {
            max_length - suffix.len()
        } else {
            return Ok(Value::String(suffix.chars().take(max_length).collect()));
        };

        let mut truncated: String = input.chars().take(effective_max).collect();

        if word_boundary {
            // Find last space within truncated portion
            if let Some(last_space) = truncated.rfind(' ') {
                // Only use word boundary if it doesn't lose too much content
                if last_space > effective_max / 2 {
                    truncated = truncated[..last_space].to_string();
                }
            }
        }

        // Remove trailing punctuation that would look odd before ellipsis
        truncated = truncated.trim_end_matches(|c: char| {
            c == ',' || c == ';' || c == ':' || c.is_whitespace()
        }).to_string();

        Ok(Value::String(format!("{}{}", truncated, suffix)))
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}
