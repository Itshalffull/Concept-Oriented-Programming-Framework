// Last-Write-Wins conflict resolution by timestamp comparison
// Always auto-resolves by selecting the version with the most recent timestamp.
// Simple but risks silent data loss when concurrent writes occur.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "lww_timestamp";
pub const PLUGIN_TYPE: &str = "conflict_resolver";

#[derive(Debug, Clone)]
pub enum Value {
    Null,
    String(String),
    Number(f64),
    Bool(bool),
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct Conflict {
    pub entity_id: String,
    pub version_a: HashMap<String, Value>,
    pub version_b: HashMap<String, Value>,
    pub ancestor: Option<HashMap<String, Value>>,
    pub field_conflicts: Vec<String>,
    pub timestamp_a: Option<u64>,
    pub timestamp_b: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct ResolverConfig {
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct Resolution {
    pub winner: HashMap<String, Value>,
    pub strategy: String,
    pub details: HashMap<String, Value>,
}

#[derive(Debug)]
pub enum ResolverError {
    MissingTimestamp(String),
}

impl std::fmt::Display for ResolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResolverError::MissingTimestamp(msg) => write!(f, "Missing timestamp: {}", msg),
        }
    }
}

pub struct LwwTimestampResolverProvider;

impl LwwTimestampResolverProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        conflict: &Conflict,
        _config: &ResolverConfig,
    ) -> Result<Resolution, ResolverError> {
        let ts_a = conflict.timestamp_a.unwrap_or(0);
        let ts_b = conflict.timestamp_b.unwrap_or(0);

        let a_wins = ts_a >= ts_b;
        let winner = if a_wins {
            conflict.version_a.clone()
        } else {
            conflict.version_b.clone()
        };

        let winning_ts = if a_wins { ts_a } else { ts_b };
        let losing_ts = if a_wins { ts_b } else { ts_a };
        let margin = if ts_a > ts_b { ts_a - ts_b } else { ts_b - ts_a };

        let mut details = HashMap::new();
        details.insert(
            "winning_version".to_string(),
            Value::String(if a_wins { "A" } else { "B" }.to_string()),
        );
        details.insert("winning_timestamp".to_string(), Value::Number(winning_ts as f64));
        details.insert("losing_timestamp".to_string(), Value::Number(losing_ts as f64));
        details.insert("margin_ms".to_string(), Value::Number(margin as f64));
        details.insert(
            "entity_id".to_string(),
            Value::String(conflict.entity_id.clone()),
        );
        details.insert(
            "fields_overwritten".to_string(),
            Value::Array(
                conflict
                    .field_conflicts
                    .iter()
                    .map(|f| Value::String(f.clone()))
                    .collect(),
            ),
        );
        details.insert(
            "silent_data_loss_risk".to_string(),
            Value::Bool(!conflict.field_conflicts.is_empty()),
        );

        Ok(Resolution {
            winner,
            strategy: "lww_timestamp".to_string(),
            details,
        })
    }

    pub fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        true
    }
}
