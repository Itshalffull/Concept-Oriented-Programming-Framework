// JSONFile — connector_protocol provider
// JSON/JSONL file reader with JSON arrays, newline-delimited JSON, and JSONPath-based record extraction

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::time::Instant;

pub const PROVIDER_ID: &str = "json_file";
pub const PLUGIN_TYPE: &str = "connector_protocol";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorConfig {
    pub base_url: Option<String>,
    pub connection_string: Option<String>,
    pub auth: Option<HashMap<String, String>>,
    pub headers: Option<HashMap<String, String>>,
    pub options: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuerySpec {
    pub path: Option<String>,
    pub query: Option<String>,
    pub params: Option<HashMap<String, Value>>,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
}

pub type Record = HashMap<String, Value>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteResult { pub created: u64, pub updated: u64, pub skipped: u64, pub errors: u64 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult { pub connected: bool, pub message: String, pub latency_ms: Option<u64> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamDef { pub name: String, pub schema: HashMap<String, Value>, pub supported_sync_modes: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult { pub streams: Vec<StreamDef> }

#[derive(Debug)]
pub struct ConnectorError(pub String);
impl std::fmt::Display for ConnectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}
impl std::error::Error for ConnectorError {}

#[derive(Debug, Clone, PartialEq)]
enum JsonFormat { Json, Jsonl, Auto }

fn detect_format(content: &str) -> JsonFormat {
    let trimmed = content.trim_start();
    if trimmed.starts_with('[') || trimmed.starts_with('{') {
        if let Some(newline_pos) = trimmed.find('\n') {
            let first_line = trimmed[..newline_pos].trim();
            if serde_json::from_str::<Value>(first_line).is_ok() && !first_line.ends_with(',') {
                return JsonFormat::Jsonl;
            }
        }
        return JsonFormat::Json;
    }
    JsonFormat::Jsonl
}

fn evaluate_json_path(obj: &Value, path: &str) -> Vec<Value> {
    if path.is_empty() || path == "$" || path == "." {
        return match obj {
            Value::Array(arr) => arr.clone(),
            _ => vec![obj.clone()],
        };
    }

    let segments: Vec<&str> = path
        .trim_start_matches('$')
        .trim_start_matches('.')
        .split('.')
        .filter(|s| !s.is_empty())
        .collect();

    let mut current = vec![obj.clone()];
    for segment in segments {
        let mut next = Vec::new();
        for item in &current {
            if segment == "*" {
                match item {
                    Value::Array(arr) => next.extend(arr.clone()),
                    Value::Object(map) => next.extend(map.values().cloned()),
                    _ => {}
                }
            } else if segment.ends_with("[]") {
                let key = &segment[..segment.len() - 2];
                if let Some(val) = item.get(key) {
                    if let Value::Array(arr) = val {
                        next.extend(arr.clone());
                    }
                }
            } else if let Some(val) = item.get(segment) {
                next.push(val.clone());
            }
        }
        current = next;
    }
    current
}

fn infer_schema(records: &[Record]) -> HashMap<String, Value> {
    let mut schema = HashMap::new();
    schema.insert("type".into(), json!("object"));
    let mut properties = HashMap::new();
    for record in records.iter().take(20) {
        for (key, value) in record {
            if properties.contains_key(key) { continue; }
            let type_name = match value {
                Value::Null => "null",
                Value::Bool(_) => "boolean",
                Value::Number(n) => if n.is_i64() || n.is_u64() { "integer" } else { "number" },
                Value::String(_) => "string",
                Value::Array(_) => "array",
                Value::Object(_) => "object",
            };
            properties.insert(key.clone(), json!({"type": type_name}));
        }
    }
    schema.insert("properties".into(), serde_json::to_value(properties).unwrap_or_default());
    schema
}

pub struct JsonFileConnectorProvider {
    config: Option<ConnectorConfig>,
}

impl JsonFileConnectorProvider {
    pub fn new() -> Self { Self { config: None } }

    fn load_content(source: &str) -> Result<String, ConnectorError> {
        if source.starts_with("http://") || source.starts_with("https://") {
            Err(ConnectorError("Use async read for HTTP sources".into()))
        } else {
            fs::read_to_string(source).map_err(|e| ConnectorError(e.to_string()))
        }
    }

    pub fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let source = query.path.as_deref().or(config.base_url.as_deref()).unwrap_or("");
        let json_path = config.options.as_ref()
            .and_then(|o| o.get("jsonPath"))
            .and_then(|v| v.as_str())
            .unwrap_or("$");
        let format_opt = config.options.as_ref()
            .and_then(|o| o.get("format"))
            .and_then(|v| v.as_str())
            .unwrap_or("auto");
        let limit = query.limit.unwrap_or(u64::MAX) as usize;
        let offset = query.cursor.as_deref().and_then(|c| c.parse::<usize>().ok()).unwrap_or(0);

        let content = Self::load_content(source)?;
        let detected_format = if format_opt == "auto" { detect_format(&content) } else if format_opt == "jsonl" { JsonFormat::Jsonl } else { JsonFormat::Json };

        let values: Vec<Value> = if detected_format == JsonFormat::Jsonl {
            content.lines()
                .filter(|l| !l.trim().is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect()
        } else {
            let parsed: Value = serde_json::from_str(&content).map_err(|e| ConnectorError(e.to_string()))?;
            if json_path != "$" {
                evaluate_json_path(&parsed, json_path)
            } else if parsed.is_array() {
                parsed.as_array().cloned().unwrap_or_default()
            } else {
                vec![parsed]
            }
        };

        let records: Vec<Record> = values.into_iter()
            .skip(offset)
            .take(limit)
            .filter_map(|v| {
                if let Value::Object(map) = v {
                    Some(map.into_iter().collect())
                } else { None }
            })
            .collect();

        Ok(records)
    }

    pub fn write(&self, records: &[Record], config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let output_path = config.options.as_ref()
            .and_then(|o| o.get("outputPath"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if output_path.is_empty() {
            return Ok(WriteResult { created: 0, updated: 0, skipped: records.len() as u64, errors: 0 });
        }
        let format = config.options.as_ref()
            .and_then(|o| o.get("outputFormat"))
            .and_then(|v| v.as_str())
            .unwrap_or("json");

        let output = if format == "jsonl" {
            records.iter()
                .map(|r| serde_json::to_string(r).unwrap_or_default())
                .collect::<Vec<_>>()
                .join("\n") + "\n"
        } else {
            serde_json::to_string_pretty(records).map_err(|e| ConnectorError(e.to_string()))?
        };

        fs::write(output_path, output).map_err(|e| ConnectorError(e.to_string()))?;
        Ok(WriteResult { created: records.len() as u64, updated: 0, skipped: 0, errors: 0 })
    }

    pub fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let source = config.base_url.as_deref().unwrap_or("");
        let start = Instant::now();
        if source.starts_with("http") {
            return Ok(TestResult { connected: false, message: "Use async test for HTTP".into(), latency_ms: Some(0) });
        }
        let exists = std::path::Path::new(source).exists();
        let msg = if exists {
            let content = fs::read_to_string(source).unwrap_or_default();
            let fmt = detect_format(&content);
            format!("File exists (format: {:?})", fmt)
        } else { "File not found".into() };
        Ok(TestResult { connected: exists, message: msg, latency_ms: Some(start.elapsed().as_millis() as u64) })
    }

    pub fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let source = config.base_url.as_deref().unwrap_or("");
        let content = Self::load_content(source)?;
        let format = detect_format(&content);
        let records: Vec<Record> = if format == JsonFormat::Jsonl {
            content.lines().take(20)
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect()
        } else {
            let parsed: Value = serde_json::from_str(&content).map_err(|e| ConnectorError(e.to_string()))?;
            match parsed {
                Value::Array(arr) => arr.into_iter().take(20).filter_map(|v| serde_json::from_value(v).ok()).collect(),
                Value::Object(map) => vec![map.into_iter().collect()],
                _ => Vec::new(),
            }
        };
        let name = std::path::Path::new(source).file_name().and_then(|n| n.to_str()).unwrap_or(source).to_string();
        Ok(DiscoveryResult {
            streams: vec![StreamDef { name, schema: infer_schema(&records), supported_sync_modes: vec!["full_refresh".into()] }],
        })
    }
}
