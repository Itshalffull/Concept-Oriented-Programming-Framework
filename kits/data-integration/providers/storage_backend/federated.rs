// Federated — storage_backend provider
// Decorator-pattern storage that routes field reads/writes to either a remote backend
// (via Connector + FieldMapping + Cache through EventBus dispatch) or the local SQL
// backend, based on per-field configuration in the Schema's federation_config.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const PROVIDER_ID: &str = "federated";
pub const PLUGIN_TYPE: &str = "storage_backend";

// --- Domain types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub fields: HashMap<String, Value>,
    pub metadata: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDef {
    pub name: String,
    #[serde(rename = "type")]
    pub field_type: String,
    pub required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationConfig {
    pub source: String,
    pub field_mapping: Option<String>,
    pub cache_ttl: u64,
    pub read_only_remote: bool,
    pub local_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaAssociations {
    pub storage_backend: String,
    pub providers: HashMap<String, String>,
    pub federation_config: FederationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaRef {
    pub name: String,
    pub fields: Vec<FieldDef>,
    pub associations: SchemaAssociations,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveResult {
    pub id: String,
    pub created: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryCondition {
    pub field: String,
    pub operator: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortSpec {
    pub field: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeSpec {
    pub offset: usize,
    pub limit: usize,
}

// --- Error type ---

#[derive(Debug)]
pub enum FederatedError {
    LocalBackendError(String),
    RemoteError(String),
    CacheError(String),
}

impl std::fmt::Display for FederatedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FederatedError::LocalBackendError(msg) => write!(f, "Local backend error: {}", msg),
            FederatedError::RemoteError(msg) => write!(f, "Remote error: {}", msg),
            FederatedError::CacheError(msg) => write!(f, "Cache error: {}", msg),
        }
    }
}

impl std::error::Error for FederatedError {}

// --- Dependency trait contracts (injected) ---

pub trait LocalStorageBackend: Send + Sync {
    fn save(&self, node: &ContentNode, schema: &SchemaRef) -> Result<SaveResult, FederatedError>;
    fn load(&self, id: &str, schema: &SchemaRef) -> Result<Option<ContentNode>, FederatedError>;
    fn load_multiple(&self, ids: &[String], schema: &SchemaRef) -> Result<Vec<ContentNode>, FederatedError>;
    fn delete(&self, id: &str, schema: &SchemaRef) -> Result<DeleteResult, FederatedError>;
    fn query(
        &self,
        conditions: &[QueryCondition],
        sorts: &[SortSpec],
        range: &RangeSpec,
        schema: &SchemaRef,
    ) -> Result<Vec<ContentNode>, FederatedError>;
}

pub trait EventBus: Send + Sync {
    fn dispatch(
        &self,
        event: &str,
        payload: HashMap<String, Value>,
    ) -> Result<HashMap<String, Value>, FederatedError>;
}

// --- Cache entry ---

#[derive(Debug, Clone)]
struct CacheEntry {
    data: HashMap<String, Value>,
    expires_at: u64,
}

// --- Helpers ---

fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn cache_key(schema_name: &str, id: &str) -> String {
    format!("{}:{}", schema_name, id)
}

fn partition_fields(
    fields: &HashMap<String, Value>,
    local_field_names: &[String],
) -> (HashMap<String, Value>, HashMap<String, Value>) {
    let mut local = HashMap::new();
    let mut remote = HashMap::new();
    for (key, value) in fields {
        if local_field_names.contains(key) {
            local.insert(key.clone(), value.clone());
        } else {
            remote.insert(key.clone(), value.clone());
        }
    }
    (local, remote)
}

fn matches_condition(value: &Value, operator: &str, target: &Value) -> bool {
    match operator {
        "eq" => value == target,
        "neq" => value != target,
        "gt" => value_as_f64(value) > value_as_f64(target),
        "gte" => value_as_f64(value) >= value_as_f64(target),
        "lt" => value_as_f64(value) < value_as_f64(target),
        "lte" => value_as_f64(value) <= value_as_f64(target),
        "contains" => {
            if let (Some(haystack), Some(needle)) = (value.as_str(), target.as_str()) {
                haystack.contains(needle)
            } else {
                false
            }
        }
        "in" => {
            if let Some(arr) = target.as_array() {
                arr.contains(value)
            } else {
                false
            }
        }
        _ => false,
    }
}

fn value_as_f64(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}

fn apply_sort(nodes: &mut [ContentNode], sorts: &[SortSpec]) {
    nodes.sort_by(|a, b| {
        for sort in sorts {
            let a_val = a.fields.get(&sort.field);
            let b_val = b.fields.get(&sort.field);
            let ordering = match (a_val, b_val) {
                (None, None) => std::cmp::Ordering::Equal,
                (None, Some(_)) => std::cmp::Ordering::Less,
                (Some(_), None) => std::cmp::Ordering::Greater,
                (Some(av), Some(bv)) => {
                    let af = value_as_f64(av);
                    let bf = value_as_f64(bv);
                    if af == bf {
                        // Fall back to string comparison for non-numeric values
                        let a_str = av.as_str().unwrap_or("");
                        let b_str = bv.as_str().unwrap_or("");
                        a_str.cmp(b_str)
                    } else {
                        af.partial_cmp(&bf).unwrap_or(std::cmp::Ordering::Equal)
                    }
                }
            };
            let ordered = if sort.direction == "desc" {
                ordering.reverse()
            } else {
                ordering
            };
            if ordered != std::cmp::Ordering::Equal {
                return ordered;
            }
        }
        std::cmp::Ordering::Equal
    });
}

// --- Provider implementation ---

pub struct FederatedStorageProvider {
    local_backend: Box<dyn LocalStorageBackend>,
    cache: Mutex<HashMap<String, CacheEntry>>,
    event_bus: Box<dyn EventBus>,
}

impl FederatedStorageProvider {
    pub fn new(
        local_backend: Box<dyn LocalStorageBackend>,
        event_bus: Box<dyn EventBus>,
    ) -> Self {
        Self {
            local_backend,
            cache: Mutex::new(HashMap::new()),
            event_bus,
        }
    }

    fn get_cached(&self, key: &str) -> Option<HashMap<String, Value>> {
        let mut cache = self.cache.lock().ok()?;
        if let Some(entry) = cache.get(key) {
            if now_epoch_secs() <= entry.expires_at {
                return Some(entry.data.clone());
            }
            cache.remove(key);
        }
        None
    }

    fn set_cache(&self, key: String, data: HashMap<String, Value>, ttl_secs: u64) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(key, CacheEntry {
                data,
                expires_at: now_epoch_secs() + ttl_secs,
            });
        }
    }

    fn remove_cache(&self, key: &str) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.remove(key);
        }
    }

    fn load_remote_fields(
        &self,
        id: &str,
        schema: &SchemaRef,
        config: &FederationConfig,
    ) -> Result<HashMap<String, Value>, FederatedError> {
        let key = cache_key(&schema.name, id);

        // Check cache first
        if let Some(cached) = self.get_cached(&key) {
            return Ok(cached);
        }

        // Dispatch federated.load_remote through EventBus to trigger
        // Connector.read followed by FieldMapping.apply
        let mut payload = HashMap::new();
        payload.insert("id".to_string(), Value::String(id.to_string()));
        payload.insert("source".to_string(), Value::String(config.source.clone()));
        payload.insert(
            "fieldMapping".to_string(),
            config.field_mapping.as_ref()
                .map(|s| Value::String(s.clone()))
                .unwrap_or(Value::Null),
        );
        payload.insert("schemaName".to_string(), Value::String(schema.name.clone()));

        let result = self.event_bus.dispatch("federated.load_remote", payload)?;

        // Extract remote fields from the dispatch result
        let remote_data: HashMap<String, Value> = if let Some(fields_val) = result.get("fields") {
            serde_json::from_value(fields_val.clone()).unwrap_or_default()
        } else {
            result
        };

        self.set_cache(key, remote_data.clone(), config.cache_ttl);
        Ok(remote_data)
    }

    fn save_remote_fields(
        &self,
        id: &str,
        remote_fields: &HashMap<String, Value>,
        config: &FederationConfig,
    ) -> Result<(), FederatedError> {
        // Dispatch federated.save_remote through EventBus to trigger
        // FieldMapping.reverse followed by Connector.write
        let mut payload = HashMap::new();
        payload.insert("id".to_string(), Value::String(id.to_string()));
        payload.insert("fields".to_string(), serde_json::to_value(remote_fields).unwrap_or(Value::Null));
        payload.insert("source".to_string(), Value::String(config.source.clone()));
        payload.insert(
            "fieldMapping".to_string(),
            config.field_mapping.as_ref()
                .map(|s| Value::String(s.clone()))
                .unwrap_or(Value::Null),
        );

        self.event_bus.dispatch("federated.save_remote", payload)?;

        // Invalidate cache after remote write so next read picks up fresh data
        self.remove_cache(&cache_key(&config.source, id));
        Ok(())
    }

    pub fn load(&self, id: &str, schema: &SchemaRef) -> Result<Option<ContentNode>, FederatedError> {
        let config = &schema.associations.federation_config;

        // Load remote fields (cache-first, then EventBus dispatch on miss)
        let remote_fields = self.load_remote_fields(id, schema, config)?;

        // Load local fields from SQL backend
        let local_node = self.local_backend.load(id, schema)?;

        // If neither remote nor local has data, the entity does not exist
        if local_node.is_none() && remote_fields.is_empty() {
            return Ok(None);
        }

        // Merge: remote fields as the base, local fields overlay
        let mut merged_fields = remote_fields;
        if let Some(ref local) = local_node {
            for (key, value) in &local.fields {
                if config.local_fields.contains(key) {
                    merged_fields.insert(key.clone(), value.clone());
                }
            }
        }

        let mut metadata = local_node.as_ref()
            .and_then(|n| n.metadata.clone())
            .unwrap_or_default();
        metadata.insert("federated".to_string(), Value::Bool(true));
        metadata.insert("source".to_string(), Value::String(config.source.clone()));

        Ok(Some(ContentNode {
            id: id.to_string(),
            node_type: local_node.map(|n| n.node_type).unwrap_or_else(|| schema.name.clone()),
            fields: merged_fields,
            metadata: Some(metadata),
        }))
    }

    pub fn save(&self, node: &ContentNode, schema: &SchemaRef) -> Result<SaveResult, FederatedError> {
        let config = &schema.associations.federation_config;
        let (local_fields, remote_fields) = partition_fields(&node.fields, &config.local_fields);

        // Always persist local fields to the SQL backend
        let local_node = ContentNode {
            id: node.id.clone(),
            node_type: node.node_type.clone(),
            fields: local_fields,
            metadata: node.metadata.clone(),
        };
        let result = self.local_backend.save(&local_node, schema)?;

        // Write remote fields only when the remote source is writable
        if !config.read_only_remote && !remote_fields.is_empty() {
            self.save_remote_fields(&node.id, &remote_fields, config)?;
        }

        Ok(result)
    }

    pub fn load_multiple(
        &self,
        ids: &[String],
        schema: &SchemaRef,
    ) -> Result<Vec<ContentNode>, FederatedError> {
        let config = &schema.associations.federation_config;

        // Partition IDs into cache-hits and cache-misses for remote data
        let mut remote_data_map: HashMap<String, HashMap<String, Value>> = HashMap::new();
        let mut missed_ids: Vec<String> = Vec::new();

        for id in ids {
            let key = cache_key(&schema.name, id);
            if let Some(cached) = self.get_cached(&key) {
                remote_data_map.insert(id.clone(), cached);
            } else {
                missed_ids.push(id.clone());
            }
        }

        // Batch-fetch remote data for all cache misses via EventBus
        if !missed_ids.is_empty() {
            let mut payload = HashMap::new();
            payload.insert("ids".to_string(), serde_json::to_value(&missed_ids).unwrap_or(Value::Null));
            payload.insert("source".to_string(), Value::String(config.source.clone()));
            payload.insert(
                "fieldMapping".to_string(),
                config.field_mapping.as_ref()
                    .map(|s| Value::String(s.clone()))
                    .unwrap_or(Value::Null),
            );
            payload.insert("schemaName".to_string(), Value::String(schema.name.clone()));

            let batch_result = self.event_bus.dispatch("federated.load_remote_batch", payload)?;

            let batch_records: HashMap<String, HashMap<String, Value>> =
                batch_result.get("records")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default();

            for id in &missed_ids {
                let remote_data = batch_records.get(id).cloned().unwrap_or_default();
                self.set_cache(cache_key(&schema.name, id), remote_data.clone(), config.cache_ttl);
                remote_data_map.insert(id.clone(), remote_data);
            }
        }

        // Load all local fields in a single SQL query
        let local_nodes = self.local_backend.load_multiple(ids, schema)?;
        let mut local_map: HashMap<String, ContentNode> = HashMap::new();
        for node in local_nodes {
            local_map.insert(node.id.clone(), node);
        }

        // Merge per-ID
        let mut results = Vec::new();
        for id in ids {
            let remote_fields = remote_data_map.get(id).cloned().unwrap_or_default();
            let local_node = local_map.remove(id);

            if local_node.is_none() && remote_fields.is_empty() {
                continue;
            }

            let mut merged_fields = remote_fields;
            if let Some(ref local) = local_node {
                for (key, value) in &local.fields {
                    if config.local_fields.contains(key) {
                        merged_fields.insert(key.clone(), value.clone());
                    }
                }
            }

            let mut metadata = local_node.as_ref()
                .and_then(|n| n.metadata.clone())
                .unwrap_or_default();
            metadata.insert("federated".to_string(), Value::Bool(true));
            metadata.insert("source".to_string(), Value::String(config.source.clone()));

            results.push(ContentNode {
                id: id.clone(),
                node_type: local_node.map(|n| n.node_type).unwrap_or_else(|| schema.name.clone()),
                fields: merged_fields,
                metadata: Some(metadata),
            });
        }

        Ok(results)
    }

    pub fn delete(&self, id: &str, schema: &SchemaRef) -> Result<DeleteResult, FederatedError> {
        let config = &schema.associations.federation_config;

        // Always delete local data from the SQL backend
        let local_result = self.local_backend.delete(id, schema)?;

        // Evict from cache
        self.remove_cache(&cache_key(&schema.name, id));

        // If remote is writable, dispatch remote delete
        if !config.read_only_remote {
            let mut payload = HashMap::new();
            payload.insert("id".to_string(), Value::String(id.to_string()));
            payload.insert("source".to_string(), Value::String(config.source.clone()));
            payload.insert("schemaName".to_string(), Value::String(schema.name.clone()));
            self.event_bus.dispatch("federated.delete_remote", payload)?;
        }

        Ok(local_result)
    }

    pub fn query(
        &self,
        conditions: &[QueryCondition],
        sorts: &[SortSpec],
        range: &RangeSpec,
        schema: &SchemaRef,
    ) -> Result<Vec<ContentNode>, FederatedError> {
        let config = &schema.associations.federation_config;

        // Determine whether the query touches any remote fields
        let touches_remote = conditions.iter().any(|c| !config.local_fields.contains(&c.field));

        if !touches_remote {
            // Pure local query: delegate entirely to the SQL backend
            return self.local_backend.query(conditions, sorts, range, schema);
        }

        // Mixed or remote query: split conditions, load candidates, filter in memory
        let local_conditions: Vec<QueryCondition> = conditions.iter()
            .filter(|c| config.local_fields.contains(&c.field))
            .cloned()
            .collect();
        let remote_conditions: Vec<&QueryCondition> = conditions.iter()
            .filter(|c| !config.local_fields.contains(&c.field))
            .collect();

        // Fetch local candidates (apply only local conditions to narrow set)
        let unlimited_range = RangeSpec { offset: 0, limit: usize::MAX };
        let local_candidates = self.local_backend.query(
            &local_conditions,
            &[],
            &unlimited_range,
            schema,
        )?;

        // Load remote fields for each candidate and merge
        let mut merged: Vec<ContentNode> = Vec::new();
        for candidate in &local_candidates {
            let remote_fields = self.load_remote_fields(&candidate.id, schema, config)?;
            let mut merged_fields = remote_fields;
            for (key, value) in &candidate.fields {
                if config.local_fields.contains(key) {
                    merged_fields.insert(key.clone(), value.clone());
                }
            }

            // Apply remote conditions in memory
            let passes_remote = remote_conditions.iter().all(|cond| {
                match merged_fields.get(&cond.field) {
                    Some(val) => matches_condition(val, &cond.operator, &cond.value),
                    None => false,
                }
            });
            if !passes_remote {
                continue;
            }

            let mut metadata = candidate.metadata.clone().unwrap_or_default();
            metadata.insert("federated".to_string(), Value::Bool(true));
            metadata.insert("source".to_string(), Value::String(config.source.clone()));

            merged.push(ContentNode {
                id: candidate.id.clone(),
                node_type: candidate.node_type.clone(),
                fields: merged_fields,
                metadata: Some(metadata),
            });
        }

        // Apply sorting on the full merged set
        if !sorts.is_empty() {
            apply_sort(&mut merged, sorts);
        }

        // Apply range (offset + limit)
        let end = std::cmp::min(range.offset + range.limit, merged.len());
        let start = std::cmp::min(range.offset, merged.len());
        Ok(merged[start..end].to_vec())
    }

    /// Remove all expired entries from the in-memory cache.
    pub fn prune_cache(&self) -> usize {
        let now = now_epoch_secs();
        let mut pruned = 0;
        if let Ok(mut cache) = self.cache.lock() {
            cache.retain(|_, entry| {
                if now > entry.expires_at {
                    pruned += 1;
                    false
                } else {
                    true
                }
            });
        }
        pruned
    }

    /// Invalidate a specific cached entity or the entire cache.
    pub fn invalidate_cache(&self, id: Option<&str>, schema_name: Option<&str>) {
        if let Ok(mut cache) = self.cache.lock() {
            match (id, schema_name) {
                (Some(id), Some(name)) => {
                    cache.remove(&cache_key(name, id));
                }
                _ => cache.clear(),
            }
        }
    }
}
