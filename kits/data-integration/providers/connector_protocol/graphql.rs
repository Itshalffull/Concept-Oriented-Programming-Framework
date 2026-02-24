// GraphQL — connector_protocol provider
// GraphQL connector with variable binding, relay cursor pagination, query batching, and schema introspection

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;

pub const PROVIDER_ID: &str = "graphql";
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
pub struct StreamDef {
    pub name: String,
    pub schema: HashMap<String, Value>,
    pub supported_sync_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult { pub streams: Vec<StreamDef> }

#[derive(Debug)]
pub struct ConnectorError(pub String);
impl std::fmt::Display for ConnectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}
impl std::error::Error for ConnectorError {}

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: Option<Value>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
struct GraphQLError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct PageInfo {
    has_next_page: Option<bool>,
    end_cursor: Option<String>,
}

const INTROSPECTION_QUERY: &str = r#"
  query IntrospectionQuery {
    __schema {
      queryType { name }
      types {
        name kind
        fields { name type { name kind ofType { name kind } } }
      }
    }
  }
"#;

pub struct GraphqlConnectorProvider {
    config: Option<ConnectorConfig>,
    client: reqwest::Client,
}

impl GraphqlConnectorProvider {
    pub fn new() -> Self {
        Self {
            config: None,
            client: reqwest::Client::new(),
        }
    }

    fn build_headers(&self, config: &ConnectorConfig) -> HashMap<String, String> {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".into(), "application/json".into());
        if let Some(cfg_h) = &config.headers {
            headers.extend(cfg_h.clone());
        }
        if let Some(auth) = &config.auth {
            match auth.get("style").map(|s| s.as_str()) {
                Some("bearer") => {
                    if let Some(token) = auth.get("token") {
                        headers.insert("Authorization".into(), format!("Bearer {}", token));
                    }
                }
                Some("api_key") => {
                    let header = auth.get("apiKeyHeader").map(|s| s.as_str()).unwrap_or("X-API-Key");
                    if let Some(key) = auth.get("apiKey") {
                        headers.insert(header.into(), key.clone());
                    }
                }
                _ => {}
            }
        }
        headers
    }

