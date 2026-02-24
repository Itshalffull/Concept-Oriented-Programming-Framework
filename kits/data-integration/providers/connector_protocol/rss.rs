// RSS — connector_protocol provider
// RSS/Atom feed parser with entry dedup via guid, enclosure handling, and conditional GET via ETag/Last-Modified

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::time::Instant;

pub const PROVIDER_ID: &str = "rss";
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
enum FeedType { Rss, Atom, Unknown }

fn detect_feed_type(xml: &str) -> FeedType {
    if xml.contains("<feed") && xml.contains("http://www.w3.org/2005/Atom") { FeedType::Atom }
    else if xml.contains("<rss") || xml.contains("<channel>") { FeedType::Rss }
    else { FeedType::Unknown }
}

fn extract_tag_content(xml: &str, tag: &str) -> String {
    let open_patterns = [format!("<{}>", tag), format!("<{} ", tag)];
    let close_tag = format!("</{}>", tag);
    for open in &open_patterns {
        if let Some(start_pos) = xml.find(open.as_str()) {
            let content_start = xml[start_pos..].find('>').map(|p| start_pos + p + 1).unwrap_or(0);
            if let Some(end_pos) = xml[content_start..].find(&close_tag) {
                let content = &xml[content_start..content_start + end_pos];
                return content
                    .replace("<![CDATA[", "")
                    .replace("]]>", "")
                    .trim()
                    .to_string();
            }
        }
    }
    String::new()
}

fn extract_attribute(tag_str: &str, attr: &str) -> String {
    let pattern = format!("{}=\"", attr);
    if let Some(pos) = tag_str.find(&pattern) {
        let start = pos + pattern.len();
        if let Some(end) = tag_str[start..].find('"') {
            return tag_str[start..start + end].to_string();
        }
    }
    String::new()
}

fn parse_rss_items(xml: &str) -> Vec<Record> {
    let mut entries = Vec::new();
    let mut search_start = 0;
    while let Some(item_start) = xml[search_start..].find("<item") {
        let abs_start = search_start + item_start;
        if let Some(item_end) = xml[abs_start..].find("</item>") {
            let item_xml = &xml[abs_start..abs_start + item_end + 7];
            let guid = {
                let g = extract_tag_content(item_xml, "guid");
                if g.is_empty() { extract_tag_content(item_xml, "link") } else { g }
            };

            // Parse enclosures
            let mut enclosures = Vec::new();
            let mut enc_search = 0;
            while let Some(enc_pos) = item_xml[enc_search..].find("<enclosure") {
                let abs_enc = enc_search + enc_pos;
                if let Some(enc_end) = item_xml[abs_enc..].find('>') {
                    let enc_tag = &item_xml[abs_enc..abs_enc + enc_end + 1];
                    enclosures.push(json!({
                        "url": extract_attribute(enc_tag, "url"),
                        "type": extract_attribute(enc_tag, "type"),
                        "length": extract_attribute(enc_tag, "length").parse::<u64>().unwrap_or(0)
                    }));
                    enc_search = abs_enc + enc_end + 1;
                } else { break; }
            }

            // Parse categories
            let mut categories = Vec::new();
            let mut cat_search = 0;
            while let Some(cat_pos) = item_xml[cat_search..].find("<category") {
                let abs_cat = cat_search + cat_pos;
                if let Some(cat_end) = item_xml[abs_cat..].find("</category>") {
                    let cat_content = &item_xml[abs_cat..abs_cat + cat_end + 11];
                    categories.push(Value::String(extract_tag_content(cat_content, "category")));
                    cat_search = abs_cat + cat_end + 11;
                } else { break; }
            }

            let mut entry = HashMap::new();
            entry.insert("guid".into(), json!(guid));
            entry.insert("title".into(), json!(extract_tag_content(item_xml, "title")));
            entry.insert("link".into(), json!(extract_tag_content(item_xml, "link")));
            entry.insert("description".into(), json!(extract_tag_content(item_xml, "description")));
            entry.insert("pubDate".into(), json!(extract_tag_content(item_xml, "pubDate")));
            entry.insert("author".into(), json!(extract_tag_content(item_xml, "author")));
            entry.insert("categories".into(), Value::Array(categories));
            entry.insert("enclosures".into(), Value::Array(enclosures));
            entries.push(entry);

            search_start = abs_start + item_end + 7;
        } else { break; }
    }
    entries
}

