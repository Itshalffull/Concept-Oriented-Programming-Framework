// Table detector — detects tabular structure in text content
// Supports: Markdown pipe tables, TSV, space-aligned columns, HTML tables

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PROVIDER_ID: &str = "table_detector";
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

struct TableData {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    format: String,
}

fn split_pipe_row(row: &str) -> Vec<String> {
    let parts: Vec<&str> = row.split('|').collect();
    // Skip first empty and last empty if line starts/ends with |
    let start = if parts.first().map_or(false, |p| p.trim().is_empty()) { 1 } else { 0 };
    let end = if parts.last().map_or(false, |p| p.trim().is_empty()) { parts.len() - 1 } else { parts.len() };
    parts[start..end].iter().map(|p| p.trim().to_string()).collect()
}

fn parse_pipe_table(lines: &[&str]) -> Option<TableData> {
    let mut pipe_lines: Vec<&str> = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed.contains('|') && trimmed.split('|').count() >= 3 {
            pipe_lines.push(trimmed);
        } else if pipe_lines.len() >= 2 {
            break;
        } else {
            pipe_lines.clear();
        }
    }
    if pipe_lines.len() < 3 { return None; }

    // Check separator row
    let sep_re = Regex::new(r"^[|\s:\-]+$").unwrap();
    if !sep_re.is_match(pipe_lines[1]) { return None; }

    let headers = split_pipe_row(pipe_lines[0]);
    let rows: Vec<Vec<String>> = pipe_lines[2..].iter()
        .map(|l| split_pipe_row(l))
        .collect();

    Some(TableData { headers, rows, format: "markdown_pipe".into() })
}

fn parse_tsv_table(lines: &[&str]) -> Option<TableData> {
    let tsv_lines: Vec<&str> = lines.iter()
        .filter(|l| l.contains('\t') && l.split('\t').count() >= 2)
        .copied()
        .collect();
    if tsv_lines.len() < 2 { return None; }

    let col_count = tsv_lines[0].split('\t').count();
    let consistent = tsv_lines.iter().all(|l| l.split('\t').count() == col_count);
    if !consistent { return None; }

    let headers: Vec<String> = tsv_lines[0].split('\t').map(|c| c.trim().to_string()).collect();
    let rows: Vec<Vec<String>> = tsv_lines[1..].iter()
        .map(|l| l.split('\t').map(|c| c.trim().to_string()).collect())
        .collect();

    Some(TableData { headers, rows, format: "tsv".into() })
}

fn parse_space_aligned(lines: &[&str]) -> Option<TableData> {
    let non_empty: Vec<&str> = lines.iter()
        .filter(|l| !l.trim().is_empty())
        .copied()
        .collect();
    if non_empty.len() < 3 { return None; }

    // Find column boundaries from consistent multi-space gaps
    let gap_re = Regex::new(r"\s{2,}").unwrap();
    let gaps: Vec<usize> = gap_re.find_iter(non_empty[0])
        .map(|m| m.end())
        .collect();
    if gaps.is_empty() { return None; }

    // Verify alignment consistency
    let mut aligned_count = 0;
    for line in non_empty.iter().skip(1).take(5) {
        let mut matched = 0;
        for &gap in &gaps {
            if gap > 0 && gap <= line.len() {
                let bytes = line.as_bytes();
                if gap > 0 && (bytes[gap - 1] as char).is_whitespace() {
                    matched += 1;
                }
            }
        }
        if matched as f64 >= gaps.len() as f64 * 0.6 {
            aligned_count += 1;
        }
    }
    if aligned_count < 2 { return None; }

    let mut boundaries = vec![0usize];
    boundaries.extend(&gaps);

    let extract_row = |line: &str| -> Vec<String> {
        let mut cells = Vec::new();
        for i in 0..boundaries.len() {
            let start = boundaries[i];
            let end = if i + 1 < boundaries.len() { boundaries[i + 1].min(line.len()) } else { line.len() };
            if start <= line.len() {
                cells.push(line[start..end.min(line.len())].trim().to_string());
            }
        }
        cells
    };

    let headers = extract_row(non_empty[0]);
    let rows: Vec<Vec<String>> = non_empty[1..].iter().map(|l| extract_row(l)).collect();

    Some(TableData { headers, rows, format: "space_aligned".into() })
}

