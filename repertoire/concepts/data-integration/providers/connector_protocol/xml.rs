// XML — connector_protocol provider
// XML connector with XPath-based record extraction, namespace handling, and SAX streaming for large documents

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::time::Instant;

pub const PROVIDER_ID: &str = "xml";
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

#[derive(Debug, Clone)]
struct XmlNode {
    tag: String,
    namespace: Option<String>,
    attributes: HashMap<String, String>,
    children: Vec<XmlNode>,
    text: String,
}

fn parse_attributes(tag_content: &str) -> HashMap<String, String> {
    let mut attrs = HashMap::new();
    let mut i = 0;
    let chars: Vec<char> = tag_content.chars().collect();
    while i < chars.len() {
        // Skip whitespace
        while i < chars.len() && chars[i].is_whitespace() { i += 1; }
        if i >= chars.len() { break; }
        // Read attribute name
        let name_start = i;
        while i < chars.len() && chars[i] != '=' && !chars[i].is_whitespace() { i += 1; }
        let name: String = chars[name_start..i].iter().collect();
        if name.is_empty() { break; }
        // Skip = and quote
        while i < chars.len() && (chars[i] == '=' || chars[i] == '"' || chars[i].is_whitespace()) { i += 1; }
        let val_start = i;
        while i < chars.len() && chars[i] != '"' { i += 1; }
        let value: String = chars[val_start..i].iter().collect();
        if i < chars.len() { i += 1; } // skip closing quote
        attrs.insert(name, value);
    }
    attrs
}

fn parse_xml(xml: &str) -> XmlNode {
    let mut stack: Vec<XmlNode> = vec![XmlNode {
        tag: "__root__".into(), namespace: None, attributes: HashMap::new(), children: Vec::new(), text: String::new(),
    }];

    let mut i = 0;
    let chars: Vec<char> = xml.chars().collect();

    while i < chars.len() {
        if chars[i] == '<' {
            if i + 3 < chars.len() && chars[i+1] == '!' && chars[i+2] == '-' && chars[i+3] == '-' {
                // Comment: skip to -->
                if let Some(pos) = xml[i..].find("-->") { i += pos + 3; } else { break; }
                continue;
            }
            if i + 8 < chars.len() && &xml[i..i+9] == "<![CDATA[" {
                if let Some(end) = xml[i+9..].find("]]>") {
                    let cdata = &xml[i+9..i+9+end];
                    if let Some(current) = stack.last_mut() { current.text.push_str(cdata); }
                    i += 9 + end + 3;
                } else { break; }
                continue;
            }
            if i + 1 < chars.len() && chars[i+1] == '?' {
                if let Some(pos) = xml[i..].find("?>") { i += pos + 2; } else { break; }
                continue;
            }

            let tag_start = i + 1;
            let is_closing = tag_start < chars.len() && chars[tag_start] == '/';
            let name_start = if is_closing { tag_start + 1 } else { tag_start };

            if let Some(gt_pos) = xml[i..].find('>') {
                let tag_content = &xml[name_start..i + gt_pos];
                let self_closing = tag_content.ends_with('/');
                let tag_content = tag_content.trim_end_matches('/');

                let mut parts = tag_content.splitn(2, |c: char| c.is_whitespace());
                let full_tag = parts.next().unwrap_or("");
                let attr_str = parts.next().unwrap_or("");

                let (ns, local) = if let Some(colon) = full_tag.find(':') {
                    (Some(full_tag[..colon].to_string()), full_tag[colon+1..].to_string())
                } else {
                    (None, full_tag.to_string())
                };

                if is_closing {
                    if stack.len() > 1 { stack.pop(); }
                } else {
                    let node = XmlNode {
                        tag: local, namespace: ns,
                        attributes: parse_attributes(attr_str),
                        children: Vec::new(), text: String::new(),
                    };
                    if self_closing {
                        if let Some(parent) = stack.last_mut() { parent.children.push(node); }
                    } else {
                        stack.push(node);
                    }
                }
                i += gt_pos + 1;
            } else { break; }
        } else {
            let text_start = i;
            while i < chars.len() && chars[i] != '<' { i += 1; }
            let text: String = chars[text_start..i].iter().collect();
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                if let Some(current) = stack.last_mut() { current.text.push_str(trimmed); }
            }
        }
    }

    while stack.len() > 1 {
        let node = stack.pop().unwrap();
        if let Some(parent) = stack.last_mut() { parent.children.push(node); }
    }
    stack.pop().unwrap()
}

fn node_to_record(node: &XmlNode) -> Record {
    let mut record = Record::new();
    for (k, v) in &node.attributes {
        record.insert(format!("@{}", k), json!(v));
    }
    if !node.text.is_empty() {
        record.insert("#text".into(), json!(node.text));
    }
    for child in &node.children {
        let key = match &child.namespace {
            Some(ns) => format!("{}:{}", ns, child.tag),
            None => child.tag.clone(),
        };
        let value = if child.children.is_empty() {
            if child.text.is_empty() { Value::Null } else { json!(child.text) }
        } else {
            serde_json::to_value(node_to_record(child)).unwrap_or(Value::Null)
        };
        if let Some(existing) = record.get_mut(&key) {
            if let Value::Array(arr) = existing { arr.push(value); }
            else { let prev = existing.clone(); *existing = json!([prev, value]); }
        } else {
            record.insert(key, value);
        }
    }
    record
}

fn find_descendants(node: &XmlNode, tag_name: &str) -> Vec<XmlNode> {
    let mut result = Vec::new();
    for child in &node.children {
        if tag_name == "*" || child.tag == tag_name { result.push(child.clone()); }
        result.extend(find_descendants(child, tag_name));
    }
    result
}