fn parse_atom_entries(xml: &str) -> Vec<Record> {
    let mut entries = Vec::new();
    let mut search_start = 0;
    while let Some(entry_start) = xml[search_start..].find("<entry") {
        let abs_start = search_start + entry_start;
        if let Some(entry_end) = xml[abs_start..].find("</entry>") {
            let entry_xml = &xml[abs_start..abs_start + entry_end + 8];
            let link = if let Some(link_pos) = entry_xml.find("<link") {
                if let Some(end) = entry_xml[link_pos..].find('>') {
                    extract_attribute(&entry_xml[link_pos..link_pos + end + 1], "href")
                } else { String::new() }
            } else { String::new() };

            let mut entry = HashMap::new();
            let id = extract_tag_content(entry_xml, "id");
            entry.insert("guid".into(), json!(if id.is_empty() { &link } else { &id }));
            entry.insert("title".into(), json!(extract_tag_content(entry_xml, "title")));
            entry.insert("link".into(), json!(link));
            entry.insert("description".into(), json!(extract_tag_content(entry_xml, "summary")));
            entry.insert("pubDate".into(), json!(extract_tag_content(entry_xml, "updated")));
            entry.insert("author".into(), json!(extract_tag_content(entry_xml, "name")));
            entries.push(entry);

            search_start = abs_start + entry_end + 8;
        } else { break; }
    }
    entries
}

pub struct RssConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
    etag: Option<String>,
    last_modified: Option<String>,
    seen_guids: HashSet<String>,
}

impl RssConnectorProvider {
    pub fn new() -> Self {
        Self {
            config: None,
            client: reqwest::Client::new(),
            etag: None,
            last_modified: None,
            seen_guids: HashSet::new(),
        }
    }

    pub async fn read(&mut self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let feed_url = config.base_url.as_deref().or(query.path.as_deref()).unwrap_or("");
        let mut req = self.client.get(feed_url);
        if let Some(etag) = &self.etag { req = req.header("If-None-Match", etag); }
        if let Some(lm) = &self.last_modified { req = req.header("If-Modified-Since", lm); }

        let resp = req.send().await.map_err(|e| ConnectorError(e.to_string()))?;
        if resp.status().as_u16() == 304 { return Ok(Vec::new()); }
        if !resp.status().is_success() {
            return Err(ConnectorError(format!("HTTP {}", resp.status())));
        }

        self.etag = resp.headers().get("ETag").and_then(|v| v.to_str().ok()).map(String::from);
        self.last_modified = resp.headers().get("Last-Modified").and_then(|v| v.to_str().ok()).map(String::from);

        let xml = resp.text().await.map_err(|e| ConnectorError(e.to_string()))?;
        let feed_type = detect_feed_type(&xml);
        let entries = match feed_type {
            FeedType::Atom => parse_atom_entries(&xml),
            _ => parse_rss_items(&xml),
        };

        let limit = query.limit.unwrap_or(entries.len() as u64) as usize;
        let mut result = Vec::new();
        for entry in entries {
            if result.len() >= limit { break; }
            let guid = entry.get("guid").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !guid.is_empty() && self.seen_guids.contains(&guid) { continue; }
            self.seen_guids.insert(guid);
            result.push(entry);
        }
        Ok(result)
    }

    pub async fn write(&self, records: &[Record], _config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        Ok(WriteResult { created: 0, updated: 0, skipped: records.len() as u64, errors: 0 })
    }

    pub async fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let url = config.base_url.as_deref().unwrap_or("");
        let start = Instant::now();
        match self.client.head(url).send().await {
            Ok(resp) => {
                let ct = resp.headers().get("Content-Type").and_then(|v| v.to_str().ok()).unwrap_or("");
                let is_feed = ct.contains("xml") || ct.contains("rss") || ct.contains("atom");
                Ok(TestResult {
                    connected: resp.status().is_success(),
                    message: if resp.status().is_success() {
                        format!("Feed accessible ({})", if is_feed { "feed content-type" } else { "non-feed content-type" })
                    } else { format!("HTTP {}", resp.status()) },
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                })
            }
            Err(e) => Ok(TestResult { connected: false, message: e.to_string(), latency_ms: Some(start.elapsed().as_millis() as u64) }),
        }
    }

    pub async fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let url = config.base_url.as_deref().unwrap_or("");
        match self.client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let xml = resp.text().await.map_err(|e| ConnectorError(e.to_string()))?;
                let title = extract_tag_content(&xml, "title");
                let mut schema = HashMap::new();
                schema.insert("type".into(), json!("object"));
                schema.insert("properties".into(), json!({
                    "guid": {"type": "string"}, "title": {"type": "string"},
                    "link": {"type": "string"}, "description": {"type": "string"},
                    "pubDate": {"type": "string"}, "author": {"type": "string"}
                }));
                Ok(DiscoveryResult {
                    streams: vec![StreamDef {
                        name: if title.is_empty() { url.to_string() } else { title },
                        schema,
                        supported_sync_modes: vec!["full_refresh".into(), "incremental".into()],
                    }],
                })
            }
            _ => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