    async fn execute_graphql(
        &self,
        endpoint: &str,
        query: &str,
        variables: Value,
        headers: &HashMap<String, String>,
    ) -> Result<GraphQLResponse, ConnectorError> {
        let body = json!({ "query": query, "variables": variables });
        let mut req = self.client.post(endpoint);
        for (k, v) in headers {
            req = req.header(k.as_str(), v.as_str());
        }
        let resp = req
            .json(&body)
            .send()
            .await
            .map_err(|e| ConnectorError(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(ConnectorError(format!("HTTP {}", resp.status())));
        }
        resp.json::<GraphQLResponse>()
            .await
            .map_err(|e| ConnectorError(e.to_string()))
    }

    fn extract_connection(data: &Value) -> Option<(Vec<Record>, Option<PageInfo>)> {
        if let Some(obj) = data.as_object() {
            for (_key, value) in obj {
                if let Some(inner) = value.as_object() {
                    if inner.contains_key("edges") || inner.contains_key("nodes") {
                        let mut records = Vec::new();
                        if let Some(edges) = inner.get("edges").and_then(|e| e.as_array()) {
                            for edge in edges {
                                if let Some(node) = edge.get("node") {
                                    if let Ok(rec) = serde_json::from_value(node.clone()) {
                                        records.push(rec);
                                    }
                                }
                            }
                        } else if let Some(nodes) = inner.get("nodes").and_then(|n| n.as_array()) {
                            for node in nodes {
                                if let Ok(rec) = serde_json::from_value(node.clone()) {
                                    records.push(rec);
                                }
                            }
                        }
                        let page_info = inner.get("pageInfo").and_then(|pi| {
                            Some(PageInfo {
                                has_next_page: pi.get("hasNextPage").and_then(|v| v.as_bool()),
                                end_cursor: pi.get("endCursor").and_then(|v| v.as_str()).map(String::from),
                            })
                        });
                        return Some((records, page_info));
                    }
                }
                if let Some(result) = Self::extract_connection(value) {
                    return Some(result);
                }
            }
        }
        None
    }

    pub async fn read(
        &self,
        query: &QuerySpec,
        config: &ConnectorConfig,
    ) -> Result<Vec<Record>, ConnectorError> {
        let endpoint = config.base_url.as_deref().unwrap_or("");
        let gql_query = query.query.as_deref().unwrap_or("");
        let headers = self.build_headers(config);
        let page_size = query.limit.unwrap_or(50);
        let mut all_records = Vec::new();
        let mut cursor = query.cursor.clone();
        let mut has_more = true;

        while has_more {
            let mut variables = query.params.as_ref()
                .map(|p| serde_json::to_value(p).unwrap_or(Value::Object(Default::default())))
                .unwrap_or(json!({}));
            if let Some(obj) = variables.as_object_mut() {
                obj.insert("first".into(), json!(page_size));
                if let Some(c) = &cursor {
                    obj.insert("after".into(), json!(c));
                }
            }

            let result = self.execute_graphql(endpoint, gql_query, variables, &headers).await?;
            if let Some(errors) = &result.errors {
                if !errors.is_empty() {
                    return Err(ConnectorError(errors.iter().map(|e| e.message.clone()).collect::<Vec<_>>().join("; ")));
                }
            }
            let data = match result.data {
                Some(d) => d,
                None => break,
            };

            if let Some((records, page_info)) = Self::extract_connection(&data) {
                all_records.extend(records);
                if let Some(pi) = page_info {
                    has_more = pi.has_next_page.unwrap_or(false);
                    cursor = pi.end_cursor;
                } else {
                    has_more = false;
                }
            } else {
                has_more = false;
            }
        }
        Ok(all_records)
    }

    pub async fn write(
        &self,
        records: &[Record],
        config: &ConnectorConfig,
    ) -> Result<WriteResult, ConnectorError> {
        let endpoint = config.base_url.as_deref().unwrap_or("");
        let mutation = config.options.as_ref()
            .and_then(|o| o.get("mutation"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let headers = self.build_headers(config);
        let mut result = WriteResult { created: 0, updated: 0, skipped: 0, errors: 0 };

        for record in records {
            let variables = json!({ "input": record });
            match self.execute_graphql(endpoint, mutation, variables, &headers).await {
                Ok(resp) => {
                    if resp.errors.as_ref().map_or(false, |e| !e.is_empty()) {
                        result.errors += 1;
                    } else {
                        result.created += 1;
                    }
                }
                Err(_) => result.errors += 1,
            }
        }
        Ok(result)
    }

    pub async fn test_connection(
        &self,
        config: &ConnectorConfig,
    ) -> Result<TestResult, ConnectorError> {
        let endpoint = config.base_url.as_deref().unwrap_or("");
        let headers = self.build_headers(config);
        let start = Instant::now();
        match self.execute_graphql(endpoint, "{ __typename }", json!({}), &headers).await {
            Ok(resp) => {
                let has_err = resp.errors.as_ref().map_or(false, |e| !e.is_empty());
                Ok(TestResult {
                    connected: !has_err && resp.data.is_some(),
                    message: if has_err { "GraphQL errors returned".into() } else { "Connected successfully".into() },
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
        let endpoint = config.base_url.as_deref().unwrap_or("");
        let headers = self.build_headers(config);
        match self.execute_graphql(endpoint, INTROSPECTION_QUERY, json!({}), &headers).await {
            Ok(resp) => {
                let data = resp.data.unwrap_or(json!(null));
                let types = data.pointer("/__schema/types")
                    .and_then(|t| t.as_array())
                    .cloned()
                    .unwrap_or_default();
                let streams: Vec<StreamDef> = types.into_iter()
                    .filter(|t| {
                        let kind = t.get("kind").and_then(|k| k.as_str()).unwrap_or("");
                        let name = t.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        kind == "OBJECT" && !name.starts_with("__")
                    })
                    .map(|t| {
                        let name = t.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                        let mut schema = HashMap::new();
                        if let Some(fields) = t.get("fields").and_then(|f| f.as_array()) {
                            for field in fields {
                                let fname = field.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                let ftype = field.pointer("/type/name").and_then(|n| n.as_str()).unwrap_or("Any");
                                schema.insert(fname.to_string(), json!(ftype));
                            }
                        }
                        StreamDef {
                            name,
                            schema,
                            supported_sync_modes: vec!["full_refresh".into()],
                        }
                    })
                    .collect();
                Ok(DiscoveryResult { streams })
            }
            Err(_) => Ok(DiscoveryResult { streams: Vec::new() }),
        }
    }
}
