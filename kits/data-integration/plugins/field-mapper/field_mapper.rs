// Field Mapper Plugin — source path resolution implementations for the FieldMapping concept
// Provides pluggable path syntax resolvers to extract values from raw records using
// direct dot-notation, JSONPath, XPath, regex, template interpolation, and computed expressions.
// See Data Integration Kit field-mapping.concept for the parent FieldMapping concept definition.

use std::collections::HashMap;
use std::fmt;

use regex::Regex;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// A raw source record represented as a JSON value (typically an object).
pub type RawRecord = Value;

/// Configuration for a mapper provider.
#[derive(Debug, Clone, Default)]
pub struct MapperConfig {
    pub return_all: bool,
    pub default_value: Option<Value>,
    pub namespaces: Option<HashMap<String, String>>,
    pub regex_flags: Option<String>,
    pub capture_group: Option<CaptureGroupRef>,
    pub format_specifiers: Option<HashMap<String, String>>,
    pub fallback_values: Option<HashMap<String, Value>>,
    pub provider_options: Option<HashMap<String, Value>>,
}

/// Reference to a regex capture group — either named or numbered.
#[derive(Debug, Clone)]
pub enum CaptureGroupRef {
    Named(String),
    Numbered(usize),
}

/// Errors that can occur during field mapping.
#[derive(Debug)]
pub enum FieldMapperError {
    UnsupportedSyntax { provider: String, path: String },
    InvalidExpression { detail: String },
    ResolutionFailed { path: String, detail: String },
}

impl fmt::Display for FieldMapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedSyntax { provider, path } =>
                write!(f, "{provider} does not support path syntax: {path}"),
            Self::InvalidExpression { detail } =>
                write!(f, "Invalid expression: {detail}"),
            Self::ResolutionFailed { path, detail } =>
                write!(f, "Failed to resolve '{path}': {detail}"),
        }
    }
}

impl std::error::Error for FieldMapperError {}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Interface every field-mapper provider must implement.
pub trait FieldMapperPlugin: Send + Sync {
    /// Unique identifier for this provider.
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// Resolve a source path to a value within the given record.
    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value;

    /// Check whether this provider supports the given path syntax.
    fn supports(&self, path_syntax: &str) -> bool;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Safely retrieve a value from a nested JSON structure using an array of keys.
fn get_nested_value<'a>(obj: &'a Value, keys: &[String]) -> Option<&'a Value> {
    let mut current = obj;
    for key in keys {
        match current {
            Value::Object(map) => {
                current = map.get(key.as_str())?;
            }
            Value::Array(arr) => {
                let idx: usize = key.parse().ok()?;
                current = arr.get(idx)?;
            }
            _ => return None,
        }
    }
    Some(current)
}

/// Parse a dot-notation path with bracket support into an array of keys.
fn parse_dot_path(path: &str) -> Vec<String> {
    let mut keys = Vec::new();
    for segment in path.split('.') {
        if segment.contains('[') {
            keys.extend(expand_brackets(segment));
        } else {
            keys.push(segment.to_string());
        }
    }
    keys
}

/// Parse bracket-notation segments like `items[0]` into `["items", "0"]`.
fn expand_brackets(segment: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let re = Regex::new(r"^([^\[]*)\[([^\]]+)\](.*)$").unwrap();

    if let Some(caps) = re.captures(segment) {
        let key = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        if !key.is_empty() {
            parts.push(key.to_string());
        }
        parts.push(caps[2].to_string());

        let mut remaining = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();
        let chain_re = Regex::new(r"^\[([^\]]+)\](.*)$").unwrap();
        while !remaining.is_empty() {
            if let Some(chain_caps) = chain_re.captures(&remaining) {
                parts.push(chain_caps[1].to_string());
                remaining = chain_caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
            } else {
                break;
            }
        }
    } else {
        parts.push(segment.to_string());
    }

    parts
}

/// Return the default value from config, or JSON null.
fn default_or_null(config: &MapperConfig) -> Value {
    config.default_value.clone().unwrap_or(Value::Null)
}

// ---------------------------------------------------------------------------
// 1. DirectMapper — direct key-to-key mapping with dot notation
// ---------------------------------------------------------------------------

/// DirectMapper resolves field values using simple dot-notation paths.
///
/// Supported syntax:
///   - Simple key: `name`
///   - Nested path: `address.city`
///   - Array index: `items[0].name`
///   - Wildcard: `items[*].name` (returns array of all matching values)
///   - Deep wildcard: `**.name` (recursive search for key)
///
/// Reference: Drupal Feeds simple field mapping.
pub struct DirectMapper;

impl FieldMapperPlugin for DirectMapper {
    fn id(&self) -> &str { "direct" }
    fn display_name(&self) -> &str { "Direct Field Mapper (Dot Notation)" }

    fn supports(&self, path_syntax: &str) -> bool {
        if path_syntax.starts_with("$.") || path_syntax.starts_with("//") || path_syntax.starts_with('{') {
            return false;
        }
        if Regex::new(r"^/.*/$").unwrap().is_match(path_syntax) { return false; }
        if path_syntax.starts_with("**.") { return true; }
        Regex::new(r"^[a-zA-Z_][\w.*\[\]0-9-]*$").unwrap().is_match(path_syntax)
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        // Deep wildcard
        if source_path.starts_with("**.") {
            let target_key = &source_path[3..];
            let results = recursive_search(record, target_key);
            if results.is_empty() { return default_or_null(config); }
            if config.return_all { return Value::Array(results); }
            return results.into_iter().next().unwrap_or_else(|| default_or_null(config));
        }

        let keys = parse_dot_path(source_path);

        // Check for wildcard segments
        if let Some(wildcard_idx) = keys.iter().position(|k| k == "*") {
            return resolve_wildcard(record, &keys, wildcard_idx, config);
        }

        get_nested_value(record, &keys)
            .cloned()
            .unwrap_or_else(|| default_or_null(config))
    }
}

/// Recursively search all nested objects and arrays for a key.
fn recursive_search(obj: &Value, target_key: &str) -> Vec<Value> {
    let mut results = Vec::new();
    match obj {
        Value::Object(map) => {
            if let Some(val) = map.get(target_key) {
                results.push(val.clone());
            }
            for (_, value) in map {
                if value.is_object() || value.is_array() {
                    results.extend(recursive_search(value, target_key));
                }
            }
        }
        Value::Array(arr) => {
            for item in arr {
                results.extend(recursive_search(item, target_key));
            }
        }
        _ => {}
    }
    results
}

/// Resolve a path containing a wildcard [*] segment.
fn resolve_wildcard(record: &Value, keys: &[String], wildcard_idx: usize, config: &MapperConfig) -> Value {
    let prefix = &keys[..wildcard_idx];
    let suffix = &keys[wildcard_idx + 1..];
    let container = if prefix.is_empty() {
        record.clone()
    } else {
        get_nested_value(record, prefix).cloned().unwrap_or(Value::Null)
    };

    let arr = match container.as_array() {
        Some(a) => a,
        None => return default_or_null(config),
    };

    let mut results = Vec::new();
    for item in arr {
        if suffix.is_empty() {
            results.push(item.clone());
        } else if let Some(nested_wildcard) = suffix.iter().position(|k| k == "*") {
            let nested = resolve_wildcard(item, suffix, nested_wildcard, config);
            if let Value::Array(nested_arr) = nested {
                results.extend(nested_arr);
            } else if nested != Value::Null {
                results.push(nested);
            }
        } else if let Some(value) = get_nested_value(item, suffix) {
            results.push(value.clone());
        }
    }

    if results.is_empty() { return default_or_null(config); }
    if config.return_all { Value::Array(results) } else { results.into_iter().next().unwrap() }
}

