// JSONPath field mapper — JSONPath expression evaluation for complex JSON navigation
// Supports: $ (root), . (child), .. (recursive descent), [*] (wildcard),
// [n] (index), [?(@.field<value)] (filter expressions)

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "jsonpath";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    InvalidExpression(String),
    EvaluationFailed(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::InvalidExpression(e) => write!(f, "invalid jsonpath: {}", e),
            MapperError::EvaluationFailed(e) => write!(f, "evaluation failed: {}", e),
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

fn descendants(node: &Value) -> Vec<Value> {
    let mut results = Vec::new();
    match node {
        Value::Object(map) => {
            for val in map.values() {
                results.push(val.clone());
                results.extend(descendants(val));
            }
        }
        Value::Array(arr) => {
            for item in arr {
                results.push(item.clone());
                results.extend(descendants(item));
            }
        }
        _ => {}
    }
    results
}

fn tokenize(expr: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = expr.chars().collect();
    let start = if chars.first() == Some(&'$') { 1 } else { 0 };
    let mut i = start;

    while i < chars.len() {
        if chars[i] == '.' {
            if i + 1 < chars.len() && chars[i + 1] == '.' {
                tokens.push("..".to_string());
                i += 2;
            } else {
                i += 1;
            }
        } else if chars[i] == '[' {
            let mut depth = 1;
            let mut j = i + 1;
            while j < chars.len() && depth > 0 {
                if chars[j] == '[' { depth += 1; }
                if chars[j] == ']' { depth -= 1; }
                j += 1;
            }
            let token: String = chars[i..j].iter().collect();
            tokens.push(token);
            i = j;
        } else {
            let mut j = i;
            while j < chars.len() && chars[j] != '.' && chars[j] != '[' {
                j += 1;
            }
            let token: String = chars[i..j].iter().collect();
            tokens.push(token);
            i = j;
        }
    }
    tokens
}

fn evaluate_filter(node: &Value, filter_expr: &str) -> bool {
    // Parse @.field op value
    let expr = filter_expr.trim();
    if !expr.starts_with("@.") {
        return false;
    }
    let rest = &expr[2..];
    let ops = ["==", "!=", "<=", ">=", "<", ">"];
    for op in ops {
        if let Some(idx) = rest.find(op) {
            let field = rest[..idx].trim();
            let raw_val = rest[idx + op.len()..].trim();
            let field_val = match node {
                Value::Object(map) => map.get(field).cloned().unwrap_or(Value::Null),
                _ => return false,
            };
            let cmp_val = if raw_val.starts_with('\'') || raw_val.starts_with('"') {
                Value::Str(raw_val[1..raw_val.len() - 1].to_string())
            } else if let Ok(n) = raw_val.parse::<f64>() {
                Value::Number(n)
            } else {
                Value::Str(raw_val.to_string())
            };
            return compare_values(&field_val, op, &cmp_val);
        }
    }
    false
}

fn compare_values(left: &Value, op: &str, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => match op {
            "==" => (a - b).abs() < f64::EPSILON,
            "!=" => (a - b).abs() >= f64::EPSILON,
            "<" => a < b,
            ">" => a > b,
            "<=" => a <= b,
            ">=" => a >= b,
            _ => false,
        },
        (Value::Str(a), Value::Str(b)) => match op {
            "==" => a == b,
            "!=" => a != b,
            _ => false,
        },
        _ => false,
    }
}

fn apply_token(nodes: &[Value], token: &str) -> Vec<Value> {
    let mut results = Vec::new();

    if token == ".." {
        for node in nodes {
            results.extend(descendants(node));
        }
        return results;
    }

    if token.starts_with('[') && token.ends_with(']') {
        let inner = token[1..token.len() - 1].trim();

        if inner == "*" {
            for node in nodes {
                match node {
                    Value::Array(arr) => results.extend(arr.iter().cloned()),
                    Value::Object(map) => results.extend(map.values().cloned()),
                    _ => {}
                }
            }
        } else if inner.starts_with("?(") && inner.ends_with(')') {
            let filter = &inner[2..inner.len() - 1].trim();
            for node in nodes {
                if let Value::Array(arr) = node {
                    for item in arr {
                        if evaluate_filter(item, filter) {
                            results.push(item.clone());
                        }
                    }
                }
            }
        } else if let Ok(idx) = inner.parse::<i64>() {
            for node in nodes {
                if let Value::Array(arr) = node {
                    let resolved = if idx < 0 { arr.len() as i64 + idx } else { idx } as usize;
                    if resolved < arr.len() {
                        results.push(arr[resolved].clone());
                    }
                }
            }
        } else {
            let key = inner.trim_matches(|c| c == '\'' || c == '"');
            for node in nodes {
                if let Value::Object(map) = node {
                    if let Some(val) = map.get(key) {
                        results.push(val.clone());
                    }
                }
            }
        }
        return results;
    }

    // Property name
    for node in nodes {
        if let Value::Object(map) = node {
            if let Some(val) = map.get(token) {
                results.push(val.clone());
            }
        }
    }
    results
}

pub struct JsonPathMapperProvider;

impl JsonPathMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        _config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let tokens = tokenize(source_path.trim());
        let mut nodes = vec![record.clone()];

        for token in &tokens {
            nodes = apply_token(&nodes, token);
            if nodes.is_empty() {
                return Ok(Value::Null);
            }
        }

        if nodes.len() == 1 {
            Ok(nodes.into_iter().next().unwrap())
        } else {
            Ok(Value::Array(nodes))
        }
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "jsonpath" | "json_path")
    }
}
