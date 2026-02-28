// Transform Plugin Provider: lookup
// Map values via a configurable lookup table with case-insensitive matching.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "lookup";
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
    MissingConfig(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::MissingConfig(msg) => write!(f, "Missing config: {}", msg),
        }
    }
}

pub struct LookupTransformProvider;

impl LookupTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let table = match config.options.get("table") {
            Some(Value::Object(map)) => map,
            _ => return Err(TransformError::MissingConfig(
                "Lookup table is required in config.options.table".to_string()
            )),
        };

        let case_insensitive = match config.options.get("caseInsensitive") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let default_value = config.options.get("default");
        let has_default = config.options.contains_key("default");

        let key = match value {
            Value::Null => {
                return Ok(if has_default {
                    default_value.cloned().unwrap_or(Value::Null)
                } else {
                    Value::Null
                });
            }
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Integer(n) => format!("{}", n),
            Value::Boolean(b) => format!("{}", b),
            _ => return Ok(value.clone()),
        };

        // Direct match
        if let Some(v) = table.get(&key) {
            return Ok(v.clone());
        }

        // Case-insensitive match
        if case_insensitive {
            let lower_key = key.to_lowercase();
            for (k, v) in table {
                if k.to_lowercase() == lower_key {
                    return Ok(v.clone());
                }
            }
        }

        // No match found
        if has_default {
            return Ok(default_value.cloned().unwrap_or(Value::Null));
        }

        Ok(value.clone())
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }
}
