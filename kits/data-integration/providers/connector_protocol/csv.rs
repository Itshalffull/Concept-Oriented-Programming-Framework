// CSV — connector_protocol provider
// CSV/TSV file reader and writer with configurable delimiters, quote handling, header detection, and streaming

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::time::Instant;

pub const PROVIDER_ID: &str = "csv";
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

struct CsvOptions {
    delimiter: char,
    quote: char,
    escape: char,
    has_header: bool,
    skip_rows: usize,
    comment_char: Option<char>,
    null_values: Vec<String>,
}

fn get_options(config: &ConnectorConfig) -> CsvOptions {
    let opts = config.options.as_ref();
    CsvOptions {
        delimiter: opts.and_then(|o| o.get("delimiter")).and_then(|v| v.as_str()).and_then(|s| s.chars().next()).unwrap_or(','),
        quote: opts.and_then(|o| o.get("quote")).and_then(|v| v.as_str()).and_then(|s| s.chars().next()).unwrap_or('"'),
        escape: opts.and_then(|o| o.get("escape")).and_then(|v| v.as_str()).and_then(|s| s.chars().next()).unwrap_or('"'),
        has_header: opts.and_then(|o| o.get("hasHeader")).and_then(|v| v.as_bool()).unwrap_or(true),
        skip_rows: opts.and_then(|o| o.get("skipRows")).and_then(|v| v.as_u64()).unwrap_or(0) as usize,
        comment_char: opts.and_then(|o| o.get("commentChar")).and_then(|v| v.as_str()).and_then(|s| s.chars().next()),
        null_values: vec!["".into(), "NULL".into(), "null".into(), "NA".into(), "N/A".into()],
    }
}

fn parse_csv_line(line: &str, delimiter: char, quote: char, escape: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];
        if in_quotes {
            if ch == escape && i + 1 < chars.len() && chars[i + 1] == quote {
                current.push(quote);
                i += 2;
            } else if ch == quote {
                in_quotes = false;
                i += 1;
            } else {
                current.push(ch);
                i += 1;
            }
        } else if ch == quote {
            in_quotes = true;
            i += 1;
        } else if ch == delimiter {
            fields.push(current.clone());
            current.clear();
            i += 1;
        } else {
            current.push(ch);
            i += 1;
        }
    }
    fields.push(current);
    fields
}

fn format_csv_field(value: &str, delimiter: char, quote: char) -> String {
    if value.contains(delimiter) || value.contains(quote) || value.contains('\n') {
        let escaped = value.replace(quote, &format!("{}{}", quote, quote));
        format!("{}{}{}", quote, escaped, quote)
    } else {
        value.to_string()
    }
}

fn coerce_value(value: &str, null_values: &[String]) -> Value {
    if null_values.contains(&value.to_string()) { return Value::Null; }
    if let Ok(n) = value.parse::<i64>() { return json!(n); }
    if let Ok(n) = value.parse::<f64>() { return json!(n); }
    match value {
        "true" | "TRUE" => json!(true),
        "false" | "FALSE" => json!(false),
        _ => json!(value),
    }
}

fn detect_delimiter(sample: &str) -> char {
    let first_line = sample.lines().next().unwrap_or("");
    let candidates = [',', '\t', '|', ';'];
    let mut best = ',';
    let mut best_count = 0;
    for &d in &candidates {
        let count = first_line.chars().filter(|&c| c == d).count();
        if count > best_count { best_count = count; best = d; }
    }
    best
}

pub struct CsvConnectorProvider {
    config: Option<ConnectorConfig>,
}

impl CsvConnectorProvider {
    pub fn new() -> Self { Self { config: None } }

    pub fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let file_path = query.path.as_deref().or(config.base_url.as_deref()).unwrap_or("");
        let opts = get_options(config);
        let limit = query.limit.unwrap_or(u64::MAX) as usize;
        let start_row = query.cursor.as_deref().and_then(|c| c.parse::<usize>().ok()).unwrap_or(0);

