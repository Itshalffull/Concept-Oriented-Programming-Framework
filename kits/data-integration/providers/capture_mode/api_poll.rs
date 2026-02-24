// Data Integration Kit - API Poll Capture Provider
// Periodic API query with delta detection via hash, cursor, or timestamp strategies

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "api_poll";
pub const PLUGIN_TYPE: &str = "capture_mode";

#[derive(Debug, Clone)]
pub struct CaptureInput {
    pub url: Option<String>,
    pub file: Option<Vec<u8>>,
    pub email: Option<String>,
    pub share_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct CaptureConfig {
    pub mode: String,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SourceMetadata {
    pub title: String,
    pub url: Option<String>,
    pub captured_at: String,
    pub content_type: String,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CaptureItem {
    pub content: String,
    pub source_metadata: SourceMetadata,
    pub raw_data: Option<String>,
}

#[derive(Debug)]
pub enum CaptureError {
    MissingEndpoint,
    FetchError(String),
    ParseError(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingEndpoint => write!(f, "api_poll capture requires an endpoint URL"),
            CaptureError::FetchError(e) => write!(f, "Fetch error: {}", e),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum DeltaStrategy {
    Hash,
    Cursor,
    Timestamp,
}

#[derive(Debug, Clone)]
pub struct PollConfig {
    pub endpoint: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub delta_strategy: DeltaStrategy,
    pub timestamp_field: String,
    pub cursor_field: String,
    pub items_path: Option<String>,
    pub poll_interval_ms: u64,
}

#[derive(Debug, Clone, Default)]
pub struct PollState {
    pub last_hash: Option<String>,
    pub last_timestamp: Option<String>,
    pub last_cursor: Option<String>,
    pub last_poll_at: Option<String>,
}

/// DJB2 hash for fast delta comparison
fn compute_hash(data: &str) -> String {
    let mut hash: u32 = 5381;
    for byte in data.bytes() {
        hash = hash.wrapping_shl(5).wrapping_add(hash).wrapping_add(byte as u32);
    }
    format!("{:x}", hash)
}

fn parse_poll_config(input: &CaptureInput, config: &CaptureConfig) -> PollConfig {
    let opts = config.options.as_ref();
    let endpoint = input.url.clone()
        .or_else(|| opts.and_then(|o| o.get("endpoint")).and_then(|v| v.as_str()).map(String::from))
        .unwrap_or_default();

    let method = opts.and_then(|o| o.get("method")).and_then(|v| v.as_str())
        .map(|s| s.to_uppercase()).unwrap_or_else(|| "GET".to_string());

    let mut headers = HashMap::new();
    headers.insert("Accept".to_string(), "application/json".to_string());
    if let Some(h) = opts.and_then(|o| o.get("headers")).and_then(|v| v.as_object()) {
        for (k, v) in h {
            if let Some(val) = v.as_str() { headers.insert(k.clone(), val.to_string()); }
        }
    }

    let strategy_str = opts.and_then(|o| o.get("deltaStrategy")).and_then(|v| v.as_str()).unwrap_or("hash");
    let delta_strategy = match strategy_str {
        "cursor" => DeltaStrategy::Cursor,
        "timestamp" => DeltaStrategy::Timestamp,
        _ => DeltaStrategy::Hash,
    };

    PollConfig {
        endpoint,
        method,
        headers,
        body: opts.and_then(|o| o.get("body")).and_then(|v| v.as_str()).map(String::from),
        delta_strategy,
        timestamp_field: opts.and_then(|o| o.get("timestampField")).and_then(|v| v.as_str())
            .unwrap_or("updated_at").to_string(),
        cursor_field: opts.and_then(|o| o.get("cursorField")).and_then(|v| v.as_str())
            .unwrap_or("next_cursor").to_string(),
        items_path: opts.and_then(|o| o.get("itemsPath")).and_then(|v| v.as_str()).map(String::from),
        poll_interval_ms: opts.and_then(|o| o.get("pollIntervalMs")).and_then(|v| v.as_u64()).unwrap_or(60000),
    }
}

fn extract_json_path<'a>(obj: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = obj;
    for part in parts {
        match current.get(part) {
            Some(v) => current = v,
            None => return None,
        }
    }
    Some(current)
}

fn detect_changes_hash(response_body: &str, previous_hash: Option<&str>) -> (bool, String) {
    let new_hash = compute_hash(response_body);
    let changed = previous_hash.map_or(true, |prev| prev != new_hash);
    (changed, new_hash)
}

fn detect_changes_timestamp(
    data: &serde_json::Value,
    items_path: Option<&str>,
    timestamp_field: &str,
    last_timestamp: Option<&str>,
) -> (bool, Vec<serde_json::Value>, Option<String>) {
    let items = items_path
        .and_then(|p| extract_json_path(data, p))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_else(|| vec![data.clone()]);

    let mut new_items = Vec::new();
    let mut latest_timestamp: Option<String> = None;

    for item in &items {
        let ts = extract_json_path(item, timestamp_field).and_then(|v| v.as_str());
        if let Some(ts) = ts {
            if last_timestamp.map_or(true, |lt| ts > lt) {
                new_items.push(item.clone());
            }
            if latest_timestamp.as_deref().map_or(true, |lt| ts > lt) {
                latest_timestamp = Some(ts.to_string());
            }
        }
    }

    let changed = !new_items.is_empty();
    (changed, new_items, latest_timestamp)
}

fn detect_changes_cursor(
    data: &serde_json::Value,
    cursor_field: &str,
    items_path: Option<&str>,
) -> (Vec<serde_json::Value>, Option<String>) {
    let items = items_path
        .and_then(|p| extract_json_path(data, p))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_else(|| vec![data.clone()]);

    let next_cursor = extract_json_path(data, cursor_field)
        .and_then(|v| v.as_str())
        .map(String::from);

    (items, next_cursor)
}

fn extract_hostname(url: &str) -> String {
    url.find("://")
        .and_then(|i| {
            let rest = &url[i + 3..];
            let end = rest.find('/').unwrap_or(rest.len());
            Some(rest[..end].to_string())
        })
        .unwrap_or_else(|| url.to_string())
}

pub struct ApiPollCaptureProvider {
    state_store: std::sync::Mutex<HashMap<String, PollState>>,
}

impl ApiPollCaptureProvider {
    pub fn new() -> Self {
        Self {
            state_store: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let poll_config = parse_poll_config(input, config);
        if poll_config.endpoint.is_empty() { return Err(CaptureError::MissingEndpoint); }

        let state_key = compute_hash(&format!("{}{}", poll_config.endpoint, poll_config.method));
        let previous_state = self.state_store.lock().unwrap()
            .get(&state_key).cloned().unwrap_or_default();

        let response_body = http_request(&poll_config, &previous_state)
            .map_err(|e| CaptureError::FetchError(e.to_string()))?;
        let now = chrono::Utc::now().to_rfc3339();

        let parsed: serde_json::Value = serde_json::from_str(&response_body)
            .unwrap_or(serde_json::Value::String(response_body.clone()));

        let mut changed = false;
        let mut captured_items: Vec<serde_json::Value> = Vec::new();
        let mut new_state = PollState { last_poll_at: Some(now.clone()), ..Default::default() };

        match poll_config.delta_strategy {
            DeltaStrategy::Hash => {
                let (ch, hash) = detect_changes_hash(&response_body, previous_state.last_hash.as_deref());
                changed = ch;
                new_state.last_hash = Some(hash);
                if changed { captured_items.push(parsed.clone()); }
            }
            DeltaStrategy::Timestamp => {
                let (ch, items, latest) = detect_changes_timestamp(
                    &parsed, poll_config.items_path.as_deref(),
                    &poll_config.timestamp_field, previous_state.last_timestamp.as_deref(),
                );
                changed = ch;
                captured_items = items;
                new_state.last_timestamp = latest.or(previous_state.last_timestamp.clone());
            }
            DeltaStrategy::Cursor => {
                let (items, next_cursor) = detect_changes_cursor(
                    &parsed, &poll_config.cursor_field, poll_config.items_path.as_deref(),
                );
                changed = !items.is_empty();
                captured_items = items;
                new_state.last_cursor = next_cursor;
            }
        }

        self.state_store.lock().unwrap().insert(state_key, new_state);

        let content = if changed {
            serde_json::to_string_pretty(&captured_items).unwrap_or_else(|_| "(serialization error)".to_string())
        } else {
            "(no changes detected)".to_string()
        };

        let strategy_tag = match poll_config.delta_strategy {
            DeltaStrategy::Hash => "hash",
            DeltaStrategy::Cursor => "cursor",
            DeltaStrategy::Timestamp => "timestamp",
        };

        Ok(CaptureItem {
            content,
            source_metadata: SourceMetadata {
                title: format!("API Poll: {}", extract_hostname(&poll_config.endpoint)),
                url: Some(poll_config.endpoint),
                captured_at: now,
                content_type: "application/json".to_string(),
                author: None,
                tags: Some(vec![
                    "api-poll".to_string(),
                    strategy_tag.to_string(),
                    if changed { "changed" } else { "unchanged" }.to_string(),
                    format!("items:{}", captured_items.len()),
                ]),
                source: Some("api_poll".to_string()),
            },
            raw_data: None,
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.url.as_ref().map_or(false, |u| {
            u.starts_with("http://") || u.starts_with("https://")
        })
    }
}

fn http_request(_config: &PollConfig, _state: &PollState) -> Result<String, CaptureError> {
    Err(CaptureError::FetchError("HTTP client not configured".to_string()))
}
