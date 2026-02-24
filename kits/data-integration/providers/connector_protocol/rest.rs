// REST — connector_protocol provider
// Generic REST API connector with pagination, auth, rate limiting, and retry logic

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub const PROVIDER_ID: &str = "rest";
pub const PLUGIN_TYPE: &str = "connector_protocol";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorConfig {
    pub base_url: Option<String>,
    pub connection_string: Option<String>,
    pub auth: Option<AuthConfig>,
    pub headers: Option<HashMap<String, String>>,
    pub options: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub style: String,
    pub token: Option<String>,
    pub api_key: Option<String>,
    pub api_key_header: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub token_url: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
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
pub struct WriteResult {
    pub created: u64,
    pub updated: u64,
    pub skipped: u64,
    pub errors: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub connected: bool,
    pub message: String,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamDef {
    pub name: String,
    pub schema: HashMap<String, Value>,
    pub supported_sync_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    pub streams: Vec<StreamDef>,
}

#[derive(Debug)]
pub struct ConnectorError(pub String);

impl std::fmt::Display for ConnectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ConnectorError {}

fn build_auth_headers(auth: &AuthConfig) -> HashMap<String, String> {
    let mut headers = HashMap::new();
    match auth.style.as_str() {
        "bearer" => {
            if let Some(token) = &auth.token {
                headers.insert("Authorization".into(), format!("Bearer {}", token));
            }
        }
        "api_key" => {
            let header = auth.api_key_header.as_deref().unwrap_or("X-API-Key");
            if let Some(key) = &auth.api_key {
                headers.insert(header.into(), key.clone());
            }
        }
        "basic" => {
            let user = auth.username.as_deref().unwrap_or("");
            let pass = auth.password.as_deref().unwrap_or("");
            let encoded = base64_encode(&format!("{}:{}", user, pass));
            headers.insert("Authorization".into(), format!("Basic {}", encoded));
        }
        "oauth2" => {
            if let Some(token) = &auth.token {
                headers.insert("Authorization".into(), format!("Bearer {}", token));
            }
        }
        _ => {}
    }
    headers
}

fn base64_encode(input: &str) -> String {
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
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub struct RestConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
}

impl RestConnectorProvider {
    pub fn new() -> Self {
        Self {
            config: None,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }

    fn build_headers(&self, config: &ConnectorConfig) -> HashMap<String, String> {
        let mut headers: HashMap<String, String> = HashMap::new();
        headers.insert("Content-Type".into(), "application/json".into());
        if let Some(cfg_headers) = &config.headers {
            headers.extend(cfg_headers.clone());
        }
        if let Some(auth) = &config.auth {
            headers.extend(build_auth_headers(auth));
        }
        headers
    }

    async fn fetch_with_retry(
        &self,
        url: &str,
        headers: &HashMap<String, String>,
        max_retries: u32,
    ) -> Result<reqwest::Response, ConnectorError> {
        let mut last_err = String::new();
        for attempt in 0..=max_retries {
            let mut req = self.client.get(url);
            for (k, v) in headers {
                req = req.header(k.as_str(), v.as_str());
            }
            match req.send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if status == 429 || status >= 500 {
                        let delay = resp
                            .headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse::<u64>().ok())
                            .unwrap_or(2u64.pow(attempt));
                        tokio::time::sleep(Duration::from_secs(delay)).await;
                        continue;
                    }
                    return Ok(resp);
                }
                Err(e) => {
                    last_err = e.to_string();
                    if attempt < max_retries {
                        tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                    }
                }
            }
        }
        Err(ConnectorError(format!("Request failed after retries: {}", last_err)))
    }

    pub async fn read(
        &self,
        query: &QuerySpec,
        config: &ConnectorConfig,
    ) -> Result<Vec<Record>, ConnectorError> {
        let base = config.base_url.as_deref().unwrap_or("").trim_end_matches('/');
        let path = query.path.as_deref().unwrap_or("/");
        let page_size = query.limit.unwrap_or(100);
        let headers = self.build_headers(config);
        let data_key = config
            .options.as_ref()
            .and_then(|o| o.get("dataKey"))
            .and_then(|v| v.as_str())
            .unwrap_or("data");
        let pagination = config
            .options.as_ref()
            .and_then(|o| o.get("pagination"))
            .and_then(|v| v.as_str())
            .unwrap_or("offset");

        let mut all_records = Vec::new();
        let mut offset: u64 = 0;
        let mut cursor = query.cursor.clone();

        loop {
            let mut url = format!("{}{}?limit={}", base, path, page_size);
            if let Some(params) = &query.params {
                for (k, v) in params {
                    url.push_str(&format!("&{}={}", k, v));
                }
            }
            match pagination {
                "cursor" => {
                    if let Some(c) = &cursor {
                        url.push_str(&format!("&cursor={}", c));
                    }
                }
                "offset" => url.push_str(&format!("&offset={}", offset)),
                _ => {}
            }

            let resp = self.fetch_with_retry(&url, &headers, 3).await?;
            let body: Value = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;

            let records: Vec<Record> = if let Some(arr) = body.as_array() {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            } else if let Some(arr) = body.get(data_key).and_then(|v| v.as_array()) {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            } else {
                Vec::new()
            };

            let count = records.len() as u64;
            all_records.extend(records);

            if count < page_size {
                break;
            }
            match pagination {
                "cursor" => {
                    cursor = body
                        .get("next_cursor")
                        .or_else(|| body.get("cursor"))
                        .and_then(|v| v.as_str())
                        .map(String::from);
                    if cursor.is_none() {
                        break;
                    }
                }
                "offset" => offset += count,
                _ => break,
            }
        }
        Ok(all_records)
    }

    pub async fn write(
        &self,
        records: &[Record],
        config: &ConnectorConfig,
    ) -> Result<WriteResult, ConnectorError> {
        let base = config.base_url.as_deref().unwrap_or("").trim_end_matches('/');
        let write_path = config
            .options.as_ref()
            .and_then(|o| o.get("writePath"))
            .and_then(|v| v.as_str())
            .unwrap_or("/");
        let batch_size = config
            .options.as_ref()
            .and_then(|o| o.get("batchSize"))
            .and_then(|v| v.as_u64())
            .unwrap_or(50) as usize;
        let headers = self.build_headers(config);

        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };

        for chunk in records.chunks(batch_size) {
            let url = format!("{}{}", base, write_path);
            let body = serde_json::to_string(chunk).map_err(|e| ConnectorError(e.to_string()))?;
            let mut req = self.client.post(&url);
            for (k, v) in &headers {
                req = req.header(k.as_str(), v.as_str());
            }
            match req.body(body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    result.created += chunk.len() as u64;
                }
                _ => {
                    result.errors += chunk.len() as u64;
                }
            }
        }
        Ok(result)
    }

    pub async fn test_connection(
        &self,
        config: &ConnectorConfig,
    ) -> Result<TestResult, ConnectorError> {
        let base = config.base_url.as_deref().unwrap_or("").trim_end_matches('/');
        let health_path = config
            .options.as_ref()
            .and_then(|o| o.get("healthPath"))
            .and_then(|v| v.as_str())
            .unwrap_or("/");
        let headers = self.build_headers(config);
        let start = Instant::now();

        match self.fetch_with_retry(&format!("{}{}", base, health_path), &headers, 1).await {
            Ok(resp) => {
                let ok = resp.status().is_success();
                Ok(TestResult {
                    connected: ok,
                    message: if ok { "Connected successfully".into() } else { format!("HTTP {}", resp.status()) },
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                })
            }
            Err(e) => Ok(TestResult {
                connected: false,
                message: e.0,
                latency_ms: Some(start.elapsed().as_millis() as u64),
            }),
        }
    }

    pub async fn discover(
        &self,
        config: &ConnectorConfig,
    ) -> Result<DiscoveryResult, ConnectorError> {
        let base = config.base_url.as_deref().unwrap_or("").trim_end_matches('/');
        let disc_path = config
            .options.as_ref()
            .and_then(|o| o.get("discoveryPath"))
            .and_then(|v| v.as_str())
            .unwrap_or("/");
        let headers = self.build_headers(config);

        match self.fetch_with_retry(&format!("{}{}", base, disc_path), &headers, 1).await {
            Ok(resp) if resp.status().is_success() => {
                let body: Value = resp.json().await.map_err(|e| ConnectorError(e.to_string()))?;
                let names: Vec<String> = if let Some(arr) = body.as_array() {
                    arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                } else if let Some(obj) = body.as_object() {
                    obj.keys().cloned().collect()
                } else {
                    Vec::new()
                };
                Ok(DiscoveryResult {
                    streams: names
                        .into_iter()
                        .map(|name| StreamDef {
                            name,
                            schema: HashMap::new(),
                            supported_sync_modes: vec!["full_refresh".into(), "incremental".into()],
                        })
                        .collect(),
                })
            }
            _ => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