        let content = fs::read_to_string(file_path).map_err(|e| ConnectorError(e.to_string()))?;
        let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();

        let delimiter = if opts.delimiter == ',' {
            detect_delimiter(&content)
        } else {
            opts.delimiter
        };

        let (header_fields, data_start) = if opts.has_header {
            let h = parse_csv_line(lines.get(opts.skip_rows).unwrap_or(&""), delimiter, opts.quote, opts.escape);
            (h, opts.skip_rows + 1)
        } else {
            let sample = parse_csv_line(lines.first().unwrap_or(&""), delimiter, opts.quote, opts.escape);
            let h: Vec<String> = (0..sample.len()).map(|i| format!("column_{}", i)).collect();
            (h, opts.skip_rows)
        };

        let mut records = Vec::new();
        for i in (data_start + start_row)..lines.len() {
            if records.len() >= limit { break; }
            let line = lines[i];
            if let Some(cc) = opts.comment_char {
                if line.starts_with(cc) { continue; }
            }
            let fields = parse_csv_line(line, delimiter, opts.quote, opts.escape);
            let mut record = HashMap::new();
            for (j, header) in header_fields.iter().enumerate() {
                let val = fields.get(j).map(|s| s.as_str()).unwrap_or("");
                record.insert(header.clone(), coerce_value(val, &opts.null_values));
            }
            records.push(record);
        }
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

        let opts = get_options(config);
        let mut all_keys = Vec::new();
        for record in records {
            for key in record.keys() {
                if !all_keys.contains(key) { all_keys.push(key.clone()); }
            }
        }

        let mut file = fs::File::create(output_path).map_err(|e| ConnectorError(e.to_string()))?;
        if opts.has_header {
            let header_line: Vec<String> = all_keys.iter()
                .map(|k| format_csv_field(k, opts.delimiter, opts.quote))
                .collect();
            writeln!(file, "{}", header_line.join(&opts.delimiter.to_string()))
                .map_err(|e| ConnectorError(e.to_string()))?;
        }
        for record in records {
            let fields: Vec<String> = all_keys.iter()
                .map(|k| {
                    let v = record.get(k).and_then(|v| v.as_str()).unwrap_or("");
                    format_csv_field(v, opts.delimiter, opts.quote)
                })
                .collect();
            writeln!(file, "{}", fields.join(&opts.delimiter.to_string()))
                .map_err(|e| ConnectorError(e.to_string()))?;
        }

        Ok(WriteResult { created: records.len() as u64, updated: 0, skipped: 0, errors: 0 })
    }

    pub fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let file_path = config.base_url.as_deref().unwrap_or("");
        let start = Instant::now();
        let exists = std::path::Path::new(file_path).exists();
        Ok(TestResult {
            connected: exists,
            message: if exists { "File exists".into() } else { "File not found".into() },
            latency_ms: Some(start.elapsed().as_millis() as u64),
        })
    }

    pub fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let file_path = config.base_url.as_deref().unwrap_or("");
        let content = fs::read_to_string(file_path).map_err(|e| ConnectorError(e.to_string()))?;
        let delimiter = detect_delimiter(&content);
        let lines: Vec<&str> = content.lines().filter(|l| !l.is_empty()).collect();
        let headers = parse_csv_line(lines.first().unwrap_or(&""), delimiter, '"', '"');

        let mut schema = HashMap::new();
        schema.insert("type".into(), json!("object"));
        let mut props = HashMap::new();
        for h in &headers {
            props.insert(h.clone(), json!({"type": "string"}));
        }
        schema.insert("properties".into(), serde_json::to_value(props).unwrap_or_default());

        let name = std::path::Path::new(file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(file_path)
            .to_string();

        Ok(DiscoveryResult {
            streams: vec![StreamDef { name, schema, supported_sync_modes: vec!["full_refresh".into()] }],
        })
    }
}
