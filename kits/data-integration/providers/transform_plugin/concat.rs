// Transform Plugin Provider: concat
// Merge multiple values into a single string with configurable separator.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "concat";
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

pub struct ConcatTransformProvider;

impl ConcatTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let separator = match config.options.get("separator") {
            Some(Value::String(s)) => s.clone(),
            _ => " ".to_string(),
        };

        let skip_nulls = match config.options.get("skipNulls") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let null_placeholder = match config.options.get("nullPlaceholder") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };

        let prefix = match config.options.get("prefix") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };

        let suffix = match config.options.get("suffix") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };

        let values = match value {
            Value::Array(arr) => arr.clone(),
            Value::Null => {
                if let Some(Value::Array(additional)) = config.options.get("values") {
                    additional.clone()
                } else {
                    return Ok(if skip_nulls { Value::Null } else { Value::String(null_placeholder) });
                }
            }
            other => {
                if let Some(Value::Array(additional)) = config.options.get("values") {
                    let mut combined = vec![other.clone()];
                    combined.extend(additional.clone());
                    combined
                } else {
                    let s = self.value_to_string(other);
                    return Ok(Value::String(format!("{}{}{}", prefix, s, suffix)));
                }
            }
        };

        let mut parts: Vec<String> = Vec::new();

        for v in &values {
            match v {
                Value::Null => {
                    if !skip_nulls {
                        parts.push(null_placeholder.clone());
                    }
                }
                Value::String(s) if s.trim().is_empty() && skip_nulls => {
                    continue;
                }
                other => {
                    parts.push(self.value_to_string(other));
                }
            }
        }

        if parts.is_empty() {
            return Ok(Value::Null);
        }

        let joined = parts.join(&separator);
        Ok(Value::String(format!("{}{}{}", prefix, joined.trim(), suffix)))
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Integer(n) => format!("{}", n),
            Value::Boolean(b) => format!("{}", b),
            Value::Null => String::new(),
            _ => String::new(),
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "array".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}
