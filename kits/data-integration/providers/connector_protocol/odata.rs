// OData — connector_protocol provider
// OData v4 protocol with $filter, $select, $expand, $orderby, batch requests, and delta links for change tracking

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;

pub const PROVIDER_ID: &str = "odata";
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

#[derive(Debug, Deserialize)]
struct ODataResponse {
    #[serde(rename = "@odata.context")]
    context: Option<String>,
    #[serde(rename = "@odata.nextLink")]
    next_link: Option<String>,
    #[serde(rename = "@odata.deltaLink")]
    delta_link: Option<String>,
    #[serde(rename = "@odata.count")]
    count: Option<u64>,
    value: Option<Vec<Value>>,
}

struct ODataQueryOptions {
    filter: Option<String>,
    select: Option<String>,
    expand: Option<String>,
    orderby: Option<String>,
    top: Option<u64>,
    skip: Option<u64>,
    count: bool,
    search: Option<String>,
}

fn build_auth_headers(config: &ConnectorConfig) -> HashMap<String, String> {
    let mut headers = HashMap::new();
    headers.insert("Accept".into(), "application/json".into());
    headers.insert("Content-Type".into(), "application/json".into());
    headers.insert("OData-Version".into(), "4.0".into());
    headers.insert("OData-MaxVersion".into(), "4.0".into());
    if let Some(cfg_h) = &config.headers { headers.extend(cfg_h.clone()); }
    if let Some(auth) = &config.auth {
        match auth.get("style").map(|s| s.as_str()) {
            Some("bearer") => {
                if let Some(token) = auth.get("token") {
                    headers.insert("Authorization".into(), format!("Bearer {}", token));
                }
            }
            Some("basic") => {
                let user = auth.get("username").map(|s| s.as_str()).unwrap_or("");
                let pass = auth.get("password").map(|s| s.as_str()).unwrap_or("");
                let encoded = base64_simple(&format!("{}:{}", user, pass));
                headers.insert("Authorization".into(), format!("Basic {}", encoded));
            }
            _ => {}
        }
    }
    headers
}

fn base64_simple(input: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        result.push(if chunk.len() > 1 { CHARS[((triple >> 6) & 0x3F) as usize] as char } else { '=' });
        result.push(if chunk.len() > 2 { CHARS[(triple & 0x3F) as usize] as char } else { '=' });
    }
    result
}

fn build_query_url(base_url: &str, entity_set: &str, opts: &ODataQueryOptions) -> String {
    let mut params = Vec::new();
    if let Some(f) = &opts.filter { params.push(format!("$filter={}", f)); }
    if let Some(s) = &opts.select { params.push(format!("$select={}", s)); }
    if let Some(e) = &opts.expand { params.push(format!("$expand={}", e)); }
    if let Some(o) = &opts.orderby { params.push(format!("$orderby={}", o)); }
    if let Some(t) = opts.top { params.push(format!("$top={}", t)); }
    if let Some(s) = opts.skip { params.push(format!("$skip={}", s)); }
    if opts.count { params.push("$count=true".into()); }
    if let Some(s) = &opts.search { params.push(format!("$search={}", s)); }
    let qs = if params.is_empty() { String::new() } else { format!("?{}", params.join("&")) };
    format!("{}/{}{}", base_url.trim_end_matches('/'), entity_set, qs)
}

fn parse_odata_type(edm_type: &str) -> &str {
    match edm_type {
        "Edm.String" | "Edm.Guid" | "Edm.Binary" | "Edm.DateTime" | "Edm.DateTimeOffset" => "string",
        "Edm.Int32" | "Edm.Int64" | "Edm.Int16" | "Edm.Byte" => "integer",
        "Edm.Double" | "Edm.Decimal" | "Edm.Single" => "number",
        "Edm.Boolean" => "boolean",
        _ => "string",
    }
}

fn clean_odata_record(value: &Value) -> Record {
    let mut record = Record::new();
    if let Some(obj) = value.as_object() {
        for (key, val) in obj {
            if !key.starts_with("@odata.") && !key.starts_with("odata.") {
                record.insert(key.clone(), val.clone());
            }
        }
    }
    record
}

pub struct OdataConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
    delta_links: HashMap<String, String>,
}

impl OdataConnectorProvider {
    pub fn new() -> Self {
        Self {
            config: None,
            client: reqwest::Client::new(),
            delta_links: HashMap::new(),
        }
    }

    pub async fn read(&mut self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_auth_headers(config);
        let entity_set = query.path.as_deref().unwrap_or("");
        let limit = query.limit.unwrap_or(u64::MAX) as usize;
        let use_delta = config.options.as_ref().and_then(|o| o.get("useDelta")).and_then(|v| v.as_bool()).unwrap_or(false);

        let opts = ODataQueryOptions {
            filter: query.params.as_ref().and_then(|p| p.get("$filter")).and_then(|v| v.as_str()).map(String::from)
                .or_else(|| config.options.as_ref().and_then(|o| o.get("$filter")).and_then(|v| v.as_str()).map(String::from)),
            select: config.options.as_ref().and_then(|o| o.get("$select")).and_then(|v| v.as_str()).map(String::from),
            expand: config.options.as_ref().and_then(|o| o.get("$expand")).and_then(|v| v.as_str()).map(String::from),
            orderby: config.options.as_ref().and_then(|o| o.get("$orderby")).and_then(|v| v.as_str()).map(String::from),
            top: Some(std::cmp::min(limit as u64, 1000)),
            skip: None,
            count: config.options.as_ref().and_then(|o| o.get("$count")).and_then(|v| v.as_bool()).unwrap_or(false),
            search: query.query.clone(),
        };

        let mut url = if use_delta {
            if let Some(dl) = self.delta_links.get(entity_set) { dl.clone() }
            else { build_query_url(base_url, entity_set, &opts) }
        } else if let Some(cursor) = &query.cursor {
            cursor.clone()
        } else {
            build_query_url(base_url, entity_set, &opts)
        };

        let mut all_records = Vec::new();
        let mut has_more = true;

        while has_more && all_records.len() < limit {
            let mut req = self.client.get(&url);
            for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }
            let resp = req.send().await.map_err(|e| ConnectorError(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(ConnectorError(format!("OData HTTP {}", resp.status())));
            }
            let body: ODataResponse = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;

            if let Some(values) = body.value {
                for value in values {
                    if all_records.len() >= limit { break; }
                    all_records.push(clean_odata_record(&value));
                }
            }

            if let Some(dl) = body.delta_link {
                self.delta_links.insert(entity_set.to_string(), dl);
            }

            if let Some(nl) = body.next_link {
                url = nl;
            } else {
                has_more = false;
            }
        }
        Ok(all_records)
    }

