// S3 — connector_protocol provider
// AWS S3 / compatible object storage with list/read, prefix filtering, continuation tokens, and last-modified incremental

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;

pub const PROVIDER_ID: &str = "s3";
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
struct S3Config {
    bucket: String,
    region: String,
    endpoint: Option<String>,
    access_key_id: String,
    secret_access_key: String,
    path_style: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct S3Object {
    key: String,
    size: u64,
    last_modified: String,
    etag: String,
    storage_class: String,
}

fn parse_s3_config(config: &ConnectorConfig) -> S3Config {
    let opts = config.options.as_ref();
    let auth = config.auth.as_ref();
    S3Config {
        bucket: opts.and_then(|o| o.get("bucket")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
        region: opts.and_then(|o| o.get("region")).and_then(|v| v.as_str()).unwrap_or("us-east-1").to_string(),
        endpoint: config.base_url.clone().or_else(|| opts.and_then(|o| o.get("endpoint")).and_then(|v| v.as_str()).map(String::from)),
        access_key_id: auth.and_then(|a| a.get("accessKeyId")).cloned().unwrap_or_default(),
        secret_access_key: auth.and_then(|a| a.get("secretAccessKey")).cloned().unwrap_or_default(),
        path_style: opts.and_then(|o| o.get("pathStyle")).and_then(|v| v.as_bool()).unwrap_or(false),
    }
}

fn build_endpoint(s3cfg: &S3Config) -> String {
    if let Some(ep) = &s3cfg.endpoint { return ep.trim_end_matches('/').to_string(); }
    if s3cfg.path_style {
        format!("https://s3.{}.amazonaws.com", s3cfg.region)
    } else {
        format!("https://{}.s3.{}.amazonaws.com", s3cfg.bucket, s3cfg.region)
    }
}

fn parse_list_response(xml: &str) -> (Vec<S3Object>, Option<String>, bool) {
    let mut objects = Vec::new();
    let mut search_pos = 0;

    while let Some(start) = xml[search_pos..].find("<Contents>") {
        let abs_start = search_pos + start;
        if let Some(end) = xml[abs_start..].find("</Contents>") {
            let block = &xml[abs_start..abs_start + end + 11];
            let extract = |tag: &str| -> String {
                let open = format!("<{}>", tag);
                let close = format!("</{}>", tag);
                if let Some(s) = block.find(&open) {
                    if let Some(e) = block[s + open.len()..].find(&close) {
                        return block[s + open.len()..s + open.len() + e].to_string();
                    }
                }
                String::new()
            };
            objects.push(S3Object {
                key: extract("Key"),
                size: extract("Size").parse().unwrap_or(0),
                last_modified: extract("LastModified"),
                etag: extract("ETag").replace('"', ""),
                storage_class: {
                    let sc = extract("StorageClass");
                    if sc.is_empty() { "STANDARD".to_string() } else { sc }
                },
            });
            search_pos = abs_start + end + 11;
        } else { break; }
    }

    let next_token = xml.find("<NextContinuationToken>").and_then(|s| {
        xml[s + 23..].find("</NextContinuationToken>").map(|e| xml[s + 23..s + 23 + e].to_string())
    });
    let is_truncated = xml.find("<IsTruncated>true</IsTruncated>").is_some();

    (objects, next_token, is_truncated)
}

fn extract_common_prefixes(xml: &str) -> Vec<String> {
    let mut prefixes = Vec::new();
    let mut pos = 0;
    while let Some(start) = xml[pos..].find("<CommonPrefixes><Prefix>") {
        let abs_start = pos + start + 24;
        if let Some(end) = xml[abs_start..].find("</Prefix></CommonPrefixes>") {
            prefixes.push(xml[abs_start..abs_start + end].to_string());
            pos = abs_start + end + 26;
        } else { break; }
    }
    prefixes
}

pub struct S3ConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
}

impl S3ConnectorProvider {
    pub fn new() -> Self {
        Self { config: None, client: reqwest::Client::new() }
    }

    pub async fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let s3cfg = parse_s3_config(config);
        let prefix = query.path.as_deref()
            .or_else(|| config.options.as_ref().and_then(|o| o.get("prefix")).and_then(|v| v.as_str()))
            .unwrap_or("");
        let limit = query.limit.unwrap_or(u64::MAX) as usize;
        let since = query.cursor.as_deref();
        let endpoint = build_endpoint(&s3cfg);

