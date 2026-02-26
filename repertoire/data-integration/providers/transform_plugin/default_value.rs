// Transform Plugin Provider: default_value
// Provide fallback values when input is null, undefined, or empty.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "default_value";
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

pub struct DefaultValueTransformProvider;

impl DefaultValueTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let default_val = config.options.get("defaultValue")
            .cloned()
            .unwrap_or(Value::Null);

        let treat_empty = match config.options.get("treatEmptyAsNull") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        match value {
            Value::Null => return Ok(default_val),
            Value::String(s) if treat_empty && s.trim().is_empty() => {
                return Ok(default_val);
            }
            Value::Array(arr) if treat_empty && arr.is_empty() => {
                return Ok(default_val);
            }
            Value::Object(map) if treat_empty && map.is_empty() => {
                return Ok(default_val);
            }
            Value::Number(n) if n.is_nan() => {
                // Check for type-specific defaults
                if let Some(Value::Object(type_defaults)) = config.options.get("typeDefaults") {
                    if let Some(num_default) = type_defaults.get("number") {
                        return Ok(num_default.clone());
                    }
                }
                return Ok(default_val);
            }
            _ => {}
        }

        Ok(value.clone())
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: false }
    }
}