fn evaluate_xpath(root: &XmlNode, xpath: &str) -> Vec<XmlNode> {
    let is_deep = xpath.starts_with("//");
    let cleaned = xpath.trim_start_matches('/');
    let segments: Vec<&str> = cleaned.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() { return root.children.clone(); }

    if is_deep {
        let tag = segments.last().unwrap_or(&"*");
        return find_descendants(root, tag);
    }

    let mut current = root.children.clone();
    for segment in &segments {
        let mut next = Vec::new();
        for node in &current {
            if *segment == "*" || node.tag == *segment {
                next.push(node.clone());
            }
        }
        if next.is_empty() { break; }
        if segments.last() != Some(segment) {
            let children: Vec<XmlNode> = next.iter().flat_map(|n| n.children.clone()).collect();
            current = children;
        } else {
            current = next;
        }
    }
    current
}

pub struct XmlConnectorProvider {
    config: Option<ConnectorConfig>,
}

impl XmlConnectorProvider {
    pub fn new() -> Self { Self { config: None } }

    pub fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let source = query.path.as_deref().or(config.base_url.as_deref()).unwrap_or("");
        let xpath = config.options.as_ref()
            .and_then(|o| o.get("xpath"))
            .and_then(|v| v.as_str())
            .or(query.query.as_deref())
            .unwrap_or("//*");
        let limit = query.limit.unwrap_or(u64::MAX) as usize;
        let offset = query.cursor.as_deref().and_then(|c| c.parse::<usize>().ok()).unwrap_or(0);

        let xml_str = fs::read_to_string(source).map_err(|e| ConnectorError(e.to_string()))?;
        let root = parse_xml(&xml_str);
        let nodes = evaluate_xpath(&root, xpath);

        Ok(nodes.into_iter().skip(offset).take(limit).map(|n| node_to_record(&n)).collect())
    }

    pub fn write(&self, records: &[Record], config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let output_path = config.options.as_ref()
            .and_then(|o| o.get("outputPath")).and_then(|v| v.as_str()).unwrap_or("");
        if output_path.is_empty() {
            return Ok(WriteResult { created: 0, updated: 0, skipped: records.len() as u64, errors: 0 });
        }
        let root_tag = config.options.as_ref()
            .and_then(|o| o.get("rootTag")).and_then(|v| v.as_str()).unwrap_or("records");
        let item_tag = config.options.as_ref()
            .and_then(|o| o.get("itemTag")).and_then(|v| v.as_str()).unwrap_or("record");

        fn record_to_xml(record: &Record, indent: &str) -> String {
            let mut xml = String::new();
            for (key, value) in record {
                if key.starts_with('@') || key == "#text" { continue; }
                match value {
                    Value::Array(arr) => {
                        for item in arr {
                            xml.push_str(&format!("{}<{}>{}</{}>\n", indent, key, item, key));
                        }
                    }
                    Value::Object(map) => {
                        let inner: Record = map.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
                        xml.push_str(&format!("{}<{}>\n{}{}</{}>\n", indent, key, record_to_xml(&inner, &format!("{}  ", indent)), indent, key));
                    }
                    _ => xml.push_str(&format!("{}<{}>{}</{}>\n", indent, key, value, key)),
                }
            }
            xml
        }

        let mut output = format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<{}>\n", root_tag);
        for record in records {
            output.push_str(&format!("  <{}>\n{}  </{}>\n", item_tag, record_to_xml(record, "    "), item_tag));
        }
        output.push_str(&format!("</{}>\n", root_tag));

        fs::write(output_path, output).map_err(|e| ConnectorError(e.to_string()))?;
        Ok(WriteResult { created: records.len() as u64, updated: 0, skipped: 0, errors: 0 })
    }

    pub fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let source = config.base_url.as_deref().unwrap_or("");
        let start = Instant::now();
        match fs::read_to_string(source) {
            Ok(content) => {
                let is_xml = content.trim_start().starts_with("<?xml") || content.trim_start().starts_with('<');
                Ok(TestResult {
                    connected: true,
                    message: if is_xml { "Valid XML source".into() } else { "Accessible but may not be XML".into() },
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                })
            }
            Err(e) => Ok(TestResult { connected: false, message: e.to_string(), latency_ms: Some(start.elapsed().as_millis() as u64) }),
        }
    }

    pub fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let source = config.base_url.as_deref().unwrap_or("");
        let xml_str = fs::read_to_string(source).map_err(|e| ConnectorError(e.to_string()))?;
        let root = parse_xml(&xml_str);

        let mut tag_counts: HashMap<String, usize> = HashMap::new();
        fn count_tags(node: &XmlNode, counts: &mut HashMap<String, usize>) {
            *counts.entry(node.tag.clone()).or_insert(0) += 1;
            for child in &node.children { count_tags(child, counts); }
        }
        for child in &root.children { count_tags(child, &mut tag_counts); }

        let streams: Vec<StreamDef> = tag_counts.into_iter()
            .filter(|(tag, count)| *count >= 2 && tag != "__root__")
            .map(|(tag, _)| {
                let samples = find_descendants(&root, &tag);
                let schema = if let Some(first) = samples.first() {
                    let rec = node_to_record(first);
                    let mut s = HashMap::new();
                    s.insert("type".into(), json!("object"));
                    let props: HashMap<String, Value> = rec.keys().map(|k| (k.clone(), json!({"type": "string"}))).collect();
                    s.insert("properties".into(), serde_json::to_value(props).unwrap_or_default());
                    s
                } else { HashMap::new() };
                StreamDef { name: tag, schema, supported_sync_modes: vec!["full_refresh".into()] }
            })
            .collect();
        Ok(DiscoveryResult { streams })
    }
}
