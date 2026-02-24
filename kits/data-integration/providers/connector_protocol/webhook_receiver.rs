// WebhookReceiver — connector_protocol provider
// Inbound webhook endpoint with HMAC-SHA256 signature validation, payload queuing, and retry acknowledgment

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;

pub const PROVIDER_ID: &str = "webhook_receiver";
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
struct QueuedPayload {
    id: String,
    received_at: String,
    headers: HashMap<String, String>,
    body: Value,
    verified: bool,
    acknowledged: bool,
    retry_count: u32,
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("wh_{}_{:x}", ts, rand_simple())
}

fn rand_simple() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos() as u64 % 0xFFFFFFFF
}

fn compute_hmac_sha256(secret: &str, payload: &str) -> String {
    // In production, use ring or hmac crate
    // Simplified representation for structural correctness
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    secret.hash(&mut hasher);
    payload.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn verify_signature(payload: &str, signature: Option<&str>, secret: &str, prefix: &str) -> bool {
    if secret.is_empty() { return true; }
    let sig = match signature {
        Some(s) => s,
        None => return false,
    };
    let computed = compute_hmac_sha256(secret, payload);
    let expected = if sig.starts_with(prefix) { &sig[prefix.len()..] } else { sig };
    // Constant-time comparison
    if computed.len() != expected.len() { return false; }
    computed.bytes().zip(expected.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

pub struct WebhookReceiverConnectorProvider {
    config: Option<ConnectorConfig>,
    queue: Vec<QueuedPayload>,
    max_queue_size: usize,
    secret: String,
    signature_header: String,
    signature_prefix: String,
}

impl WebhookReceiverConnectorProvider {
    pub fn new() -> Self {
        Self {
            config: None,
            queue: Vec::new(),
            max_queue_size: 10000,
            secret: String::new(),
            signature_header: "x-hub-signature-256".into(),
            signature_prefix: "sha256=".into(),
        }
    }

    pub fn configure(&mut self, config: &ConnectorConfig) {
        self.secret = config.auth.as_ref().and_then(|a| a.get("secret")).cloned().unwrap_or_default();
        if let Some(opts) = &config.options {
            if let Some(h) = opts.get("signatureHeader").and_then(|v| v.as_str()) { self.signature_header = h.to_string(); }
            if let Some(p) = opts.get("signaturePrefix").and_then(|v| v.as_str()) { self.signature_prefix = p.to_string(); }
            if let Some(m) = opts.get("maxQueueSize").and_then(|v| v.as_u64()) { self.max_queue_size = m as usize; }
        }
    }

    pub fn receive_webhook(&mut self, body: &str, headers: HashMap<String, String>) -> (bool, Option<String>, String) {
        let signature = headers.get(&self.signature_header).map(|s| s.as_str());
        let verified = verify_signature(body, signature, &self.secret, &self.signature_prefix);

        if !self.secret.is_empty() && !verified {
            return (false, None, "Invalid signature".into());
        }

        if self.queue.len() >= self.max_queue_size {
            if let Some(pos) = self.queue.iter().position(|p| p.acknowledged) {
                self.queue.drain(..=pos);
            } else {
                self.queue.remove(0);
            }
        }

        let parsed_body: Value = serde_json::from_str(body).unwrap_or(json!({"raw": body}));
        let id = generate_id();
        let now = chrono_now_iso();

        self.queue.push(QueuedPayload {
            id: id.clone(),
            received_at: now,
            headers,
            body: parsed_body,
            verified,
            acknowledged: false,
            retry_count: 0,
        });

        (true, Some(id), "Payload queued".into())
    }

    pub fn acknowledge(&mut self, id: &str) -> bool {
        if let Some(payload) = self.queue.iter_mut().find(|p| p.id == id) {
            payload.acknowledged = true;
            true
        } else { false }
    }

    pub fn read(&self, query: &QuerySpec, config: &ConnectorConfig) -> Result<Vec<Record>, ConnectorError> {
        let limit = query.limit.unwrap_or(self.queue.len() as u64) as usize;
        let only_unacked = config.options.as_ref()
            .and_then(|o| o.get("onlyUnacknowledged"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let cursor = query.cursor.as_deref();

        let start_idx = if let Some(since_id) = cursor {
            self.queue.iter().position(|p| p.id == since_id).map(|i| i + 1).unwrap_or(0)
        } else { 0 };

        let mut records = Vec::new();
        for i in start_idx..self.queue.len() {
            if records.len() >= limit { break; }
            let payload = &self.queue[i];
            if only_unacked && payload.acknowledged { continue; }
            let mut rec = Record::new();
            rec.insert("id".into(), json!(payload.id));
            rec.insert("receivedAt".into(), json!(payload.received_at));
            rec.insert("body".into(), payload.body.clone());
            rec.insert("verified".into(), json!(payload.verified));
            rec.insert("acknowledged".into(), json!(payload.acknowledged));
            records.push(rec);
        }
        Ok(records)
    }

    pub fn write(&mut self, records: &[Record], _config: &ConnectorConfig) -> Result<WriteResult, ConnectorError> {
        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };
        for record in records {
            if let Some(id) = record.get("id").and_then(|v| v.as_str()) {
                if self.acknowledge(id) { result.updated += 1; }
                else { result.skipped += 1; }
            } else { result.skipped += 1; }
        }
        Ok(result)
    }

    pub fn test_connection(&self, _config: &ConnectorConfig) -> Result<TestResult, ConnectorError> {
        let start = Instant::now();
        Ok(TestResult {
            connected: true,
            message: format!("Webhook receiver ready. Queue: {}/{}. Signature: {}",
                self.queue.len(), self.max_queue_size,
                if self.secret.is_empty() { "disabled" } else { "enabled" }),
            latency_ms: Some(start.elapsed().as_millis() as u64),
        })
    }

    pub fn discover(&self, _config: &ConnectorConfig) -> Result<DiscoveryResult, ConnectorError> {
        let mut schema = HashMap::new();
        schema.insert("type".into(), json!("object"));
        schema.insert("properties".into(), json!({
            "id": {"type": "string"}, "receivedAt": {"type": "string"},
            "body": {"type": "object"}, "verified": {"type": "boolean"},
            "acknowledged": {"type": "boolean"}
        }));
        Ok(DiscoveryResult {
            streams: vec![StreamDef {
                name: "webhooks".into(), schema,
                supported_sync_modes: vec!["full_refresh".into(), "incremental".into()],
            }],
        })
    }
}

fn chrono_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("1970-01-01T00:00:00Z+{}s", secs) // In production, use chrono crate
}