fn parse_html_table(text: &str) -> Option<TableData> {
    let table_re = Regex::new(r"(?is)<table[^>]*>(.*?)</table>").unwrap();
    let table_content = table_re.captures(text)?;
    let inner = &table_content[1];

    let row_re = Regex::new(r"(?is)<tr[^>]*>(.*?)</tr>").unwrap();
    let cell_re = Regex::new(r"(?is)<(?:td|th)[^>]*>(.*?)</(?:td|th)>").unwrap();
    let tag_re = Regex::new(r"<[^>]+>").unwrap();

    let mut all_rows: Vec<Vec<String>> = Vec::new();
    for row_cap in row_re.captures_iter(inner) {
        let cells: Vec<String> = cell_re.captures_iter(&row_cap[1])
            .map(|c| tag_re.replace_all(&c[1], "").trim().to_string())
            .collect();
        if !cells.is_empty() {
            all_rows.push(cells);
        }
    }
    if all_rows.len() < 2 { return None; }

    Some(TableData {
        headers: all_rows[0].clone(),
        rows: all_rows[1..].to_vec(),
        format: "html".into(),
    })
}

fn table_to_value(table: &TableData) -> Value {
    let mut map = serde_json::Map::new();
    map.insert("headers".into(), Value::Array(table.headers.iter().map(|h| Value::String(h.clone())).collect()));
    map.insert("rows".into(), Value::Array(
        table.rows.iter().map(|row|
            Value::Array(row.iter().map(|c| Value::String(c.clone())).collect())
        ).collect()
    ));
    map.insert("format".into(), Value::String(table.format.clone()));
    Value::Object(map)
}

pub struct TableDetectorProvider;

impl TableDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let mut detections = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        // Pipe table
        if let Some(table) = parse_pipe_table(&lines) {
            let consistent = table.rows.iter().all(|r| r.len() == table.headers.len());
            let conf = if consistent { 0.95 } else { 0.85 };
            if conf >= threshold {
                let ev = format!("markdown_pipe table: {} columns, {} rows", table.headers.len(), table.rows.len());
                detections.push(Detection {
                    field: "table".into(), value: table_to_value(&table),
                    r#type: "table".into(), confidence: conf, evidence: ev,
                });
            }
        }

        // TSV
        if let Some(table) = parse_tsv_table(&lines) {
            let conf = 0.90;
            if conf >= threshold {
                let ev = format!("tsv table: {} columns, {} rows", table.headers.len(), table.rows.len());
                detections.push(Detection {
                    field: "table".into(), value: table_to_value(&table),
                    r#type: "table".into(), confidence: conf, evidence: ev,
                });
            }
        }

        // Space-aligned
        if let Some(table) = parse_space_aligned(&lines) {
            let conf = 0.75;
            if conf >= threshold {
                let ev = format!("space_aligned table: {} columns, {} rows", table.headers.len(), table.rows.len());
                detections.push(Detection {
                    field: "table".into(), value: table_to_value(&table),
                    r#type: "table".into(), confidence: conf, evidence: ev,
                });
            }
        }

        // HTML
        if let Some(table) = parse_html_table(content) {
            let conf = 0.92;
            if conf >= threshold {
                let ev = format!("html table: {} columns, {} rows", table.headers.len(), table.rows.len());
                detections.push(Detection {
                    field: "table".into(), value: table_to_value(&table),
                    r#type: "table".into(), confidence: conf, evidence: ev,
                });
            }
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown" | "text/csv" | "text/tab-separated-values")
    }
}