// ---------------------------------------------------------------------------
// 2. JsonPathMapper — JSONPath expressions for complex JSON navigation
// ---------------------------------------------------------------------------

/// JsonPathMapper resolves values from JSON records using JSONPath expressions.
///
/// Supported syntax (RFC 9535 / Goessner specification):
///   - Root: `$`
///   - Child: `$.store.name`
///   - Recursive descent: `$..name`
///   - Array index: `$.items[0]`, negative indices `$.items[-1]`
///   - Array slice: `$.items[0:5]`, `$.items[::2]`
///   - Wildcard: `$.items[*]`
///   - Filter: `$.items[?(@.price < 10)]`
///   - Union: `$.items[0,2,4]`
///
/// Reference: Drupal External Entities JSONPath mapper.
pub struct JsonPathMapper;

#[derive(Debug, Clone)]
enum JpToken {
    Child(String),
    Index(i64),
    Wildcard,
    RecursiveDescent(String),
    Filter(String),
    Slice(String),
    Union(String),
}

impl FieldMapperPlugin for JsonPathMapper {
    fn id(&self) -> &str { "jsonpath" }
    fn display_name(&self) -> &str { "JSONPath Expression Mapper" }

    fn supports(&self, path_syntax: &str) -> bool {
        path_syntax.starts_with('$')
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        let results = jp_evaluate(record, source_path);
        if results.is_empty() { return default_or_null(config); }
        if config.return_all { Value::Array(results) } else { results.into_iter().next().unwrap() }
    }
}

fn jp_evaluate(root: &Value, path: &str) -> Vec<Value> {
    let tokens = jp_tokenize(path);
    let mut current = vec![root.clone()];

    for token in &tokens {
        let mut next = Vec::new();
        for node in &current {
            next.extend(jp_apply_token(root, node, token));
        }
        current = next;
    }

    current
}

fn jp_tokenize(path: &str) -> Vec<JpToken> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = path.chars().collect();
    let mut i = 0;

    // Skip leading $
    if i < chars.len() && chars[i] == '$' { i += 1; }

    while i < chars.len() {
        if chars[i] == '.' && i + 1 < chars.len() && chars[i + 1] == '.' {
            // Recursive descent
            i += 2;
            let name = jp_read_name(&chars, &mut i);
            tokens.push(JpToken::RecursiveDescent(name));
        } else if chars[i] == '.' {
            i += 1;
            let name = jp_read_name(&chars, &mut i);
            tokens.push(JpToken::Child(name));
        } else if chars[i] == '[' {
            let (token, end) = jp_read_bracket(&chars, i);
            tokens.push(token);
            i = end;
        } else {
            let name = jp_read_name(&chars, &mut i);
            if !name.is_empty() {
                tokens.push(JpToken::Child(name));
            }
        }
    }

    tokens
}

fn jp_read_name(chars: &[char], i: &mut usize) -> String {
    let mut name = String::new();
    while *i < chars.len() && chars[*i] != '.' && chars[*i] != '[' {
        name.push(chars[*i]);
        *i += 1;
    }
    name
}

fn jp_read_bracket(chars: &[char], start: usize) -> (JpToken, usize) {
    let mut depth = 0;
    let mut i = start;
    let mut in_string = false;
    let mut string_char = ' ';

    while i < chars.len() {
        if !in_string {
            if chars[i] == '[' { depth += 1; }
            else if chars[i] == ']' {
                depth -= 1;
                if depth == 0 { break; }
            }
            else if chars[i] == '\'' || chars[i] == '"' {
                in_string = true;
                string_char = chars[i];
            }
        } else if chars[i] == string_char {
            in_string = false;
        }
        i += 1;
    }

    let inner: String = chars[start + 1..i].iter().collect::<String>().trim().to_string();
    let end = if i < chars.len() { i + 1 } else { i };

    if inner == "*" {
        return (JpToken::Wildcard, end);
    }
    if inner.starts_with('?') {
        return (JpToken::Filter(inner[1..].trim().to_string()), end);
    }
    if inner.contains(':') && !inner.starts_with('\'') && !inner.starts_with('"') {
        return (JpToken::Slice(inner), end);
    }
    if inner.contains(',') {
        return (JpToken::Union(inner), end);
    }
    if (inner.starts_with('\'') && inner.ends_with('\'')) ||
       (inner.starts_with('"') && inner.ends_with('"')) {
        return (JpToken::Child(inner[1..inner.len()-1].to_string()), end);
    }
    if let Ok(num) = inner.parse::<i64>() {
        return (JpToken::Index(num), end);
    }
    (JpToken::Child(inner), end)
}

fn jp_apply_token(root: &Value, node: &Value, token: &JpToken) -> Vec<Value> {
    match token {
        JpToken::Child(name) => {
            if name == "*" { return jp_get_wildcard(node); }
            match node.as_object() {
                Some(map) => map.get(name.as_str()).cloned().into_iter().collect(),
                None => vec![],
            }
        }
        JpToken::Index(idx) => {
            match node.as_array() {
                Some(arr) => {
                    let normalized = if *idx < 0 { arr.len() as i64 + idx } else { *idx } as usize;
                    arr.get(normalized).cloned().into_iter().collect()
                }
                None => vec![],
            }
        }
        JpToken::Wildcard => jp_get_wildcard(node),
        JpToken::RecursiveDescent(key) => jp_recursive_descent(node, key),
        JpToken::Filter(expr) => {
            match node.as_array() {
                Some(arr) => arr.iter()
                    .filter(|item| jp_evaluate_filter(root, item, expr))
                    .cloned()
                    .collect(),
                None => vec![],
            }
        }
        JpToken::Slice(expr) => {
            match node.as_array() {
                Some(arr) => jp_apply_slice(arr, expr),
                None => vec![],
            }
        }
        JpToken::Union(expr) => jp_apply_union(node, expr),
    }
}

fn jp_get_wildcard(node: &Value) -> Vec<Value> {
    match node {
        Value::Array(arr) => arr.clone(),
        Value::Object(map) => map.values().cloned().collect(),
        _ => vec![],
    }
}

fn jp_recursive_descent(node: &Value, key: &str) -> Vec<Value> {
    let mut results = Vec::new();
    match node {
        Value::Object(map) => {
            if key == "*" {
                results.extend(map.values().cloned());
            } else if let Some(val) = map.get(key) {
                results.push(val.clone());
            }
            for (_, val) in map {
                if val.is_object() || val.is_array() {
                    results.extend(jp_recursive_descent(val, key));
                }
            }
        }
        Value::Array(arr) => {
            for item in arr {
                results.extend(jp_recursive_descent(item, key));
            }
        }
        _ => {}
    }
    results
}

