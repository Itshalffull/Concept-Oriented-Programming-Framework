// Transform Plugin Provider: split
// Split a string into an array by configurable delimiter.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "split";
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

pub struct SplitTransformProvider;

impl SplitTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let input = match value {
            Value::Null => return Ok(Value::Array(Vec::new())),
            Value::String(s) => s.clone(),
            other => self.value_to_string(other),
        };

        let delimiter = match config.options.get("delimiter") {
            Some(Value::String(s)) => s.clone(),
            _ => ",".to_string(),
        };

        let limit = match config.options.get("limit") {
            Some(Value::Integer(n)) => Some(*n as usize),
            Some(Value::Number(n)) => Some(*n as usize),
            _ => None,
        };

        let trim_entries = match config.options.get("trim") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let filter_empty = match config.options.get("filterEmpty") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let mut parts: Vec<String> = input.split(&delimiter)
            .map(|s| s.to_string())
            .collect();

        // Apply limit: keep first (limit-1) parts, join the rest
        if let Some(lim) = limit {
            if lim > 0 && parts.len() > lim {
                let tail: Vec<String> = parts.drain(lim - 1..).collect();
                let joined_tail = tail.join(&delimiter);
                parts.push(joined_tail);
            }
        }

        if trim_entries {
            parts = parts.into_iter().map(|s| s.trim().to_string()).collect();
        }

        if filter_empty {
            parts.retain(|s| !s.is_empty());
        }

        let result: Vec<Value> = parts.into_iter()
            .map(Value::String)
            .collect();

        Ok(Value::Array(result))
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Integer(n) => format!("{}", n),
            Value::Boolean(b) => format!("{}", b),
            _ => String::new(),
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "array".to_string(), nullable: false }
    }
}
