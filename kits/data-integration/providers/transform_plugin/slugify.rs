// Transform Plugin Provider: slugify
// Generate URL-safe slug from input string with Unicode transliteration.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "slugify";
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

pub struct SlugifyTransformProvider;

impl SlugifyTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let input = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            other => self.value_to_string(other),
        };

        let separator = match config.options.get("separator") {
            Some(Value::String(s)) => s.clone(),
            _ => "-".to_string(),
        };

        let max_length = match config.options.get("maxLength") {
            Some(Value::Integer(n)) => Some(*n as usize),
            Some(Value::Number(n)) => Some(*n as usize),
            _ => None,
        };

        // Lowercase
        let mut slug = input.to_lowercase();

        // Transliterate Unicode to ASCII
        slug = self.transliterate(&slug);

        // Replace non-alphanumeric characters with separator
        let mut result = String::new();
        let mut last_was_sep = true; // Treat start as separator to avoid leading sep

        for ch in slug.chars() {
            if ch.is_ascii_alphanumeric() {
                result.push(ch);
                last_was_sep = false;
            } else if !last_was_sep {
                result.push_str(&separator);
                last_was_sep = true;
            }
        }

        // Remove trailing separator
        while result.ends_with(&separator) {
            let new_len = result.len() - separator.len();
            result.truncate(new_len);
        }

        // Apply max length
        if let Some(max) = max_length {
            if max > 0 && result.len() > max {
                result.truncate(max);
                // Clean up trailing separator after truncation
                while result.ends_with(&separator) {
                    let new_len = result.len() - separator.len();
                    result.truncate(new_len);
                }
            }
        }

        Ok(Value::String(result))
    }

    fn transliterate(&self, input: &str) -> String {
        let mut result = String::new();
        for ch in input.chars() {
            let replacement = match ch {
                '\u{00e0}' | '\u{00e1}' | '\u{00e2}' | '\u{00e3}' | '\u{00e5}' | '\u{0105}' => "a",
                '\u{00e4}' => "ae",
                '\u{00e6}' => "ae",
                '\u{00e7}' | '\u{010d}' | '\u{0107}' => "c",
                '\u{00e8}' | '\u{00e9}' | '\u{00ea}' | '\u{00eb}' | '\u{0119}' => "e",
                '\u{00ec}' | '\u{00ed}' | '\u{00ee}' | '\u{00ef}' => "i",
                '\u{00f0}' => "d",
                '\u{00f1}' | '\u{0144}' => "n",
                '\u{00f2}' | '\u{00f3}' | '\u{00f4}' | '\u{00f5}' | '\u{00f8}' => "o",
                '\u{00f6}' => "oe",
                '\u{00f9}' | '\u{00fa}' | '\u{00fb}' => "u",
                '\u{00fc}' => "ue",
                '\u{00fd}' | '\u{00ff}' => "y",
                '\u{00df}' => "ss",
                '\u{0142}' => "l",
                '\u{017e}' | '\u{017c}' => "z",
                '\u{0161}' | '\u{015b}' => "s",
                '\u{0159}' => "r",
                '\u{00c0}' | '\u{00c1}' | '\u{00c2}' | '\u{00c3}' | '\u{00c5}' => "a",
                '\u{00c4}' => "ae",
                '\u{00c6}' => "ae",
                '\u{00c7}' => "c",
                '\u{00c8}' | '\u{00c9}' | '\u{00ca}' | '\u{00cb}' => "e",
                '\u{00cc}' | '\u{00cd}' | '\u{00ce}' | '\u{00cf}' => "i",
                '\u{00d1}' => "n",
                '\u{00d2}' | '\u{00d3}' | '\u{00d4}' | '\u{00d5}' | '\u{00d8}' => "o",
                '\u{00d6}' => "oe",
                '\u{00d9}' | '\u{00da}' | '\u{00db}' => "u",
                '\u{00dc}' => "ue",
                '\u{00dd}' => "y",
                _ => {
                    result.push(ch);
                    continue;
                }
            };
            result.push_str(replacement);
        }
        result
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
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}