fn jp_evaluate_filter(root: &Value, item: &Value, expr: &str) -> bool {
    let mut filter_expr = expr.trim();
    if filter_expr.starts_with('(') && filter_expr.ends_with(')') {
        filter_expr = &filter_expr[1..filter_expr.len()-1];
        filter_expr = filter_expr.trim();
    }

    // Handle && and ||
    if let Some(pos) = find_logical_op(filter_expr, "&&") {
        let left = &filter_expr[..pos];
        let right = &filter_expr[pos + 2..];
        return jp_evaluate_filter(root, item, left) && jp_evaluate_filter(root, item, right);
    }
    if let Some(pos) = find_logical_op(filter_expr, "||") {
        let left = &filter_expr[..pos];
        let right = &filter_expr[pos + 2..];
        return jp_evaluate_filter(root, item, left) || jp_evaluate_filter(root, item, right);
    }

    // Parse comparison
    let comp_re = Regex::new(r"^(@[^<>=!]+?)\s*(===?|!==?|<=?|>=?)\s*(.+)$").unwrap();
    if let Some(caps) = comp_re.captures(filter_expr) {
        let left_path = caps[1].trim();
        let operator = &caps[2];
        let right_raw = caps[3].trim();

        let left_val = jp_resolve_filter_path(root, item, left_path);
        let right_val = jp_parse_filter_value(right_raw);

        return jp_compare_values(&left_val, operator, &right_val);
    }

    // Existence check
    if filter_expr.starts_with('@') {
        let value = jp_resolve_filter_path(root, item, filter_expr);
        return !value.is_null();
    }

    false
}

fn find_logical_op(expr: &str, op: &str) -> Option<usize> {
    let mut depth = 0;
    let chars: Vec<char> = expr.chars().collect();
    let op_chars: Vec<char> = op.chars().collect();

    for i in 0..chars.len() {
        if chars[i] == '(' { depth += 1; }
        else if chars[i] == ')' { depth -= 1; }
        if depth == 0 && i + op_chars.len() <= chars.len() {
            let slice: String = chars[i..i + op_chars.len()].iter().collect();
            if slice == op { return Some(i); }
        }
    }
    None
}

fn jp_resolve_filter_path(root: &Value, item: &Value, path: &str) -> Value {
    if path.starts_with("@.") {
        let keys = parse_dot_path(&path[2..]);
        return get_nested_value(item, &keys).cloned().unwrap_or(Value::Null);
    }
    if path.starts_with("$.") {
        let keys = parse_dot_path(&path[2..]);
        return get_nested_value(root, &keys).cloned().unwrap_or(Value::Null);
    }
    Value::Null
}

fn jp_parse_filter_value(raw: &str) -> Value {
    let raw = raw.trim();
    if (raw.starts_with('\'') && raw.ends_with('\'')) ||
       (raw.starts_with('"') && raw.ends_with('"')) {
        return Value::String(raw[1..raw.len()-1].to_string());
    }
    if let Ok(num) = raw.parse::<f64>() {
        return serde_json::Number::from_f64(num)
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if raw == "true" { return Value::Bool(true); }
    if raw == "false" { return Value::Bool(false); }
    if raw == "null" { return Value::Null; }
    Value::String(raw.to_string())
}

fn jp_compare_values(left: &Value, op: &str, right: &Value) -> bool {
    match op {
        "==" | "===" => left == right,
        "!=" | "!==" => left != right,
        "<" => value_to_f64(left) < value_to_f64(right),
        "<=" => value_to_f64(left) <= value_to_f64(right),
        ">" => value_to_f64(left) > value_to_f64(right),
        ">=" => value_to_f64(left) >= value_to_f64(right),
        _ => false,
    }
}

fn value_to_f64(val: &Value) -> f64 {
    match val {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::String(s) => s.parse().unwrap_or(0.0),
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        _ => 0.0,
    }
}

fn value_to_string(val: &Value) -> String {
    match val {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => String::new(),
        _ => val.to_string(),
    }
}

fn jp_apply_slice(arr: &[Value], expr: &str) -> Vec<Value> {
    let parts: Vec<&str> = expr.split(':').map(|s| s.trim()).collect();
    let len = arr.len() as i64;

    let start = if !parts.is_empty() && !parts[0].is_empty() {
        let s = parts[0].parse::<i64>().unwrap_or(0);
        if s < 0 { (len + s).max(0) as usize } else { s.min(len) as usize }
    } else { 0 };

    let end = if parts.len() > 1 && !parts[1].is_empty() {
        let e = parts[1].parse::<i64>().unwrap_or(len);
        if e < 0 { (len + e).max(0) as usize } else { e.min(len) as usize }
    } else { len as usize };

    let step = if parts.len() > 2 && !parts[2].is_empty() {
        parts[2].parse::<i64>().unwrap_or(1)
    } else { 1 };

    if step == 0 { return vec![]; }

    let mut results = Vec::new();
    if step > 0 {
        let mut i = start;
        while i < end {
            results.push(arr[i].clone());
            i += step as usize;
        }
    }
    results
}

fn jp_apply_union(node: &Value, expr: &str) -> Vec<Value> {
    let parts: Vec<&str> = expr.split(',').map(|s| s.trim()).collect();
    let mut results = Vec::new();

    for part in parts {
        if (part.starts_with('\'') && part.ends_with('\'')) ||
           (part.starts_with('"') && part.ends_with('"')) {
            let key = &part[1..part.len()-1];
            if let Some(val) = node.as_object().and_then(|m| m.get(key)) {
                results.push(val.clone());
            }
        } else if let Ok(idx) = part.parse::<i64>() {
            if let Some(arr) = node.as_array() {
                let normalized = if idx < 0 { arr.len() as i64 + idx } else { idx } as usize;
                if let Some(val) = arr.get(normalized) {
                    results.push(val.clone());
                }
            }
        }
    }

    results
}

// ---------------------------------------------------------------------------
// 3. XPathMapper — XPath expressions for XML source records
// ---------------------------------------------------------------------------

/// XPathMapper resolves values from XML source records using XPath expressions.
///
/// The record is expected to contain an `_xml` key with raw XML, or a pre-parsed
/// object representation.
///
/// Reference: Drupal Migrate XML source.
pub struct XPathMapper;

#[derive(Debug, Clone)]
struct XmlNode {
    tag: String,
    attrs: HashMap<String, String>,
    children: Vec<XmlNode>,
    text: String,
}

#[derive(Debug, Clone)]
struct XPathStep {
    axis: String,
    node_test: String,
    predicates: Vec<String>,
}

impl FieldMapperPlugin for XPathMapper {
    fn id(&self) -> &str { "xpath" }
    fn display_name(&self) -> &str { "XPath Expression Mapper" }

    fn supports(&self, path_syntax: &str) -> bool {
        path_syntax.starts_with('/') || path_syntax.starts_with("//") ||
        path_syntax.contains("::") ||
        (path_syntax.starts_with('.') && path_syntax.contains('/'))
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        let root = match record.get("_xml").and_then(|v| v.as_str()) {
            Some(xml) => parse_xml(xml),
            None => record_to_xml_node(record),
        };

        let namespaces = config.namespaces.clone().unwrap_or_default();
        let results = evaluate_xpath(&root, source_path, &namespaces);

        if results.is_empty() { return default_or_null(config); }
        if config.return_all {
            Value::Array(results.into_iter().map(|s| Value::String(s)).collect())
        } else {
            Value::String(results.into_iter().next().unwrap_or_default())
        }
    }
}

fn parse_xml(xml: &str) -> XmlNode {
    let mut root = XmlNode {
        tag: "#document".to_string(),
        attrs: HashMap::new(),
        children: Vec::new(),
        text: String::new(),
    };
    let mut stack: Vec<XmlNode> = vec![root.clone()];

    let tag_re = Regex::new(r"</?([a-zA-Z_][\w.:_-]*)([^>]*?)(/?)>|([^<]+)").unwrap();

    for caps in tag_re.captures_iter(xml) {
        // Text content
        if let Some(text_match) = caps.get(4) {
            let text = text_match.as_str().trim();
            if !text.is_empty() {
                if let Some(parent) = stack.last_mut() {
                    parent.text.push_str(text);
                }
            }
            continue;
        }

        let tag_name = match caps.get(1) {
            Some(m) => m.as_str().to_string(),
            None => continue,
        };

        let full_match = caps.get(0).map(|m| m.as_str()).unwrap_or("");
        let is_closing = full_match.starts_with("</");
        let is_self_closing = caps.get(3).map(|m| m.as_str()) == Some("/");

        if is_closing {
            if stack.len() > 1 {
                let completed = stack.pop().unwrap();
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(completed);
                }
            }
        } else {
            let mut attrs = HashMap::new();
            if let Some(attrs_str) = caps.get(2).map(|m| m.as_str()) {
                let attr_re = Regex::new(r#"([a-zA-Z_][\w.:_-]*)=["']([^"']*)["']"#).unwrap();
                for attr_caps in attr_re.captures_iter(attrs_str) {
                    attrs.insert(attr_caps[1].to_string(), attr_caps[2].to_string());
                }
            }

            let node = XmlNode {
                tag: tag_name,
                attrs,
                children: Vec::new(),
                text: String::new(),
            };

            if is_self_closing {
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(node);
                }
            } else {
                stack.push(node);
            }
        }
    }

    // Flush remaining stack
    while stack.len() > 1 {
        let completed = stack.pop().unwrap();
        if let Some(parent) = stack.last_mut() {
            parent.children.push(completed);
        }
    }

    root = stack.pop().unwrap_or(root);
    if root.children.len() == 1 {
        root.children.into_iter().next().unwrap()
    } else {
        root
    }
}