    pub async fn write(&self, records: &[Record], config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_auth_headers(config);
        let entity_set = config.options.as_ref().and_then(|o| o.get("entitySet")).and_then(|v| v.as_str()).unwrap_or("");
        let id_field = config.options.as_ref().and_then(|o| o.get("idField")).and_then(|v| v.as_str()).unwrap_or("Id");
        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };

        for record in records {
            let id = record.get(id_field);
            let (method, url) = if let Some(id_val) = id {
                let id_str = match id_val {
                    Value::String(s) => format!("'{}'", s),
                    _ => id_val.to_string(),
                };
                ("PATCH", format!("{}/{}({})", base_url, entity_set, id_str))
            } else {
                ("POST", format!("{}/{}", base_url, entity_set))
            };

            let body = serde_json::to_string(record).map_err(|e| ConnectorError(e.to_string()))?;
            let mut req = if method == "PATCH" { self.client.patch(&url) } else { self.client.post(&url) };
            for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }
            match req.body(body).send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if status == 201 { result.created += 1; }
                    else if status == 200 || status == 204 { result.updated += 1; }
                    else { result.errors += 1; }
                }
                Err(_) => result.errors += 1,
            }
        }
        Ok(result)
    }

    pub async fn test_connection(&self, config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_auth_headers(config);
        let start = Instant::now();
        let mut req = self.client.get(base_url);
        for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: Value = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;
                let context = body.get("@odata.context").and_then(|v| v.as_str()).unwrap_or("");
                Ok(TestResult {
                    connected: true,
                    message: format!("Connected to OData v4 service{}", if context.is_empty() { String::new() } else { format!(" ({})", context) }),
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                })
            }
            Ok(resp) => Ok(TestResult { connected: false, message: format!("HTTP {}", resp.status()), latency_ms: Some(start.elapsed().as_millis() as u64) }),
            Err(e) => Ok(TestResult { connected: false, message: e.to_string(), latency_ms: Some(start.elapsed().as_millis() as u64) }),
        }
    }

    pub async fn discover(&self, config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let base_url = config.base_url.as_deref().unwrap_or("");
        let headers = build_auth_headers(config);

        // Try $metadata first
        let meta_url = format!("{}/$metadata", base_url);
        let mut req = self.client.get(&meta_url);
        for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }
        req = req.header("Accept", "application/xml");

        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                if let Ok(xml) = resp.text().await {
                    let mut streams = Vec::new();
                    let mut pos = 0;
                    while let Some(et_start) = xml[pos..].find("<EntityType ") {
                        let abs = pos + et_start;
                        if let Some(et_end) = xml[abs..].find("</EntityType>") {
                            let block = &xml[abs..abs + et_end + 13];
                            let name = block.split("Name=\"").nth(1).and_then(|s| s.split('"').next()).unwrap_or("").to_string();
                            let mut schema = HashMap::new();
                            schema.insert("type".into(), json!("object"));
                            let mut props = HashMap::new();
                            let mut prop_pos = 0;
                            while let Some(p_start) = block[prop_pos..].find("<Property ") {
                                let p_abs = prop_pos + p_start;
                                if let Some(p_end) = block[p_abs..].find("/>") {
                                    let prop_tag = &block[p_abs..p_abs + p_end + 2];
                                    let pname = prop_tag.split("Name=\"").nth(1).and_then(|s| s.split('"').next()).unwrap_or("");
                                    let ptype = prop_tag.split("Type=\"").nth(1).and_then(|s| s.split('"').next()).unwrap_or("Edm.String");
                                    props.insert(pname.to_string(), json!({"type": parse_odata_type(ptype)}));
                                    prop_pos = p_abs + p_end + 2;
                                } else { break; }
                            }
                            schema.insert("properties".into(), serde_json::to_value(props).unwrap_or_default());
                            if !name.is_empty() {
                                streams.push(StreamDef { name, schema, supported_sync_modes: vec!["full_refresh".into(), "incremental".into()] });
                            }
                            pos = abs + et_end + 13;
                        } else { break; }
                    }
                    if !streams.is_empty() { return Ok(DiscoveryResult { streams }); }
                }
            }
        }

        // Fallback to service document
        let mut req = self.client.get(base_url);
        for (k, v) in &headers { req = req.header(k.as_str(), v.as_str()); }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: Value = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;
                let sets = body.get("value").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                Ok(DiscoveryResult {
                    streams: sets.into_iter().filter_map(|s| {
                        let name = s.get("name").and_then(|v| v.as_str())?.to_string();
                        Some(StreamDef { name, schema: HashMap::new(), supported_sync_modes: vec!["full_refresh".into(), "incremental".into()] })
                    }).collect(),
                })
            }
            _ => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
