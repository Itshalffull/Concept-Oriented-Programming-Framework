// List detector — detects bullet, numbered, and checkbox lists in text
// Handles nested items via indentation depth analysis

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PROVIDER_ID: &str = "list_detector";
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

#[derive(Clone)]
struct ListItem {
    text: String,
    depth: usize,
    checked: Option<bool>,
}

struct ListBlock {
    items: Vec<ListItem>,
    list_type: String, // "bullet", "numbered", "checkbox"
    nested: bool,
    start_line: usize,
    end_line: usize,
}

fn measure_indent(line: &str) -> usize {
    let mut count = 0;
    for ch in line.chars() {
        match ch {
            ' ' => count += 1,
            '\t' => count += 4,
            _ => break,
        }
    }
    count / 2 // normalize: 2 spaces = 1 depth level
}

fn detect_list_blocks(lines: &[&str]) -> Vec<ListBlock> {
    let bullet_re = Regex::new(r"^(\s*)[-*\x{2022}\x{2023}]\s+(.+)$").unwrap();
    let numbered_re = Regex::new(r"^(\s*)(?:\d+[.)]|[a-zA-Z][.)]|[ivxlc]+[.)])\s+(.+)$").unwrap();
    let checkbox_re = Regex::new(r"^(\s*)[-*]\s+\[([xX ])\]\s+(.+)$").unwrap();

    let mut blocks = Vec::new();
    let mut current_items: Vec<ListItem> = Vec::new();
    let mut current_type: Option<String> = None;
    let mut block_start = 0;

    let flush = |items: &mut Vec<ListItem>, ctype: &mut Option<String>, blocks: &mut Vec<ListBlock>, start: usize, end: usize| {
        if items.len() >= 2 {
            if let Some(lt) = ctype.take() {
                let nested = items.iter().any(|i| i.depth > 0);
                blocks.push(ListBlock {
                    items: items.clone(),
                    list_type: lt,
                    nested,
                    start_line: start,
                    end_line: end,
                });
            }
        }
        items.clear();
        *ctype = None;
    };

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim_end();

        if trimmed.is_empty() {
            if !current_items.is_empty() && i + 1 < lines.len() {
                let next = lines[i + 1].trim_end();
                if !bullet_re.is_match(next) && !numbered_re.is_match(next) && !checkbox_re.is_match(next) {
                    flush(&mut current_items, &mut current_type, &mut blocks, block_start, i.saturating_sub(1));
                }
            }
            continue;
        }

        // Checkbox
        if let Some(cap) = checkbox_re.captures(trimmed) {
            if current_type.as_deref() != Some("checkbox") && current_type.is_some() {
                flush(&mut current_items, &mut current_type, &mut blocks, block_start, i.saturating_sub(1));
            }
            if current_type.is_none() { current_type = Some("checkbox".into()); block_start = i; }
            current_items.push(ListItem {
                text: cap[3].trim().to_string(),
                depth: measure_indent(trimmed),
                checked: Some(&cap[2] != " "),
            });
            continue;
        }

        // Bullet
        if let Some(cap) = bullet_re.captures(trimmed) {
            if current_type.as_deref() != Some("bullet") && current_type.is_some() {
                flush(&mut current_items, &mut current_type, &mut blocks, block_start, i.saturating_sub(1));
            }
            if current_type.is_none() { current_type = Some("bullet".into()); block_start = i; }
            current_items.push(ListItem {
                text: cap[2].trim().to_string(),
                depth: measure_indent(trimmed),
                checked: None,
            });
            continue;
        }

        // Numbered
        if let Some(cap) = numbered_re.captures(trimmed) {
            if current_type.as_deref() != Some("numbered") && current_type.is_some() {
                flush(&mut current_items, &mut current_type, &mut blocks, block_start, i.saturating_sub(1));
            }
            if current_type.is_none() { current_type = Some("numbered".into()); block_start = i; }
            current_items.push(ListItem {
                text: cap[2].trim().to_string(),
                depth: measure_indent(trimmed),
                checked: None,
            });
            continue;
        }

        // Indented continuation
        if !current_items.is_empty() && measure_indent(trimmed) > 0 {
            if let Some(last) = current_items.last_mut() {
                last.text.push(' ');
                last.text.push_str(trimmed.trim());
            }
            continue;
        }

        flush(&mut current_items, &mut current_type, &mut blocks, block_start, i.saturating_sub(1));
    }

    flush(&mut current_items, &mut current_type, &mut blocks, block_start, lines.len().saturating_sub(1));
    blocks
}

pub struct ListDetectorProvider;

impl ListDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let lines: Vec<&str> = content.lines().collect();
        let blocks = detect_list_blocks(&lines);
        let mut detections = Vec::new();

        for block in &blocks {
            let count = block.items.len();
            let mut confidence = if count >= 5 { 0.95 } else if count >= 3 { 0.88 } else { 0.75 };
            if block.list_type == "checkbox" { confidence = (confidence + 0.05).min(0.99); }
            if confidence < threshold { continue; }

            let items: Vec<Value> = block.items.iter().map(|item| {
                let mut m = serde_json::Map::new();
                m.insert("text".into(), Value::String(item.text.clone()));
                m.insert("depth".into(), Value::Number(item.depth.into()));
                if let Some(checked) = item.checked {
                    m.insert("checked".into(), Value::Bool(checked));
                }
                Value::Object(m)
            }).collect();

            let mut val = serde_json::Map::new();
            val.insert("items".into(), Value::Array(items));
            val.insert("type".into(), Value::String(block.list_type.clone()));
            val.insert("nested".into(), Value::Bool(block.nested));
            val.insert("itemCount".into(), Value::Number(count.into()));

            detections.push(Detection {
                field: "list".into(),
                value: Value::Object(val),
                r#type: "list".into(),
                confidence,
                evidence: format!("{} list with {} items (lines {}-{})",
                    block.list_type, count, block.start_line + 1, block.end_line + 1),
            });
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown")
    }
}
