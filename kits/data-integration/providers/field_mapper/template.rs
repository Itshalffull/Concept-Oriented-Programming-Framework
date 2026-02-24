// Template field mapper — string interpolation with field references
// Supports {field_name} placeholders, {field|default} fallback syntax,
// and nested field references like {author.name}

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "template";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    InvalidTemplate(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::InvalidTemplate(e) => write!(f, "invalid template: {}", e),
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
enum Token {
    Literal(String),
    Placeholder { field_path: String, default_value: Option<String> },
}

fn tokenize(template: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = template.chars().collect();
    let mut i = 0;
    let mut literal_start = 0;

    while i < chars.len() {
        // Escaped brace
        if chars[i] == '\\' && i + 1 < chars.len() && (chars[i + 1] == '{' || chars[i + 1] == '}') {
            let literal: String = chars[literal_start..i].iter().collect();
            if !literal.is_empty() {
                tokens.push(Token::Literal(literal));
            }
            tokens.push(Token::Literal(chars[i + 1].to_string()));
            i += 2;
            literal_start = i;
            continue;
        }

        if chars[i] == '{' {
            if i > literal_start {
                let literal: String = chars[literal_start..i].iter().collect();
                tokens.push(Token::Literal(literal));
            }

            let close_idx = chars[i + 1..].iter().position(|&c| c == '}');
            match close_idx {
                Some(offset) => {
                    let inner: String = chars[i + 1..i + 1 + offset].iter().collect();
                    let inner = inner.trim().to_string();

                    if let Some(pipe_idx) = inner.find('|') {
                        let field_path = inner[..pipe_idx].trim().to_string();
                        let default_value = inner[pipe_idx + 1..].trim().to_string();
                        tokens.push(Token::Placeholder {
                            field_path,
                            default_value: Some(default_value),
                        });
                    } else {
                        tokens.push(Token::Placeholder {
                            field_path: inner,
                            default_value: None,
                        });
                    }
                    i = i + 1 + offset + 1;
                    literal_start = i;
                }
                None => {
                    // Unclosed brace — treat rest as literal
                    let literal: String = chars[i..].iter().collect();
                    tokens.push(Token::Literal(literal));
                    return tokens;
                }
            }
        } else {
            i += 1;
        }
    }

    if literal_start < chars.len() {
        let literal: String = chars[literal_start..].iter().collect();
        tokens.push(Token::Literal(literal));
    }

    tokens
}

fn resolve_field(record: &Value, field_path: &str) -> Option<Value> {
    let parts: Vec<&str> = field_path.split('.').collect();
    let mut current = record;

    for part in parts {
        // Handle bracket notation within template paths
        if let Some(bracket) = part.find('[') {
            let key = &part[..bracket];
            if !key.is_empty() {
                match current {
                    Value::Object(map) => {
                        current = map.get(key)?;
                    }
                    _ => return None,
                }
            }
            let idx_str = &part[bracket + 1..part.len() - 1];
            let idx: usize = idx_str.parse().ok()?;
            match current {
                Value::Array(arr) => {
                    current = arr.get(idx)?;
                }
                _ => return None,
            }
        } else {
            match current {
                Value::Object(map) => {
                    current = map.get(part)?;
                }
                _ => return None,
            }
        }
    }

    Some(current.clone())
}

fn format_value(val: &Value) -> String {
    match val {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => {
            if *n == (*n as i64) as f64 {
                (*n as i64).to_string()
            } else {
                n.to_string()
            }
        }
        Value::Str(s) => s.clone(),
        Value::Array(arr) => arr.iter().map(format_value).collect::<Vec<_>>().join(", "),
        Value::Object(_) => String::from("[object]"),
    }
}

pub struct TemplateMapperProvider;

impl TemplateMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        _config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let tokens = tokenize(source_path);
        let mut result = String::new();

        for token in tokens {
            match token {
                Token::Literal(s) => result.push_str(&s),
                Token::Placeholder { field_path, default_value } => {
                    match resolve_field(record, &field_path) {
                        Some(val) if val != Value::Null => {
                            result.push_str(&format_value(&val));
                        }
                        _ => {
                            if let Some(ref def) = default_value {
                                result.push_str(def);
                            }
                        }
                    }
                }
            }
        }

        Ok(Value::Str(result))
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "template" | "string_template" | "interpolation")
    }
}