fn record_to_xml_node(record: &Value) -> XmlNode {
    fn convert(key: &str, value: &Value) -> XmlNode {
        match value {
            Value::Object(map) => {
                let mut children = Vec::new();
                let mut text = String::new();
                let mut attrs = HashMap::new();

                for (k, v) in map {
                    if k.starts_with('@') {
                        attrs.insert(k[1..].to_string(), value_to_string(v));
                    } else if k == "#text" || k == "_text" {
                        text = value_to_string(v);
                    } else if let Value::Array(arr) = v {
                        for item in arr { children.push(convert(k, item)); }
                    } else {
                        children.push(convert(k, v));
                    }
                }

                XmlNode { tag: key.to_string(), attrs, children, text }
            }
            _ => XmlNode {
                tag: key.to_string(),
                attrs: HashMap::new(),
                children: Vec::new(),
                text: value_to_string(value),
            },
        }
    }

    let mut root = XmlNode {
        tag: "#document".to_string(),
        attrs: HashMap::new(),
        children: Vec::new(),
        text: String::new(),
    };

    if let Value::Object(map) = record {
        for (key, value) in map {
            if key.starts_with('_') { continue; }
            if let Value::Array(arr) = value {
                for item in arr { root.children.push(convert(key, item)); }
            } else {
                root.children.push(convert(key, value));
            }
        }
    }

    if root.children.len() == 1 { root.children.into_iter().next().unwrap() } else { root }
}

fn evaluate_xpath(root: &XmlNode, path: &str, namespaces: &HashMap<String, String>) -> Vec<String> {
    let steps = parse_xpath_steps(path);
    let mut current = vec![root.clone()];

    for step in &steps {
        let mut next = Vec::new();
        for node in &current {
            next.extend(apply_xpath_step(root, node, step, namespaces));
        }
        current = next;
    }

    current.iter().filter_map(|node| {
        if node.tag.starts_with('@') {
            Some(node.text.clone())
        } else if node.children.is_empty() {
            if node.text.is_empty() { None } else { Some(node.text.clone()) }
        } else {
            let text = collect_text(node);
            if text.is_empty() { None } else { Some(text) }
        }
    }).collect()
}

fn collect_text(node: &XmlNode) -> String {
    let mut text = node.text.clone();
    for child in &node.children {
        text.push_str(&collect_text(child));
    }
    text
}

fn parse_xpath_steps(path: &str) -> Vec<XPathStep> {
    let mut steps = Vec::new();
    let mut remaining = path.trim().to_string();

    while !remaining.is_empty() {
        if remaining.starts_with("//") {
            remaining = remaining[2..].to_string();
            let (step, rest) = read_xpath_step(&remaining);
            let mut modified = step;
            modified.axis = "descendant-or-self".to_string();
            steps.push(modified);
            remaining = rest;
        } else if remaining.starts_with('/') {
            remaining = remaining[1..].to_string();
            if remaining.is_empty() { break; }
            let (step, rest) = read_xpath_step(&remaining);
            steps.push(step);
            remaining = rest;
        } else {
            let (step, rest) = read_xpath_step(&remaining);
            steps.push(step);
            remaining = rest;
        }
    }

    steps
}

fn read_xpath_step(expr: &str) -> (XPathStep, String) {
    let mut axis = "child".to_string();
    let mut remaining = expr.to_string();

    // Check for axis notation
    let axis_re = Regex::new(r"^(ancestor|child|descendant|descendant-or-self|following|following-sibling|parent|preceding|preceding-sibling|self)::").unwrap();
    if let Some(caps) = axis_re.captures(&remaining) {
        axis = caps[1].to_string();
        remaining = remaining[caps[0].len()..].to_string();
    }

    // text() function
    if remaining.starts_with("text()") {
        return (XPathStep {
            axis, node_test: "text()".to_string(), predicates: vec![],
        }, remaining[6..].to_string());
    }

    // Attribute @name
    if remaining.starts_with('@') {
        remaining = remaining[1..].to_string();
        let name_re = Regex::new(r"^[\w.:_-]+").unwrap();
        let name = name_re.find(&remaining).map(|m| m.as_str().to_string()).unwrap_or("*".to_string());
        let rest = remaining[name.len()..].to_string();
        return (XPathStep {
            axis: "attribute".to_string(), node_test: name, predicates: vec![],
        }, rest);
    }

    // Node test
    let node_re = Regex::new(r"^[\w.:_*-]+").unwrap();
    let node_test = node_re.find(&remaining).map(|m| m.as_str().to_string()).unwrap_or("*".to_string());
    remaining = remaining[node_test.len()..].to_string();

    // Predicates
    let mut predicates = Vec::new();
    while remaining.starts_with('[') {
        let mut depth = 0;
        let mut end = 0;
        for (i, ch) in remaining.chars().enumerate() {
            if ch == '[' { depth += 1; }
            else if ch == ']' {
                depth -= 1;
                if depth == 0 { end = i; break; }
            }
        }
        predicates.push(remaining[1..end].to_string());
        remaining = remaining[end + 1..].to_string();
    }

    (XPathStep { axis, node_test, predicates }, remaining)
}

fn apply_xpath_step(
    root: &XmlNode,
    node: &XmlNode,
    step: &XPathStep,
    namespaces: &HashMap<String, String>,
) -> Vec<XmlNode> {
    if step.node_test == "text()" {
        return vec![XmlNode {
            tag: "#text".to_string(),
            attrs: HashMap::new(),
            children: vec![],
            text: node.text.clone(),
        }];
    }

    let mut candidates = match step.axis.as_str() {
        "child" => {
            node.children.iter()
                .filter(|c| matches_node_test(c, &step.node_test, namespaces))
                .cloned()
                .collect()
        }
        "descendant" | "descendant-or-self" => {
            get_descendants(node, &step.node_test, namespaces, step.axis == "descendant-or-self")
        }
        "attribute" => {
            if step.node_test == "*" {
                node.attrs.iter().map(|(k, v)| XmlNode {
                    tag: format!("@{}", k),
                    attrs: HashMap::new(),
                    children: vec![],
                    text: v.clone(),
                }).collect()
            } else {
                node.attrs.get(&step.node_test).map(|v| XmlNode {
                    tag: format!("@{}", step.node_test),
                    attrs: HashMap::new(),
                    children: vec![],
                    text: v.clone(),
                }).into_iter().collect()
            }
        }
        "self" => {
            if matches_node_test(node, &step.node_test, namespaces) {
                vec![node.clone()]
            } else { vec![] }
        }
        _ => vec![],
    };

    // Apply predicates
    for predicate in &step.predicates {
        candidates = apply_xpath_predicate(root, candidates, predicate, namespaces);
    }

    candidates
}

