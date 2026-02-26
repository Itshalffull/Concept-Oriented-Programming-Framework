// CopfRemote — connector_protocol provider
// Connects to another COPF instance API for schema sharing, identity field mapping, and bidirectional sync

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;

pub const PROVIDER_ID: &str = "copf_remote";
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopfApiResponse {
    success: bool,
    data: Option<Value>,
    error: Option<String>,
    meta: Option<CopfMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopfMeta {
    cursor: Option<String>,
    has_more: Option<bool>,
    total: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FieldMapping {
    local: String,
    remote: String,
    transform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConceptSchema {
    name: String,
    identity_fields: Vec<String>,
    fields: Vec<ConceptField>,
    conventions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConceptField {
    name: String,
    #[serde(rename = "type")]
    field_type: String,
    required: bool,
}

fn build_api_url(base_url: &str, path: &str) -> String {
    format!("{}/api/v1{}", base_url.trim_end_matches('/'), path)
}

fn build_headers(config: &ConnectorConfig) -> HashMap<String, String> {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".into(), "application/json".into());
    headers.insert("X-COPF-Client".into(), "connector_protocol/copf_remote".into());
    if let Some(cfg_h) = &config.headers {
        headers.extend(cfg_h.clone());
    }
    if let Some(auth) = &config.auth {
        if let Some(token) = auth.get("token") {
            headers.insert("Authorization".into(), format!("Bearer {}", token));
        }
        if let Some(api_key) = auth.get("apiKey") {
            headers.insert("X-COPF-API-Key".into(), api_key.clone());
        }
    }
    headers
}

fn get_field_mappings(config: &ConnectorConfig) -> Vec<FieldMapping> {
    config.options.as_ref()
        .and_then(|o| o.get("fieldMappings"))
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

fn map_fields(record: &Record, mappings: &[FieldMapping], to_remote: bool) -> Record {
    if mappings.is_empty() { return record.clone(); }
    let mut mapped = Record::new();
    for mapping in mappings {
        let (src, tgt) = if to_remote { (&mapping.local, &mapping.remote) } else { (&mapping.remote, &mapping.local) };
        if let Some(value) = record.get(src) {
            let transformed = match mapping.transform.as_deref() {
                Some("toString") => json!(value.to_string()),
                Some("toLowerCase") => json!(value.as_str().map(|s| s.to_lowercase()).unwrap_or_default()),
                Some("toUpperCase") => json!(value.as_str().map(|s| s.to_uppercase()).unwrap_or_default()),
                _ => value.clone(),
            };
            mapped.insert(tgt.clone(), transformed);
        }
    }
    // Include unmapped fields
    let mapped_sources: Vec<&str> = mappings.iter()
        .map(|m| if to_remote { m.local.as_str() } else { m.remote.as_str() })
        .collect();
    for (key, value) in record {
        if !mapped_sources.contains(&key.as_str()) {
            mapped.insert(key.clone(), value.clone());
        }
    }
    mapped
}

pub struct CopfRemoteConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
}

impl CopfRemoteConnectorProvider {
    pub fn new() -> Self {
        Self { config: None, client: reqwest::Client::new() }
    }

    pub async fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_headers(config);
        let concept = query.path.as_deref().unwrap_or("");
        let limit = query.limit.unwrap_or(100);
        let field_mappings = get_field_mappings(config);

        let mut all_records = Vec::new();
        let mut cursor = query.cursor.clone();
        let mut has_more = true;

        while has_more && (all_records.len() as u64) < limit {
            let remaining = limit - all_records.len() as u64;
            let page_size = std::cmp::min(remaining, 100);
            let mut url = build_api_url(base_url, &format!("/concepts/{}/records?limit={}", concept, page_size));
            if let Some(c) = &cursor { url.push_str(&format!("&cursor={}", c)); }
            if let Some(params) = &query.params {
                for (k, v) in params { url.push_str(&format!("&{}={}", k, v)); }
            }

            let mut req = self.client.get(&url);
            for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }

            let resp = req.send().await.map_err(|e| ConnectorError(e.to_string()))?;
            let result: CopfApiResponse = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;

            if !result.success { break; }
            if let Some(data) = result.data {
                if let Some(arr) = data.as_array() {
                    for item in arr {
                        if let Ok(rec) = serde_json::from_value::<Record>(item.clone()) {
                            all_records.push(map_fields(&rec, &field_mappings, false));
                        }
                    }
                }
            }

            has_more = result.meta.as_ref().and_then(|m| m.has_more).unwrap_or(false);
            cursor = result.meta.as_ref().and_then(|m| m.cursor.clone());
        }
        Ok(all_records)
    }

    pub async fn write(&self, records: &[Record], config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_headers(config);
        let concept = config.options.as_ref().and_then(|o| o.get("concept")).and_then(|v| v.as_str()).unwrap_or("");
        let sync_mode = config.options.as_ref().and_then(|o| o.get("syncMode")).and_then(|v| v.as_str()).unwrap_or("upsert");
        let field_mappings = get_field_mappings(config);
        let batch_size = config.options.as_ref().and_then(|o| o.get("batchSize")).and_then(|v| v.as_u64()).unwrap_or(50) as usize;

        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };
        let mapped: Vec<Record> = records.iter().map(|r| map_fields(r, &field_mappings, true)).collect();

        for chunk in mapped.chunks(batch_size) {
            let url = build_api_url(base_url, &format!("/concepts/{}/sync", concept));
            let body = json!({ "records": chunk, "mode": sync_mode });
            let mut req = self.client.post(&url);
            for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }

            match req.json(&body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(api_resp) = resp.json::<CopfApiResponse>().await {
                        if let Some(data) = api_resp.data {
                            result.created += data.get("created").and_then(|v| v.as_u64()).unwrap_or(0);
                            result.updated += data.get("updated").and_then(|v| v.as_u64()).unwrap_or(0);
                            result.skipped += data.get("skipped").and_then(|v| v.as_u64()).unwrap_or(0);
                        }
                    }
                }
                _ => result.errors += chunk.len() as u64,
            }
        }
        Ok(result)
    }

    pub async fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_headers(config);
        let start = Instant::now();
        let url = build_api_url(base_url, "/health");

        let mut req = self.client.get(&url);
        for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: CopfApiResponse = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;
                let instance = body.data.as_ref().and_then(|d| d.get("instance")).and_then(|v| v.as_str()).unwrap_or("unknown");
                let version = body.data.as_ref().and_then(|d| d.get("version")).and_then(|v| v.as_str()).unwrap_or("?");
                Ok(TestResult {
                    connected: true,
                    message: format!("Connected to COPF instance: {} (v{})", instance, version),
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                })
            }
            Ok(resp) => Ok(TestResult { connected: false, message: format!("HTTP {}", resp.status()), latency_ms: Some(start.elapsed().as_millis() as u64) }),
            Err(e) => Ok(TestResult { connected: false, message: e.to_string(), latency_ms: Some(start.elapsed().as_millis() as u64) }),
        }
    }

    pub async fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_headers(config);
        let url = build_api_url(base_url, "/concepts");

        let mut req = self.client.get(&url);
        for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: CopfApiResponse = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;
                let concepts: Vec<ConceptSchema> = body.data.and_then(|d| serde_json::from_value(d).ok()).unwrap_or_default();
                Ok(DiscoveryResult {
                    streams: concepts.into_iter().map(|c| {
                        let mut schema = HashMap::new();
                        schema.insert("type".into(), json!("object"));
                        let props: HashMap<String, Value> = c.fields.iter()
                            .map(|f| (f.name.clone(), json!({"type": f.field_type, "required": f.required})))
                            .collect();
                        schema.insert("properties".into(), serde_json::to_value(props).unwrap_or_default());
                        schema.insert("identityFields".into(), json!(c.identity_fields));
                        schema.insert("conventions".into(), json!(c.conventions));
                        StreamDef {
                            name: c.name,
                            schema,
                            supported_sync_modes: vec!["full_refresh".into(), "incremental".into(), "bidirectional".into()],
                        }
                    }).collect(),
                })
            }
            _ => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
