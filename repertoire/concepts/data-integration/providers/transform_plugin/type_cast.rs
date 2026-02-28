// Transform Plugin Provider: type_cast
// Cast values between types (string, number, boolean, timestamp).
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "type_cast";
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
    InvalidCast(String),
    UnsupportedType(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidCast(msg) => write!(f, "Invalid cast: {}", msg),
            TransformError::UnsupportedType(msg) => write!(f, "Unsupported type: {}", msg),
        }
    }
}

pub struct TypeCastTransformProvider;

impl TypeCastTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        if let Value::Null = value {
            return Ok(Value::Null);
        }

        let target_type = match config.options.get("targetType") {
            Some(Value::String(s)) => s.as_str(),
            _ => "string",
        };

        match target_type {
            "string" => Ok(Value::String(self.value_to_string(value))),

            "number" | "float" => {
                let num = self.value_to_f64(value)?;
                Ok(Value::Number(num))
            }

            "integer" => {
                let num = self.value_to_f64(value)?;
                Ok(Value::Integer(num.trunc() as i64))
            }

            "boolean" => {
                let b = self.value_to_bool(value)?;
                Ok(Value::Boolean(b))
            }

            "timestamp" => {
                match value {
                    Value::Number(n) => Ok(Value::Number(*n)),
                    Value::Integer(n) => Ok(Value::Number(*n as f64)),
                    Value::String(s) => {
                        // Basic ISO 8601 parsing: extract numeric components
                        let trimmed = s.trim();
                        if let Ok(ts) = trimmed.parse::<f64>() {
                            return Ok(Value::Number(ts));
                        }
                        Err(TransformError::InvalidCast(
                            format!("Cannot cast \"{}\" to timestamp without chrono", s)
                        ))
                    }
                    _ => Err(TransformError::InvalidCast(
                        "Cannot cast to timestamp".to_string()
                    )),
                }
            }

            other => Err(TransformError::UnsupportedType(other.to_string())),
        }
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Integer(n) => format!("{}", n),
            Value::Boolean(b) => format!("{}", b),
            Value::Null => String::new(),
            Value::Array(_) => "[array]".to_string(),
            Value::Object(_) => "[object]".to_string(),
        }
    }

    fn value_to_f64(&self, value: &Value) -> Result<f64, TransformError> {
        match value {
            Value::Number(n) => Ok(*n),
            Value::Integer(n) => Ok(*n as f64),
            Value::String(s) => {
                let trimmed = s.trim();
                trimmed.parse::<f64>().map_err(|_| {
                    TransformError::InvalidCast(format!("Cannot cast \"{}\" to number", s))
                })
            }
            Value::Boolean(b) => Ok(if *b { 1.0 } else { 0.0 }),
            _ => Err(TransformError::InvalidCast("Cannot cast to number".to_string())),
        }
    }

    fn value_to_bool(&self, value: &Value) -> Result<bool, TransformError> {
        match value {
            Value::Boolean(b) => Ok(*b),
            Value::Number(n) => Ok(*n != 0.0),
            Value::Integer(n) => Ok(*n != 0),
            Value::String(s) => {
                let lower = s.trim().to_lowercase();
                match lower.as_str() {
                    "true" | "1" | "yes" | "on" => Ok(true),
                    "false" | "0" | "no" | "off" => Ok(false),
                    _ => Err(TransformError::InvalidCast(
                        format!("Cannot cast \"{}\" to boolean", s)
                    )),
                }
            }
            _ => Err(TransformError::InvalidCast("Cannot cast to boolean".to_string())),
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }
}