        let mut all_records = Vec::new();
        let mut continuation_token: Option<String> = None;
        let mut has_more = true;

        while has_more && all_records.len() < limit {
            let max_keys = std::cmp::min(1000, limit - all_records.len());
            let mut url = format!("{}?list-type=2&prefix={}&max-keys={}", endpoint, prefix, max_keys);
            if s3cfg.path_style { url = format!("{}/{}?list-type=2&prefix={}&max-keys={}", endpoint, s3cfg.bucket, prefix, max_keys); }
            if let Some(token) = &continuation_token {
                url.push_str(&format!("&continuation-token={}", token));
            }

            let resp = self.client.get(&url).send().await.map_err(|e| ConnectorError(e.to_string()))?;
            let xml = resp.text().await.map_err(|e| ConnectorError(e.to_string()))?;
            let (objects, next_token, truncated) = parse_list_response(&xml);

            for obj in objects {
                if all_records.len() >= limit { break; }
                if let Some(s) = since { if obj.last_modified.as_str() <= s { continue; } }
                let mut rec = Record::new();
                rec.insert("key".into(), json!(obj.key));
                rec.insert("size".into(), json!(obj.size));
                rec.insert("lastModified".into(), json!(obj.last_modified));
                rec.insert("etag".into(), json!(obj.etag));
                rec.insert("storageClass".into(), json!(obj.storage_class));
                all_records.push(rec);
            }

            has_more = truncated;
            continuation_token = next_token;
        }
        Ok(all_records)
    }

    pub async fn write(&self, records: &[Record], config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let s3cfg = parse_s3_config(config);
        let endpoint = build_endpoint(&s3cfg);
        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };

        for record in records {
            let key = record.get("key").and_then(|v| v.as_str());
            let body = record.get("body").and_then(|v| v.as_str());
            match (key, body) {
                (Some(k), Some(b)) => {
                    let url = if s3cfg.path_style {
                        format!("{}/{}/{}", endpoint, s3cfg.bucket, k)
                    } else {
                        format!("{}/{}", endpoint, k)
                    };
                    match self.client.put(&url).body(b.to_string()).send().await {
                        Ok(resp) if resp.status().is_success() => result.created += 1,
                        _ => result.errors += 1,
                    }
                }
                _ => result.skipped += 1,
            }
        }
        Ok(result)
    }

    pub async fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let s3cfg = parse_s3_config(config);
        let endpoint = build_endpoint(&s3cfg);
        let start = Instant::now();
        let url = if s3cfg.path_style {
            format!("{}/{}?list-type=2&max-keys=1", endpoint, s3cfg.bucket)
        } else {
            format!("{}?list-type=2&max-keys=1", endpoint)
        };
        match self.client.get(&url).send().await {
            Ok(resp) => Ok(TestResult {
                connected: resp.status().is_success(),
                message: if resp.status().is_success() { format!("Connected to bucket: {}", s3cfg.bucket) }
                    else { format!("HTTP {}", resp.status()) },
                latency_ms: Some(start.elapsed().as_millis() as u64),
            }),
            Err(e) => Ok(TestResult { connected: false, message: e.to_string(), latency_ms: Some(start.elapsed().as_millis() as u64) }),
        }
    }

    pub async fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let s3cfg = parse_s3_config(config);
        let endpoint = build_endpoint(&s3cfg);
        let url = if s3cfg.path_style {
            format!("{}/{}?list-type=2&delimiter=/&max-keys=100", endpoint, s3cfg.bucket)
        } else {
            format!("{}?list-type=2&delimiter=/&max-keys=100", endpoint)
        };
        match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let xml = resp.text().await.map_err(|e| ConnectorError(e.to_string()))?;
                let prefixes = extract_common_prefixes(&xml);
                let mut obj_schema = HashMap::new();
                obj_schema.insert("type".into(), json!("object"));
                obj_schema.insert("properties".into(), json!({
                    "key": {"type": "string"}, "size": {"type": "integer"},
                    "lastModified": {"type": "string"}, "etag": {"type": "string"}
                }));
                Ok(DiscoveryResult {
                    streams: prefixes.into_iter().map(|p| StreamDef {
                        name: p.trim_end_matches('/').to_string(),
                        schema: obj_schema.clone(),
                        supported_sync_modes: vec!["full_refresh".into(), "incremental".into()],
                    }).collect(),
                })
            }
            _ => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