fn get_descendants(
    node: &XmlNode,
    node_test: &str,
    namespaces: &HashMap<String, String>,
    include_self: bool,
) -> Vec<XmlNode> {
    let mut results = Vec::new();
    if include_self && matches_node_test(node, node_test, namespaces) {
        results.push(node.clone());
    }
    for child in &node.children {
        if matches_node_test(child, node_test, namespaces) {
            results.push(child.clone());
        }
        results.extend(get_descendants(child, node_test, namespaces, false));
    }
    results
}

fn matches_node_test(node: &XmlNode, test: &str, namespaces: &HashMap<String, String>) -> bool {
    if test == "*" { return !node.tag.starts_with('#'); }
    if test.contains(':') {
        let parts: Vec<&str> = test.splitn(2, ':').collect();
        if parts.len() == 2 {
            if namespaces.contains_key(parts[0]) {
                return node.tag == parts[1] || node.tag == test;
            }
        }
    }
    node.tag == test
}

fn apply_xpath_predicate(
    _root: &XmlNode,
    candidates: Vec<XmlNode>,
    predicate: &str,
    _namespaces: &HashMap<String, String>,
) -> Vec<XmlNode> {
    let trimmed = predicate.trim();

    // Positional
    if let Ok(pos) = trimmed.parse::<i64>() {
        let idx = if pos > 0 { (pos - 1) as usize } else { (candidates.len() as i64 + pos) as usize };
        return candidates.get(idx).cloned().into_iter().collect();
    }

    if trimmed == "last()" {
        return candidates.last().cloned().into_iter().collect();
    }

    // Attribute existence: @attr
    if trimmed.starts_with('@') && !trimmed.contains('=') {
        let attr_name = &trimmed[1..];
        return candidates.into_iter().filter(|n| n.attrs.contains_key(attr_name)).collect();
    }

    // Attribute comparison: @attr='value'
    let attr_cmp_re = Regex::new(r#"^@([\w.:_-]+)\s*(=|!=|<|>)\s*["']([^"']*)["']$"#).unwrap();
    if let Some(caps) = attr_cmp_re.captures(trimmed) {
        let attr_name = &caps[1];
        let op = &caps[2];
        let value = &caps[3];

        return candidates.into_iter().filter(|n| {
            if let Some(attr_val) = n.attrs.get(attr_name) {
                match op {
                    "=" => attr_val == value,
                    "!=" => attr_val != value,
                    "<" => attr_val.parse::<f64>().unwrap_or(0.0) < value.parse::<f64>().unwrap_or(0.0),
                    ">" => attr_val.parse::<f64>().unwrap_or(0.0) > value.parse::<f64>().unwrap_or(0.0),
                    _ => false,
                }
            } else { false }
        }).collect();
    }

    candidates
}

// ---------------------------------------------------------------------------
// 4. RegexMapper — regex capture groups extracting values from strings
// ---------------------------------------------------------------------------

/// RegexMapper extracts values from string fields using regular expressions
/// with named and numbered capture groups.
///
/// Reference: OpenRefine GREL regex extraction.
pub struct RegexMapper;

impl FieldMapperPlugin for RegexMapper {
    fn id(&self) -> &str { "regex" }
    fn display_name(&self) -> &str { "Regex Capture Group Mapper" }

    fn supports(&self, path_syntax: &str) -> bool {
        Regex::new(r"^([\w.]+:)?/.*?/[gimsuvy]*$").unwrap().is_match(path_syntax)
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        let parsed = match parse_regex_path(source_path, config) {
            Some(p) => p,
            None => return default_or_null(config),
        };

        let source_text = if let Some(ref field) = parsed.source_field {
            let keys = parse_dot_path(field);
            match get_nested_value(record, &keys).and_then(|v| v.as_str()) {
                Some(s) => s.to_string(),
                None => return default_or_null(config),
            }
        } else if let Some(raw) = record.get("_raw").and_then(|v| v.as_str()) {
            raw.to_string()
        } else if let Some(text) = record.get("_text").and_then(|v| v.as_str()) {
            text.to_string()
        } else {
            record.to_string()
        };

        let capture_idx = match &parsed.capture_group {
            CaptureGroupRef::Numbered(n) => *n,
            CaptureGroupRef::Named(_) => 1, // Named groups in Rust regex use numbered fallback
        };

        if config.return_all {
            let results: Vec<Value> = parsed.regex.captures_iter(&source_text)
                .filter_map(|caps| {
                    // Try named group first
                    if let CaptureGroupRef::Named(ref name) = parsed.capture_group {
                        if let Some(m) = caps.name(name) {
                            return Some(Value::String(m.as_str().to_string()));
                        }
                    }
                    caps.get(capture_idx)
                        .map(|m| Value::String(m.as_str().to_string()))
                })
                .collect();

            if results.is_empty() { default_or_null(config) } else { Value::Array(results) }
        } else {
            match parsed.regex.captures(&source_text) {
                Some(caps) => {
                    // Try named group
                    if let CaptureGroupRef::Named(ref name) = parsed.capture_group {
                        if let Some(m) = caps.name(name) {
                            return Value::String(m.as_str().to_string());
                        }
                    }
                    caps.get(capture_idx)
                        .map(|m| Value::String(m.as_str().to_string()))
                        .unwrap_or_else(|| default_or_null(config))
                }
                None => default_or_null(config),
            }
        }
    }
}

struct ParsedRegexPath {
    regex: Regex,
    source_field: Option<String>,
    capture_group: CaptureGroupRef,
}

fn parse_regex_path(path: &str, config: &MapperConfig) -> Option<ParsedRegexPath> {
    // Check for field:/pattern/flags
    let field_re = Regex::new(r"^([\w.]+):(/.*?/[gimsuvy]*)$").unwrap();
    let (source_field, regex_part) = if let Some(caps) = field_re.captures(path) {
        (Some(caps[1].to_string()), caps[2].to_string())
    } else {
        (None, path.to_string())
    };

    // Parse /pattern/flags
    let regex_re = Regex::new(r"^/(.*)/([gimsuvy]*)$").unwrap();
    let caps = regex_re.captures(&regex_part)?;
    let pattern = &caps[1];
    let flags = config.regex_flags.as_deref().unwrap_or(&caps[2]);

    // Build regex with flags (Rust regex uses inline flags)
    let mut prefix = String::from("(?");
    if flags.contains('i') { prefix.push('i'); }
    if flags.contains('s') { prefix.push('s'); }
    if flags.contains('m') { prefix.push('m'); }
    prefix.push(')');

    let full_pattern = if prefix.len() > 3 {
        format!("{}{}", prefix, pattern)
    } else {
        pattern.to_string()
    };

    let regex = Regex::new(&full_pattern).ok()?;

    let capture_group = match &config.capture_group {
        Some(cg) => cg.clone(),
        None => CaptureGroupRef::Numbered(1),
    };

    Some(ParsedRegexPath { regex, source_field, capture_group })
}

// ---------------------------------------------------------------------------
// 5. TemplateMapper — string interpolation with field references
// ---------------------------------------------------------------------------

/// TemplateMapper assembles values from multiple fields using template interpolation.
///
/// Supported syntax:
///   - Simple interpolation: `{first_name} {last_name}`
///   - Nested paths: `{address.city}, {address.state}`
///   - Fallback values: `{nickname|first_name|"Anonymous"}`
///   - Format specifiers: `{price:.2f}`, `{name:upper}`
///   - Conditional segments: `{?phone}Phone: {phone}{/phone}`
///
/// Reference: Drupal Migrate concat plugin.
pub struct TemplateMapper;

impl FieldMapperPlugin for TemplateMapper {
    fn id(&self) -> &str { "template" }
    fn display_name(&self) -> &str { "Template Interpolation Mapper" }

    fn supports(&self, path_syntax: &str) -> bool {
        path_syntax.contains('{') && path_syntax.contains('}') &&
        !path_syntax.starts_with('$') && !path_syntax.starts_with('/')
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        let result = template_interpolate(record, source_path, config);
        Value::String(result)
    }
}

fn template_interpolate(record: &Value, template: &str, config: &MapperConfig) -> String {
    let mut result = template.to_string();

    // Process conditional segments: {?field}content{/field}
    result = process_conditionals(record, &result, config);

    // Replace field references
    let field_re = Regex::new(r"\\?\{([^}]+)\}").unwrap();
    result = field_re.replace_all(&result, |caps: &regex::Captures| {
        let full = caps.get(0).unwrap().as_str();
        if full.starts_with('\\') {
            return full[1..].to_string();
        }

        let expression = caps[1].trim();
        resolve_template_expression(record, expression, config)
    }).to_string();

    result
}

fn process_conditionals(record: &Value, template: &str, config: &MapperConfig) -> String {
    let cond_re = match Regex::new(r"\{\?(\w[\w.]*)\}([\s\S]*?)\{/\1\}") {
        Ok(re) => re,
        Err(_) => return template.to_string(),
    };

    let mut result = template.to_string();
    while cond_re.is_match(&result) {
        result = cond_re.replace_all(&result, |caps: &regex::Captures| {
            let field_name = &caps[1];
            let content = &caps[2];

            let keys = parse_dot_path(field_name);
            let value = get_nested_value(record, &keys);

            match value {
                Some(v) if !v.is_null() && v != &Value::String(String::new()) && v != &Value::Bool(false) => {
                    template_interpolate(record, content, config)
                }
                _ => String::new(),
            }
        }).to_string();
    }

    result
}

fn resolve_template_expression(record: &Value, expression: &str, config: &MapperConfig) -> String {
    let mut field_expr = expression;
    let mut format_spec: Option<&str> = None;

    // Find format specifier
    let last_pipe = expression.rfind('|').map(|i| i as i64).unwrap_or(-1);
    let last_colon = expression.rfind(':').map(|i| i as i64).unwrap_or(-1);

    if last_colon > last_pipe {
        let colon_idx = last_colon as usize;
        field_expr = &expression[..colon_idx];
        format_spec = Some(&expression[colon_idx + 1..]);
    }

    // Resolve with fallback chain
    let value = resolve_with_fallback(record, field_expr, config);

    match value {
        Value::Null => String::new(),
        _ => {
            if let Some(format) = format_spec {
                apply_format(&value, format)
            } else if let Some(ref specifiers) = config.format_specifiers {
                if let Some(fmt) = specifiers.get(field_expr) {
                    return apply_format(&value, fmt);
                }
                value_to_string(&value)
            } else {
                value_to_string(&value)
            }
        }
    }
}

fn resolve_with_fallback(record: &Value, field_expr: &str, config: &MapperConfig) -> Value {
    for alt in field_expr.split('|').map(|s| s.trim()) {
        // String literal
        if (alt.starts_with('"') && alt.ends_with('"')) ||
           (alt.starts_with('\'') && alt.ends_with('\'')) {
            return Value::String(alt[1..alt.len()-1].to_string());
        }

        let keys = parse_dot_path(alt);
        if let Some(value) = get_nested_value(record, &keys) {
            if !value.is_null() {
                if let Some(s) = value.as_str() {
                    if !s.is_empty() { return value.clone(); }
                } else {
                    return value.clone();
                }
            }
        }

        if let Some(ref fallbacks) = config.fallback_values {
            if let Some(fb) = fallbacks.get(alt) {
                return fb.clone();
            }
        }
    }

    config.default_value.clone().unwrap_or(Value::Null)
}

fn apply_format(value: &Value, format: &str) -> String {
    // Number formats: .2f
    if let Some(caps) = Regex::new(r"^\.(\d+)f$").unwrap().captures(format) {
        let decimals: usize = caps[1].parse().unwrap_or(0);
        let num = value_to_f64(value);
        return format!("{:.prec$}", num, prec = decimals);
    }

    match format.to_lowercase().as_str() {
        "upper" | "uppercase" => value_to_string(value).to_uppercase(),
        "lower" | "lowercase" => value_to_string(value).to_lowercase(),
        "trim" => value_to_string(value).trim().to_string(),
        "slug" => {
            let s = value_to_string(value).to_lowercase();
            let re = Regex::new(r"[^\w\s-]").unwrap();
            let cleaned = re.replace_all(&s, "");
            let ws_re = Regex::new(r"[\s_]+").unwrap();
            let dashed = ws_re.replace_all(&cleaned, "-");
            let multi_re = Regex::new(r"-+").unwrap();
            multi_re.replace_all(&dashed, "-").trim().to_string()
        }
        "json" => serde_json::to_string(value).unwrap_or_else(|_| value_to_string(value)),
        _ => value_to_string(value),
    }
}

// ---------------------------------------------------------------------------
// 6. ComputedMapper — expression language evaluation
// ---------------------------------------------------------------------------

/// ComputedMapper evaluates arithmetic and logical expressions referencing record fields.
///
/// Supported syntax:
///   - Arithmetic: `price * quantity * (1 + tax_rate)`
///   - Comparisons: `age >= 18`
///   - Logical: `is_member && total > 100`
///   - Ternary: `is_premium ? price * 0.9 : price`
///   - String concat: `first_name ~ " " ~ last_name`
///   - Functions: `round(price * 1.1, 2)`, `max(a, b)`, `length(name)`
///
/// Reference: Drupal Migrate callback plugin, Symfony ExpressionLanguage.
pub struct ComputedMapper;

impl FieldMapperPlugin for ComputedMapper {
    fn id(&self) -> &str { "computed" }
    fn display_name(&self) -> &str { "Computed Expression Mapper" }

    fn supports(&self, path_syntax: &str) -> bool {
        if path_syntax.starts_with('$') || path_syntax.starts_with('/') || path_syntax.starts_with("//") {
            return false;
        }
        if path_syntax.contains('{') && path_syntax.contains('}') { return false; }
        Regex::new(r"[+\-*/%<>=!&|?:~(]").unwrap().is_match(path_syntax)
    }

    fn resolve(&self, record: &RawRecord, source_path: &str, config: &MapperConfig) -> Value {
        let tokens = tokenize_expression(source_path);
        let mut parser = ExprParser::new(tokens, record);
        match parser.parse_ternary() {
            Ok(val) => val,
            Err(_) => default_or_null(config),
        }
    }
}

// ---------------------------------------------------------------------------
// Expression parser types and implementation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
enum ExprToken {
    Number(f64),
    Str(String),
    Bool(bool),
    Null,
    Identifier(String),
    Op(String),
    LParen,
    RParen,
    Comma,
    Question,
    Colon,
    Eof,
}

fn tokenize_expression(expr: &str) -> Vec<ExprToken> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = expr.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i].is_whitespace() { i += 1; continue; }

        // Number
        if chars[i].is_ascii_digit() || (chars[i] == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
            let mut num = String::new();
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                num.push(chars[i]); i += 1;
            }
            tokens.push(ExprToken::Number(num.parse().unwrap_or(0.0)));
            continue;
        }

        // String
        if chars[i] == '"' || chars[i] == '\'' {
            let quote = chars[i]; i += 1;
            let mut s = String::new();
            while i < chars.len() && chars[i] != quote {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    i += 1;
                    match chars[i] {
                        'n' => s.push('\n'),
                        't' => s.push('\t'),
                        '\\' => s.push('\\'),
                        c => s.push(c),
                    }
                } else {
                    s.push(chars[i]);
                }
                i += 1;
            }
            i += 1; // closing quote
            tokens.push(ExprToken::Str(s));
            continue;
        }

        // Two-char operators
        if i + 1 < chars.len() {
            let two: String = chars[i..=i+1].iter().collect();
            if ["==", "!=", "<=", ">=", "&&", "||", "??"].contains(&two.as_str()) {
                tokens.push(ExprToken::Op(two)); i += 2; continue;
            }
        }

        // Single-char operators
        if "+-*/%<>=!~".contains(chars[i]) {
            tokens.push(ExprToken::Op(chars[i].to_string())); i += 1; continue;
        }

        match chars[i] {
            '(' => { tokens.push(ExprToken::LParen); i += 1; }
            ')' => { tokens.push(ExprToken::RParen); i += 1; }
            ',' => { tokens.push(ExprToken::Comma); i += 1; }
            '?' => { tokens.push(ExprToken::Question); i += 1; }
            ':' => { tokens.push(ExprToken::Colon); i += 1; }
            _ if chars[i].is_alphabetic() || chars[i] == '_' => {
                let mut ident = String::new();
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_' || chars[i] == '.') {
                    ident.push(chars[i]); i += 1;
                }
                match ident.as_str() {
                    "true" => tokens.push(ExprToken::Bool(true)),
                    "false" => tokens.push(ExprToken::Bool(false)),
                    "null" | "nil" => tokens.push(ExprToken::Null),
                    _ => tokens.push(ExprToken::Identifier(ident)),
                }
            }
            _ => { i += 1; }
        }
    }

    tokens.push(ExprToken::Eof);
    tokens
}

