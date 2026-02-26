// Transform Plugin Provider: expression
// Evaluate sandboxed math/string expressions with variable references.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "expression";
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
    EvalError(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            TransformError::EvalError(msg) => write!(f, "Evaluation error: {}", msg),
        }
    }
}

#[derive(Debug, Clone)]
enum Token {
    Number(f64),
    Str(String),
    Bool(bool),
    Ident(String),
    Op(String),
    LParen,
    RParen,
    Null,
}

pub struct ExpressionTransformProvider;

impl ExpressionTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let expr = match config.options.get("expression") {
            Some(Value::String(s)) => s.trim().to_string(),
            _ => return Ok(value.clone()),
        };

        if expr.is_empty() {
            return Ok(value.clone());
        }

        let mut context: HashMap<String, Value> = HashMap::new();
        context.insert("value".to_string(), value.clone());

        if let Some(Value::Object(vars)) = config.options.get("variables") {
            for (k, v) in vars {
                context.insert(k.clone(), v.clone());
            }
        }

        let tokens = self.tokenize(&expr);
        let (result, _) = self.parse_expression(&tokens, 0, &context);
        Ok(result)
    }

    fn tokenize(&self, expr: &str) -> Vec<Token> {
        let mut tokens = Vec::new();
        let chars: Vec<char> = expr.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            // Skip whitespace
            if chars[i].is_whitespace() { i += 1; continue; }

            // String literals
            if chars[i] == '"' || chars[i] == '\'' {
                let quote = chars[i];
                let mut s = String::new();
                i += 1;
                while i < chars.len() && chars[i] != quote {
                    if chars[i] == '\\' && i + 1 < chars.len() {
                        i += 1;
                        s.push(chars[i]);
                    } else {
                        s.push(chars[i]);
                    }
                    i += 1;
                }
                if i < chars.len() { i += 1; }
                tokens.push(Token::Str(s));
                continue;
            }

            // Numbers
            if chars[i].is_ascii_digit() || (chars[i] == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
                let mut num = String::new();
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                    num.push(chars[i]);
                    i += 1;
                }
                tokens.push(Token::Number(num.parse().unwrap_or(0.0)));
                continue;
            }

            // Two-character operators
            if i + 1 < chars.len() {
                let two: String = chars[i..=i + 1].iter().collect();
                if ["==", "!=", ">=", "<=", "&&", "||"].contains(&two.as_str()) {
                    tokens.push(Token::Op(two));
                    i += 2;
                    continue;
                }
            }

            // Single-character operators and punctuation
            if "+-*/%><!?:".contains(chars[i]) {
                tokens.push(Token::Op(chars[i].to_string()));
                i += 1;
                continue;
            }

            if chars[i] == '(' { tokens.push(Token::LParen); i += 1; continue; }
            if chars[i] == ')' { tokens.push(Token::RParen); i += 1; continue; }

            // Identifiers
            if chars[i].is_alphabetic() || chars[i] == '_' || chars[i] == '$' {
                let mut ident = String::new();
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_' || chars[i] == '$') {
                    ident.push(chars[i]);
                    i += 1;
                }
                match ident.as_str() {
                    "true" => tokens.push(Token::Bool(true)),
                    "false" => tokens.push(Token::Bool(false)),
                    "null" => tokens.push(Token::Null),
                    _ => tokens.push(Token::Ident(ident)),
                }
                continue;
            }

            i += 1;
        }
        tokens
    }

    fn parse_expression(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        self.parse_ternary(tokens, pos, ctx)
    }

    fn parse_ternary(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (cond, mut p) = self.parse_or(tokens, pos, ctx);
        if p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if op == "?" {
                    p += 1;
                    let (true_val, p2) = self.parse_expression(tokens, p, ctx);
                    p = p2;
                    if p < tokens.len() {
                        if let Token::Op(ref op2) = tokens[p] {
                            if op2 == ":" {
                                p += 1;
                                let (false_val, p3) = self.parse_expression(tokens, p, ctx);
                                let result = if self.is_truthy(&cond) { true_val } else { false_val };
                                return (result, p3);
                            }
                        }
                    }
                }
            }
        }
        (cond, p)
    }

    fn parse_or(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (mut left, mut p) = self.parse_and(tokens, pos, ctx);
        while p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if op == "||" {
                    p += 1;
                    let (right, p2) = self.parse_and(tokens, p, ctx);
                    left = Value::Boolean(self.is_truthy(&left) || self.is_truthy(&right));
                    p = p2;
                    continue;
                }
            }
            break;
        }
        (left, p)
    }

    fn parse_and(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (mut left, mut p) = self.parse_comparison(tokens, pos, ctx);
        while p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if op == "&&" {
                    p += 1;
                    let (right, p2) = self.parse_comparison(tokens, p, ctx);
                    left = Value::Boolean(self.is_truthy(&left) && self.is_truthy(&right));
                    p = p2;
                    continue;
                }
            }
            break;
        }
        (left, p)
    }

    fn parse_comparison(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (mut left, mut p) = self.parse_add_sub(tokens, pos, ctx);
        let cmp_ops = ["==", "!=", ">", "<", ">=", "<="];
        while p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if cmp_ops.contains(&op.as_str()) {
                    let op_str = op.clone();
                    p += 1;
                    let (right, p2) = self.parse_add_sub(tokens, p, ctx);
                    left = Value::Boolean(self.compare_values(&left, &op_str, &right));
                    p = p2;
                    continue;
                }
            }
            break;
        }
        (left, p)
    }

    fn parse_add_sub(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (mut left, mut p) = self.parse_mul_div(tokens, pos, ctx);
        while p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if op == "+" || op == "-" {
                    let op_str = op.clone();
                    p += 1;
                    let (right, p2) = self.parse_mul_div(tokens, p, ctx);
                    if op_str == "+" {
                        // String concatenation or numeric addition
                        match (&left, &right) {
                            (Value::String(a), _) => {
                                left = Value::String(format!("{}{}", a, self.value_to_string(&right)));
                            }
                            (_, Value::String(b)) => {
                                left = Value::String(format!("{}{}", self.value_to_string(&left), b));
                            }
                            _ => {
                                left = Value::Number(self.to_f64(&left) + self.to_f64(&right));
                            }
                        }
                    } else {
                        left = Value::Number(self.to_f64(&left) - self.to_f64(&right));
                    }
                    p = p2;
                    continue;
                }
            }
            break;
        }
        (left, p)
    }

    fn parse_mul_div(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        let (mut left, mut p) = self.parse_unary(tokens, pos, ctx);
        while p < tokens.len() {
            if let Token::Op(ref op) = tokens[p] {
                if op == "*" || op == "/" || op == "%" {
                    let op_str = op.clone();
                    p += 1;
                    let (right, p2) = self.parse_unary(tokens, p, ctx);
                    let a = self.to_f64(&left);
                    let b = self.to_f64(&right);
                    left = match op_str.as_str() {
                        "*" => Value::Number(a * b),
                        "/" => if b == 0.0 { Value::Null } else { Value::Number(a / b) },
                        "%" => if b == 0.0 { Value::Null } else { Value::Number(a % b) },
                        _ => Value::Null,
                    };
                    p = p2;
                    continue;
                }
            }
            break;
        }
        (left, p)
    }

    fn parse_unary(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        if pos < tokens.len() {
            if let Token::Op(ref op) = tokens[pos] {
                if op == "!" {
                    let (val, p) = self.parse_unary(tokens, pos + 1, ctx);
                    return (Value::Boolean(!self.is_truthy(&val)), p);
                }
                if op == "-" {
                    let (val, p) = self.parse_primary(tokens, pos + 1, ctx);
                    return (Value::Number(-self.to_f64(&val)), p);
                }
            }
        }
        self.parse_primary(tokens, pos, ctx)
    }

    fn parse_primary(&self, tokens: &[Token], pos: usize, ctx: &HashMap<String, Value>) -> (Value, usize) {
        if pos >= tokens.len() {
            return (Value::Null, pos);
        }

        match &tokens[pos] {
            Token::LParen => {
                let (val, mut p) = self.parse_expression(tokens, pos + 1, ctx);
                if p < tokens.len() {
                    if let Token::RParen = tokens[p] { p += 1; }
                }
                (val, p)
            }
            Token::Number(n) => (Value::Number(*n), pos + 1),
            Token::Str(s) => (Value::String(s.clone()), pos + 1),
            Token::Bool(b) => (Value::Boolean(*b), pos + 1),
            Token::Null => (Value::Null, pos + 1),
            Token::Ident(name) => {
                let val = ctx.get(name).cloned().unwrap_or(Value::Null);
                (val, pos + 1)
            }
            _ => (Value::Null, pos + 1),
        }
    }

    fn is_truthy(&self, value: &Value) -> bool {
        match value {
            Value::Boolean(b) => *b,
            Value::Number(n) => *n != 0.0,
            Value::Integer(n) => *n != 0,
            Value::String(s) => !s.is_empty(),
            Value::Null => false,
            Value::Array(a) => !a.is_empty(),
            Value::Object(o) => !o.is_empty(),
        }
    }

    fn to_f64(&self, value: &Value) -> f64 {
        match value {
            Value::Number(n) => *n,
            Value::Integer(n) => *n as f64,
            Value::String(s) => s.parse().unwrap_or(0.0),
            Value::Boolean(b) => if *b { 1.0 } else { 0.0 },
            _ => 0.0,
        }
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

    fn compare_values(&self, a: &Value, op: &str, b: &Value) -> bool {
        match op {
            "==" => self.values_equal(a, b),
            "!=" => !self.values_equal(a, b),
            ">" => self.to_f64(a) > self.to_f64(b),
            "<" => self.to_f64(a) < self.to_f64(b),
            ">=" => self.to_f64(a) >= self.to_f64(b),
            "<=" => self.to_f64(a) <= self.to_f64(b),
            _ => false,
        }
    }

    fn values_equal(&self, a: &Value, b: &Value) -> bool {
        match (a, b) {
            (Value::Number(x), Value::Number(y)) => (x - y).abs() < f64::EPSILON,
            (Value::Integer(x), Value::Integer(y)) => x == y,
            (Value::String(x), Value::String(y)) => x == y,
            (Value::Boolean(x), Value::Boolean(y)) => x == y,
            (Value::Null, Value::Null) => true,
            _ => false,
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }
}
