// Computed field mapper — sandboxed expression evaluation against record context
// Supports: arithmetic (+, -, *, /, %), string concat, comparisons,
// ternary conditions, and field references by name

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "computed";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    ParseError(String),
    EvalError(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::ParseError(e) => write!(f, "parse error: {}", e),
            MapperError::EvalError(e) => write!(f, "eval error: {}", e),
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

fn resolve_field(record: &Value, name: &str) -> Value {
    let parts: Vec<&str> = name.split('.').collect();
    let mut current = record;
    for part in parts {
        match current {
            Value::Object(map) => match map.get(part) {
                Some(v) => current = v,
                None => return Value::Null,
            },
            _ => return Value::Null,
        }
    }
    current.clone()
}

fn tokenize_expr(expr: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = expr.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i].is_whitespace() {
            i += 1;
            continue;
        }
        if chars[i] == '"' || chars[i] == '\'' {
            let quote = chars[i];
            let mut j = i + 1;
            while j < chars.len() && chars[j] != quote {
                if chars[j] == '\\' { j += 1; }
                j += 1;
            }
            let token: String = chars[i..=j.min(chars.len() - 1)].iter().collect();
            tokens.push(token);
            i = j + 1;
        } else if chars[i].is_ascii_digit() || (chars[i] == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
            let mut j = i;
            while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == '.') { j += 1; }
            let token: String = chars[i..j].iter().collect();
            tokens.push(token);
            i = j;
        } else if chars[i].is_ascii_alphabetic() || chars[i] == '_' {
            let mut j = i;
            while j < chars.len() && (chars[j].is_ascii_alphanumeric() || chars[j] == '_' || chars[j] == '.') { j += 1; }
            let token: String = chars[i..j].iter().collect();
            tokens.push(token);
            i = j;
        } else if i + 1 < chars.len() {
            let two: String = chars[i..i + 2].iter().collect();
            if matches!(two.as_str(), "==" | "!=" | "<=" | ">=" | "&&" | "||") {
                tokens.push(two);
                i += 2;
            } else {
                tokens.push(chars[i].to_string());
                i += 1;
            }
        } else {
            tokens.push(chars[i].to_string());
            i += 1;
        }
    }
    tokens
}

struct Parser {
    tokens: Vec<String>,
    pos: usize,
    record: Value,
}

impl Parser {
    fn new(tokens: Vec<String>, record: Value) -> Self {
        Self { tokens, pos: 0, record }
    }

    fn peek(&self) -> Option<&str> {
        self.tokens.get(self.pos).map(|s| s.as_str())
    }

    fn advance(&mut self) -> String {
        let t = self.tokens[self.pos].clone();
        self.pos += 1;
        t
    }

    fn parse(&mut self) -> Value {
        self.parse_ternary()
    }

    fn parse_ternary(&mut self) -> Value {
        let cond = self.parse_or();
        if self.peek() == Some("?") {
            self.advance();
            let then_val = self.parse_ternary();
            if self.peek() == Some(":") { self.advance(); }
            let else_val = self.parse_ternary();
            return if is_truthy(&cond) { then_val } else { else_val };
        }
        cond
    }

    fn parse_or(&mut self) -> Value {
        let mut left = self.parse_and();
        while self.peek() == Some("||") {
            self.advance();
            let right = self.parse_and();
            left = Value::Bool(is_truthy(&left) || is_truthy(&right));
        }
        left
    }

    fn parse_and(&mut self) -> Value {
        let mut left = self.parse_comparison();
        while self.peek() == Some("&&") {
            self.advance();
            let right = self.parse_comparison();
            left = Value::Bool(is_truthy(&left) && is_truthy(&right));
        }
        left
    }

    fn parse_comparison(&mut self) -> Value {
        let left = self.parse_add_sub();
        if let Some(op) = self.peek() {
            if matches!(op, "==" | "!=" | "<" | ">" | "<=" | ">=") {
                let op = self.advance();
                let right = self.parse_add_sub();
                return Value::Bool(compare(&left, &op, &right));
            }
        }
        left
    }

    fn parse_add_sub(&mut self) -> Value {
        let mut left = self.parse_mul_div();
        while matches!(self.peek(), Some("+") | Some("-")) {
            let op = self.advance();
            let right = self.parse_mul_div();
            left = if op == "+" {
                match (&left, &right) {
                    (Value::Str(a), _) => Value::Str(format!("{}{}", a, val_to_string(&right))),
                    (_, Value::Str(b)) => Value::Str(format!("{}{}", val_to_string(&left), b)),
                    _ => Value::Number(as_number(&left) + as_number(&right)),
                }
            } else {
                Value::Number(as_number(&left) - as_number(&right))
            };
        }
        left
    }

    fn parse_mul_div(&mut self) -> Value {
        let mut left = self.parse_unary();
        while matches!(self.peek(), Some("*") | Some("/") | Some("%")) {
            let op = self.advance();
            let right = self.parse_unary();
            let (l, r) = (as_number(&left), as_number(&right));
            left = match op.as_str() {
                "*" => Value::Number(l * r),
                "/" => if r != 0.0 { Value::Number(l / r) } else { Value::Null },
                "%" => if r != 0.0 { Value::Number(l % r) } else { Value::Null },
                _ => Value::Null,
            };
        }
        left
    }

    fn parse_unary(&mut self) -> Value {
        if self.peek() == Some("-") {
            self.advance();
            let v = self.parse_primary();
            return Value::Number(-as_number(&v));
        }
        if self.peek() == Some("!") {
            self.advance();
            let v = self.parse_primary();
            return Value::Bool(!is_truthy(&v));
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Value {
        let token = match self.peek() {
            Some(_) => self.advance(),
            None => return Value::Null,
        };

        if token == "(" {
            let val = self.parse_ternary();
            if self.peek() == Some(")") { self.advance(); }
            return val;
        }

        if (token.starts_with('"') || token.starts_with('\'')) && token.len() >= 2 {
            let inner = &token[1..token.len() - 1];
            return Value::Str(inner.replace("\\n", "\n").replace("\\t", "\t"));
        }

        if token == "true" { return Value::Bool(true); }
        if token == "false" { return Value::Bool(false); }
        if token == "null" { return Value::Null; }

        if let Ok(n) = token.parse::<f64>() {
            return Value::Number(n);
        }

        // Field reference
        resolve_field(&self.record, &token)
    }
}

fn is_truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => *n != 0.0,
        Value::Str(s) => !s.is_empty(),
        _ => true,
    }
}

fn as_number(v: &Value) -> f64 {
    match v {
        Value::Number(n) => *n,
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        Value::Str(s) => s.parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn val_to_string(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Str(s) => s.clone(),
        _ => String::from("[object]"),
    }
}

fn compare(left: &Value, op: &str, right: &Value) -> bool {
    let (l, r) = (as_number(left), as_number(right));
    match op {
        "==" => left == right || (l - r).abs() < f64::EPSILON,
        "!=" => left != right && (l - r).abs() >= f64::EPSILON,
        "<" => l < r,
        ">" => l > r,
        "<=" => l <= r,
        ">=" => l >= r,
        _ => false,
    }
}

pub struct ComputedMapperProvider;

impl ComputedMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        _config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let expr = source_path.trim();
        if expr.is_empty() {
            return Err(MapperError::ParseError("empty expression".to_string()));
        }
        let tokens = tokenize_expr(expr);
        let mut parser = Parser::new(tokens, record.clone());
        Ok(parser.parse())
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "expression" | "computed" | "expr")
    }
}