struct ExprParser<'a> {
    pos: usize,
    tokens: Vec<ExprToken>,
    record: &'a Value,
}

impl<'a> ExprParser<'a> {
    fn new(tokens: Vec<ExprToken>, record: &'a Value) -> Self {
        Self { pos: 0, tokens, record }
    }

    fn peek(&self) -> &ExprToken { &self.tokens[self.pos] }
    fn advance(&mut self) -> ExprToken { let t = self.tokens[self.pos].clone(); self.pos += 1; t }

    fn parse_ternary(&mut self) -> Result<Value, FieldMapperError> {
        let condition = self.parse_or()?;
        if matches!(self.peek(), ExprToken::Question) {
            self.advance();
            let consequent = self.parse_ternary()?;
            match self.advance() {
                ExprToken::Colon => {}
                _ => return Err(FieldMapperError::InvalidExpression { detail: "Expected ':'".into() }),
            }
            let alternate = self.parse_ternary()?;
            return Ok(if is_truthy(&condition) { consequent } else { alternate });
        }
        Ok(condition)
    }

    fn parse_or(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_and()?;
        while matches!(self.peek(), ExprToken::Op(ref s) if s == "||") {
            self.advance();
            let right = self.parse_and()?;
            left = Value::Bool(is_truthy(&left) || is_truthy(&right));
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_null_coalesce()?;
        while matches!(self.peek(), ExprToken::Op(ref s) if s == "&&") {
            self.advance();
            let right = self.parse_null_coalesce()?;
            left = Value::Bool(is_truthy(&left) && is_truthy(&right));
        }
        Ok(left)
    }

    fn parse_null_coalesce(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_equality()?;
        while matches!(self.peek(), ExprToken::Op(ref s) if s == "??") {
            self.advance();
            let right = self.parse_equality()?;
            left = if left.is_null() { right } else { left };
        }
        Ok(left)
    }

    fn parse_equality(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_comparison()?;
        loop {
            match self.peek() {
                ExprToken::Op(ref s) if s == "==" => {
                    self.advance(); let right = self.parse_comparison()?;
                    left = Value::Bool(left == right);
                }
                ExprToken::Op(ref s) if s == "!=" => {
                    self.advance(); let right = self.parse_comparison()?;
                    left = Value::Bool(left != right);
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_comparison(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_concat()?;
        loop {
            match self.peek() {
                ExprToken::Op(ref s) if s == "<" => {
                    self.advance(); let right = self.parse_concat()?;
                    left = Value::Bool(value_to_f64(&left) < value_to_f64(&right));
                }
                ExprToken::Op(ref s) if s == ">" => {
                    self.advance(); let right = self.parse_concat()?;
                    left = Value::Bool(value_to_f64(&left) > value_to_f64(&right));
                }
                ExprToken::Op(ref s) if s == "<=" => {
                    self.advance(); let right = self.parse_concat()?;
                    left = Value::Bool(value_to_f64(&left) <= value_to_f64(&right));
                }
                ExprToken::Op(ref s) if s == ">=" => {
                    self.advance(); let right = self.parse_concat()?;
                    left = Value::Bool(value_to_f64(&left) >= value_to_f64(&right));
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_concat(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_addition()?;
        while matches!(self.peek(), ExprToken::Op(ref s) if s == "~") {
            self.advance();
            let right = self.parse_addition()?;
            left = Value::String(format!("{}{}", value_to_string(&left), value_to_string(&right)));
        }
        Ok(left)
    }

    fn parse_addition(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_multiplication()?;
        loop {
            match self.peek() {
                ExprToken::Op(ref s) if s == "+" => {
                    self.advance(); let right = self.parse_multiplication()?;
                    if left.is_string() || right.is_string() {
                        left = Value::String(format!("{}{}", value_to_string(&left), value_to_string(&right)));
                    } else {
                        left = num_value(value_to_f64(&left) + value_to_f64(&right));
                    }
                }
                ExprToken::Op(ref s) if s == "-" => {
                    self.advance(); let right = self.parse_multiplication()?;
                    left = num_value(value_to_f64(&left) - value_to_f64(&right));
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_multiplication(&mut self) -> Result<Value, FieldMapperError> {
        let mut left = self.parse_unary()?;
        loop {
            match self.peek() {
                ExprToken::Op(ref s) if s == "*" => {
                    self.advance(); let right = self.parse_unary()?;
                    left = num_value(value_to_f64(&left) * value_to_f64(&right));
                }
                ExprToken::Op(ref s) if s == "/" => {
                    self.advance(); let right = self.parse_unary()?;
                    let d = value_to_f64(&right);
                    left = num_value(if d != 0.0 { value_to_f64(&left) / d } else { 0.0 });
                }
                ExprToken::Op(ref s) if s == "%" => {
                    self.advance(); let right = self.parse_unary()?;
                    left = num_value(value_to_f64(&left) % value_to_f64(&right));
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Value, FieldMapperError> {
        if matches!(self.peek(), ExprToken::Op(ref s) if s == "!") {
            self.advance();
            let val = self.parse_unary()?;
            return Ok(Value::Bool(!is_truthy(&val)));
        }
        if matches!(self.peek(), ExprToken::Op(ref s) if s == "-") {
            self.advance();
            let val = self.parse_unary()?;
            return Ok(num_value(-value_to_f64(&val)));
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<Value, FieldMapperError> {
        let token = self.peek().clone();
        match token {
            ExprToken::Number(n) => { self.advance(); Ok(num_value(n)) }
            ExprToken::Str(s) => { self.advance(); Ok(Value::String(s)) }
            ExprToken::Bool(b) => { self.advance(); Ok(Value::Bool(b)) }
            ExprToken::Null => { self.advance(); Ok(Value::Null) }

            ExprToken::LParen => {
                self.advance();
                let result = self.parse_ternary()?;
                match self.advance() {
                    ExprToken::RParen => Ok(result),
                    _ => Err(FieldMapperError::InvalidExpression { detail: "Expected ')'".into() }),
                }
            }

            ExprToken::Identifier(name) => {
                self.advance();
                if matches!(self.peek(), ExprToken::LParen) {
                    self.parse_function_call(&name)
                } else {
                    // Field reference
                    let keys = parse_dot_path(&name);
                    Ok(get_nested_value(self.record, &keys).cloned().unwrap_or(Value::Null))
                }
            }

            _ => Err(FieldMapperError::InvalidExpression { detail: format!("Unexpected token: {:?}", token) }),
        }
    }

    fn parse_function_call(&mut self, name: &str) -> Result<Value, FieldMapperError> {
        self.advance(); // consume (
        let mut args = Vec::new();

        if !matches!(self.peek(), ExprToken::RParen) {
            args.push(self.parse_ternary()?);
            while matches!(self.peek(), ExprToken::Comma) {
                self.advance();
                args.push(self.parse_ternary()?);
            }
        }

        match self.advance() {
            ExprToken::RParen => {}
            _ => return Err(FieldMapperError::InvalidExpression { detail: "Expected ')'".into() }),
        }

        Ok(call_builtin(name, &args))
    }
}

fn is_truthy(val: &Value) -> bool {
    match val {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
        Value::String(s) => !s.is_empty(),
        Value::Null => false,
        Value::Array(a) => !a.is_empty(),
        Value::Object(o) => !o.is_empty(),
    }
}

fn num_value(n: f64) -> Value {
    serde_json::Number::from_f64(n)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}

fn call_builtin(name: &str, args: &[Value]) -> Value {
    let get_num = |i: usize| -> f64 { args.get(i).map(|v| value_to_f64(v)).unwrap_or(0.0) };
    let get_str = |i: usize| -> String { args.get(i).map(|v| value_to_string(v)).unwrap_or_default() };

    match name {
        "round" => {
            let n = get_num(0);
            let d = get_num(1) as i32;
            let factor = 10f64.powi(d);
            num_value((n * factor).round() / factor)
        }
        "floor" => num_value(get_num(0).floor()),
        "ceil" => num_value(get_num(0).ceil()),
        "abs" => num_value(get_num(0).abs()),
        "min" => num_value(args.iter().map(|v| value_to_f64(v)).fold(f64::INFINITY, f64::min)),
        "max" => num_value(args.iter().map(|v| value_to_f64(v)).fold(f64::NEG_INFINITY, f64::max)),
        "sqrt" => num_value(get_num(0).sqrt()),
        "pow" => num_value(get_num(0).powf(get_num(1))),

        "length" => {
            match args.first() {
                Some(Value::String(s)) => num_value(s.len() as f64),
                Some(Value::Array(a)) => num_value(a.len() as f64),
                _ => num_value(0.0),
            }
        }
        "upper" => Value::String(get_str(0).to_uppercase()),
        "lower" => Value::String(get_str(0).to_lowercase()),
        "trim" => Value::String(get_str(0).trim().to_string()),
        "contains" => Value::Bool(get_str(0).contains(&get_str(1))),
        "replace" => Value::String(get_str(0).replace(&get_str(1), &get_str(2))),
        "split" => {
            let parts: Vec<Value> = get_str(0).split(&get_str(1))
                .map(|s| Value::String(s.to_string())).collect();
            Value::Array(parts)
        }
        "join" => {
            match args.first() {
                Some(Value::Array(arr)) => {
                    let sep = get_str(1);
                    let joined: Vec<String> = arr.iter().map(|v| value_to_string(v)).collect();
                    Value::String(joined.join(&sep))
                }
                _ => Value::String(get_str(0)),
            }
        }

        "int" => num_value(get_num(0).trunc()),
        "float" => num_value(get_num(0)),
        "str" => Value::String(get_str(0)),

        "first" => args.first()
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .cloned()
            .unwrap_or(Value::Null),
        "last" => args.first()
            .and_then(|v| v.as_array())
            .and_then(|a| a.last())
            .cloned()
            .unwrap_or(Value::Null),
        "count" => {
            match args.first() {
                Some(Value::Array(a)) => num_value(a.len() as f64),
                _ => num_value(1.0),
            }
        }
        "sum" => {
            match args.first() {
                Some(Value::Array(a)) => num_value(a.iter().map(|v| value_to_f64(v)).sum()),
                _ => num_value(get_num(0)),
            }
        }
        "avg" => {
            match args.first() {
                Some(Value::Array(a)) if !a.is_empty() => {
                    let sum: f64 = a.iter().map(|v| value_to_f64(v)).sum();
                    num_value(sum / a.len() as f64)
                }
                _ => num_value(0.0),
            }
        }

        "coalesce" => args.iter().find(|v| !v.is_null()).cloned().unwrap_or(Value::Null),
        "ifNull" => {
            if args.first().map(|v| v.is_null()).unwrap_or(true) {
                args.get(1).cloned().unwrap_or(Value::Null)
            } else {
                args.first().cloned().unwrap_or(Value::Null)
            }
        }
        "isEmpty" => {
            match args.first() {
                Some(Value::String(s)) => Value::Bool(s.is_empty()),
                Some(Value::Array(a)) => Value::Bool(a.is_empty()),
                Some(Value::Null) => Value::Bool(true),
                None => Value::Bool(true),
                _ => Value::Bool(false),
            }
        }

        _ => Value::Null,
    }
}

// ---------------------------------------------------------------------------
// Factory function and registry
// ---------------------------------------------------------------------------

/// Create a field-mapper provider by its unique identifier.
/// Returns `None` if the given ID does not match any known provider.
pub fn create_provider(id: &str) -> Option<Box<dyn FieldMapperPlugin>> {
    match id {
        "direct" => Some(Box::new(DirectMapper)),
        "jsonpath" => Some(Box::new(JsonPathMapper)),
        "xpath" => Some(Box::new(XPathMapper)),
        "regex" => Some(Box::new(RegexMapper)),
        "template" => Some(Box::new(TemplateMapper)),
        "computed" => Some(Box::new(ComputedMapper)),
        _ => None,
    }
}

/// Return all available provider IDs.
pub fn available_providers() -> Vec<&'static str> {
    vec!["direct", "jsonpath", "xpath", "regex", "template", "computed"]
}

/// Resolve the best provider for a given path syntax.
/// Returns the first provider whose `supports()` returns true, preferring
/// more specific syntaxes (checked in specificity order).
pub fn resolve_provider(path_syntax: &str) -> Option<Box<dyn FieldMapperPlugin>> {
    let ordered_ids = ["jsonpath", "xpath", "regex", "template", "computed", "direct"];
    for id in ordered_ids {
        if let Some(provider) = create_provider(id) {
            if provider.supports(path_syntax) {
                return Some(provider);
            }
        }
    }
    None
}
