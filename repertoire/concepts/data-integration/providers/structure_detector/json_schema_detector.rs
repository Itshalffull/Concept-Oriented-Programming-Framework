// JSON schema detector — infers schema from JSON objects or CSV content
// Detects field types, patterns (email, URL, date, UUID), cardinality, nullability

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PROVIDER_ID: &str = "json_schema_detector";
pub const PLUGIN_TYPE: &str = "structure_detector";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectorConfig {
    pub options: Option<HashMap<String, Value>>,
    pub confidence_threshold: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    pub field: String,
    pub value: Value,
    pub r#type: String,
    pub confidence: f64,
    pub evidence: String,
}

#[derive(Debug)]
pub enum DetectorError {
    ParseError(String),
    RegexError(String),
}

impl std::fmt::Display for DetectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectorError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DetectorError::RegexError(msg) => write!(f, "Regex error: {}", msg),
        }
    }
}

fn infer_json_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::String(_) => "string",
        Value::Bool(_) => "boolean",
        Value::Number(n) => if n.is_f64() && n.as_i64().is_none() { "number" } else { "integer" },
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn detect_pattern(value: &str) -> Option<&'static str> {
    let patterns: Vec<(&str, Regex)> = vec![
        ("email", Regex::new(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$").unwrap()),
        ("url", Regex::new(r"^https?://\S+$").unwrap()),
        ("uuid", Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap()),
        ("iso_date", Regex::new(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?").unwrap()),
        ("ipv4", Regex::new(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$").unwrap()),
        ("phone", Regex::new(r"^\+?\d[\d\s()\-]{6,20}$").unwrap()),
    ];
    for (name, re) in &patterns {
        if re.is_match(value) { return Some(name); }
    }
    None
}

struct FieldStats {
    types: HashMap<String, usize>,
    patterns: HashMap<String, usize>,
    null_count: usize,
    count: usize,
}

fn analyze_objects(objects: &[&serde_json::Map<String, Value>]) -> Vec<(String, String, Option<String>, bool, usize, usize)> {
    let mut field_map: HashMap<String, FieldStats> = HashMap::new();
    let total = objects.len();

    for obj in objects {
        for (key, val) in *obj {
            let stats = field_map.entry(key.clone()).or_insert_with(|| FieldStats {
                types: HashMap::new(), patterns: HashMap::new(), null_count: 0, count: 0,
            });
            stats.count += 1;
            let t = infer_json_type(val);
            *stats.types.entry(t.to_string()).or_insert(0) += 1;

            if val.is_null() {
                stats.null_count += 1;
            } else if let Some(s) = val.as_str() {
                if let Some(pat) = detect_pattern(s) {
                    *stats.patterns.entry(pat.to_string()).or_insert(0) += 1;
                }
            }
        }
    }

    field_map.into_iter().map(|(name, stats)| {
        let dominant_type = stats.types.iter()
            .filter(|(t, _)| t.as_str() != "null")
            .max_by_key(|(_, c)| *c)
            .map(|(t, _)| t.clone())
            .unwrap_or_else(|| "string".to_string());

        let non_null = stats.count - stats.null_count;
        let pattern = stats.patterns.iter()
            .find(|(_, &c)| c as f64 > non_null as f64 * 0.7)
            .map(|(p, _)| p.clone());

        let nullable = stats.null_count > 0;
        (name, dominant_type, pattern, nullable, stats.count, total)
    }).collect()
}

fn parse_csv_to_json(text: &str) -> Vec<serde_json::Map<String, Value>> {
    let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() < 2 { return vec![]; }

    let delimiter = if lines[0].contains('\t') { '\t' } else { ',' };
    let headers: Vec<String> = lines[0].split(delimiter)
        .map(|h| h.trim().trim_matches('"').to_string())
        .collect();

    let int_re = Regex::new(r"^-?\d+$").unwrap();
    let float_re = Regex::new(r"^-?\d+\.\d+$").unwrap();

    lines[1..].iter().map(|line| {
        let values: Vec<&str> = line.split(delimiter).collect();
        let mut obj = serde_json::Map::new();
        for (i, header) in headers.iter().enumerate() {
            let raw = values.get(i).unwrap_or(&"").trim().trim_matches('"');
            let val = if raw.is_empty() || raw.eq_ignore_ascii_case("null") {
                Value::Null
            } else if int_re.is_match(raw) {
                raw.parse::<i64>().map(Value::from).unwrap_or(Value::String(raw.to_string()))
            } else if float_re.is_match(raw) {
                raw.parse::<f64>().map(|f| serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::String(raw.to_string())))
                    .unwrap_or(Value::String(raw.to_string()))
            } else if raw.eq_ignore_ascii_case("true") {
                Value::Bool(true)
            } else if raw.eq_ignore_ascii_case("false") {
                Value::Bool(false)
            } else {
                Value::String(raw.to_string())
            };
            obj.insert(header.clone(), val);
        }
        obj
    }).collect()
}

pub struct JsonSchemaDetectorProvider;

impl JsonSchemaDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);

        // Try JSON parse first, then CSV
        let maps: Vec<serde_json::Map<String, Value>> = match serde_json::from_str::<Value>(content) {
            Ok(Value::Array(arr)) => arr.into_iter()
                .filter_map(|v| if let Value::Object(m) = v { Some(m) } else { None })
                .collect(),
            Ok(Value::Object(m)) => vec![m],
            _ => parse_csv_to_json(content),
        };

        if maps.is_empty() { return Ok(vec![]); }

        let refs: Vec<&serde_json::Map<String, Value>> = maps.iter().collect();
        let schemas = analyze_objects(&refs);
        let mut detections = Vec::new();
        let mut field_names = Vec::new();

        for (name, dtype, pattern, nullable, count, total) in &schemas {
            let cardinality = *count as f64 / *total as f64;
            let mut confidence = if cardinality >= 1.0 { 0.95 } else { 0.80 };
            if pattern.is_some() { confidence = (confidence + 0.03).min(0.99); }
            if confidence < threshold { continue; }

            field_names.push(name.clone());
            let mut val = serde_json::Map::new();
            val.insert("type".into(), Value::String(dtype.clone()));
            val.insert("pattern".into(), pattern.as_ref().map(|p| Value::String(p.clone())).unwrap_or(Value::Null));
            val.insert("nullable".into(), Value::Bool(*nullable));
            val.insert("cardinality".into(), serde_json::Number::from_f64((cardinality * 100.0).round() / 100.0).map(Value::Number).unwrap_or(Value::Null));
            val.insert("samples".into(), Value::Number((*total).into()));

            let pat_str = pattern.as_ref().map(|p| format!(" ({})", p)).unwrap_or_default();
            let null_str = if *nullable { "nullable" } else { "required" };

            detections.push(Detection {
                field: format!("schema.{}", name),
                value: Value::Object(val),
                r#type: "schema_field".into(),
                confidence,
                evidence: format!("Field \"{}\": {}{}, {}", name, dtype, pat_str, null_str),
            });
        }

        if !detections.is_empty() {
            let mut summary = serde_json::Map::new();
            summary.insert("fieldCount".into(), Value::Number(schemas.len().into()));
            summary.insert("sampleCount".into(), Value::Number(maps.len().into()));
            summary.insert("fields".into(), Value::Array(field_names.into_iter().map(Value::String).collect()));

            detections.push(Detection {
                field: "schema".into(),
                value: Value::Object(summary),
                r#type: "json_schema".into(),
                confidence: 0.90,
                evidence: format!("Schema with {} fields from {} sample(s)", schemas.len(), maps.len()),
            });
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "application/json" | "text/csv" | "text/tab-separated-values" | "application/x-ndjson")
    }
}
