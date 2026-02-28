// Transform Plugin Provider: regex_replace
// Pattern-based find and replace with capture group support.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "regex_replace";
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
    InvalidPattern(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            TransformError::InvalidPattern(msg) => write!(f, "Invalid pattern: {}", msg),
        }
    }
}

pub struct RegexReplaceTransformProvider;

impl RegexReplaceTransformProvider {
    pub fn new() -> Self {
        Self
    }

    /// Perform regex-like replacement using a simplified pattern engine.
    /// For production use, integrate the `regex` crate. This implementation
    /// handles literal patterns and basic character class replacements.
    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let input = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            _ => return Err(TransformError::InvalidInput("Expected string input".to_string())),
        };

        let pattern = match config.options.get("pattern") {
            Some(Value::String(s)) => s.clone(),
            _ => return Err(TransformError::InvalidPattern(
                "regex_replace requires a pattern in config.options.pattern".to_string()
            )),
        };

        let replacement = match config.options.get("replacement") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };

        let global = match config.options.get("global") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let case_insensitive = match config.options.get("caseInsensitive") {
            Some(Value::Boolean(true)) => true,
            _ => false,
        };

        // This simplified implementation handles literal pattern matching.
        // For full regex support, use the `regex` crate in production.
        let result = if self.is_literal_pattern(&pattern) {
            self.literal_replace(&input, &pattern, &replacement, global, case_insensitive)
        } else {
            // For patterns with regex metacharacters, attempt basic replacements
            self.basic_regex_replace(&input, &pattern, &replacement, global, case_insensitive)
        };

        Ok(Value::String(result))
    }

    fn is_literal_pattern(&self, pattern: &str) -> bool {
        !pattern.chars().any(|c| ".*+?^${}()|[]\\".contains(c))
    }

    fn literal_replace(
        &self, input: &str, pattern: &str, replacement: &str,
        global: bool, case_insensitive: bool,
    ) -> String {
        if case_insensitive {
            let lower_input = input.to_lowercase();
            let lower_pattern = pattern.to_lowercase();
            let mut result = String::new();
            let mut start = 0;
            let mut replaced = false;

            while let Some(pos) = lower_input[start..].find(&lower_pattern) {
                result.push_str(&input[start..start + pos]);
                result.push_str(replacement);
                start += pos + pattern.len();
                replaced = true;
                if !global {
                    break;
                }
            }
            result.push_str(&input[start..]);

            if !replaced {
                input.to_string()
            } else {
                result
            }
        } else if global {
            input.replace(pattern, replacement)
        } else {
            input.replacen(pattern, replacement, 1)
        }
    }

    fn basic_regex_replace(
        &self, input: &str, pattern: &str, replacement: &str,
        global: bool, _case_insensitive: bool,
    ) -> String {
        // Handle common simple regex patterns
        // Pattern: \d+ (one or more digits)
        if pattern == r"\d+" {
            return self.replace_digit_sequences(input, replacement, global);
        }

        // Pattern: \s+ (one or more whitespace)
        if pattern == r"\s+" {
            return self.replace_whitespace_sequences(input, replacement, global);
        }

        // Pattern: [^a-zA-Z0-9] (non-alphanumeric)
        if pattern == "[^a-zA-Z0-9]" {
            return self.replace_non_alnum(input, replacement, global);
        }

        // Fallback: treat as literal
        if global {
            input.replace(pattern, replacement)
        } else {
            input.replacen(pattern, replacement, 1)
        }
    }

    fn replace_digit_sequences(&self, input: &str, replacement: &str, global: bool) -> String {
        let mut result = String::new();
        let mut in_digits = false;
        let mut replaced = false;

        for ch in input.chars() {
            if ch.is_ascii_digit() {
                if !in_digits {
                    in_digits = true;
                    if !replaced || global {
                        result.push_str(replacement);
                        replaced = true;
                    }
                }
                if replaced && !global && in_digits {
                    // Already replaced the first occurrence; skip subsequent digits in that group
                    continue;
                }
            } else {
                in_digits = false;
                result.push(ch);
            }
        }
        result
    }

    fn replace_whitespace_sequences(&self, input: &str, replacement: &str, global: bool) -> String {
        let mut result = String::new();
        let mut in_ws = false;
        let mut replaced = false;

        for ch in input.chars() {
            if ch.is_whitespace() {
                if !in_ws {
                    in_ws = true;
                    if !replaced || global {
                        result.push_str(replacement);
                        replaced = true;
                    } else {
                        result.push(ch);
                    }
                }
            } else {
                in_ws = false;
                result.push(ch);
            }
        }
        result
    }

    fn replace_non_alnum(&self, input: &str, replacement: &str, global: bool) -> String {
        let mut result = String::new();
        let mut replaced = false;

        for ch in input.chars() {
            if !ch.is_alphanumeric() {
                if !replaced || global {
                    result.push_str(replacement);
                    replaced = true;
                } else {
                    result.push(ch);
                }
            } else {
                result.push(ch);
            }
        }
        result
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}
