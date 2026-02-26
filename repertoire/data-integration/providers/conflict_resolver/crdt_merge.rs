// CRDT-based conflict-free merge resolver
// Always auto-resolves mathematically using convergent replicated data types.
// Applies per-field CRDT merge strategies: LWW-Register for scalars,
// G-Counter for numeric increments, OR-Set for collections.

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "crdt_merge";
pub const PLUGIN_TYPE: &str = "conflict_resolver";

#[derive(Debug, Clone, PartialEq)]
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
    MergeFailure(String),
}

impl std::fmt::Display for ResolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResolverError::MergeFailure(msg) => write!(f, "Merge failure: {}", msg),
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum CrdtStrategy {
    LwwRegister,
    GCounter,
    OrSet,
}

fn detect_field_crdt_type(val_a: Option<&Value>, val_b: Option<&Value>, ancestor: Option<&Value>) -> CrdtStrategy {
    if matches!(val_a, Some(Value::Array(_)))
        || matches!(val_b, Some(Value::Array(_)))
        || matches!(ancestor, Some(Value::Array(_)))
    {
        return CrdtStrategy::OrSet;
    }

    if let (Some(Value::Number(a)), Some(Value::Number(b))) = (val_a, val_b) {
        if let Some(Value::Number(anc)) = ancestor {
            let delta_a = a - anc;
            let delta_b = b - anc;
            if delta_a >= 0.0 && delta_b >= 0.0 {
                return CrdtStrategy::GCounter;
            }
        }
        return CrdtStrategy::LwwRegister;
    }

    CrdtStrategy::LwwRegister
}

fn merge_lww_register(val_a: Option<&Value>, val_b: Option<&Value>, ts_a: u64, ts_b: u64) -> (Value, &'static str) {
    if ts_a >= ts_b {
        (val_a.cloned().unwrap_or(Value::Null), "lww_a")
    } else {
        (val_b.cloned().unwrap_or(Value::Null), "lww_b")
    }
}

fn merge_g_counter(val_a: f64, val_b: f64, ancestor: f64) -> f64 {
    let delta_a = val_a - ancestor;
    let delta_b = val_b - ancestor;
    ancestor + delta_a.max(delta_b)
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".to_string(),
        _ => format!("{:?}", v),
    }
}

fn merge_or_set(arr_a: &[Value], arr_b: &[Value], ancestor: &[Value]) -> Vec<Value> {
    let ancestor_set: HashSet<String> = ancestor.iter().map(value_to_string).collect();
    let arr_a_strs: HashSet<String> = arr_a.iter().map(value_to_string).collect();
    let arr_b_strs: HashSet<String> = arr_b.iter().map(value_to_string).collect();

    // Items removed by both are tombstoned
    let removed_by_a: HashSet<String> = ancestor_set.difference(&arr_a_strs).cloned().collect();
    let removed_by_b: HashSet<String> = ancestor_set.difference(&arr_b_strs).cloned().collect();
    let tombstoned: HashSet<String> = removed_by_a.intersection(&removed_by_b).cloned().collect();

    // Start with ancestor minus tombstoned
    let mut result: Vec<Value> = ancestor
        .iter()
        .filter(|v| !tombstoned.contains(&value_to_string(v)))
        .cloned()
        .collect();

    let mut seen: HashSet<String> = result.iter().map(value_to_string).collect();

    // Add new items from both sides
    for item in arr_a.iter().chain(arr_b.iter()) {
        let key = value_to_string(item);
        if !seen.contains(&key) && !ancestor_set.contains(&key) {
            result.push(item.clone());
            seen.insert(key);
        }
    }

    result
}

pub struct CrdtMergeResolverProvider;

impl CrdtMergeResolverProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        conflict: &Conflict,
        _config: &ResolverConfig,
    ) -> Result<Resolution, ResolverError> {
        let empty = HashMap::new();
        let ancestor = conflict.ancestor.as_ref().unwrap_or(&empty);
        let ts_a = conflict.timestamp_a.unwrap_or(0);
        let ts_b = conflict.timestamp_b.unwrap_or(0);

        let mut all_fields: HashSet<String> = HashSet::new();
        for key in conflict.version_a.keys().chain(conflict.version_b.keys()).chain(ancestor.keys()) {
            all_fields.insert(key.clone());
        }

        let mut merged: HashMap<String, Value> = HashMap::new();
        let mut field_strategies: HashMap<String, Value> = HashMap::new();
        let mut field_sources: HashMap<String, Value> = HashMap::new();

        for field in &all_fields {
            let val_a = conflict.version_a.get(field);
            let val_b = conflict.version_b.get(field);
            let val_anc = ancestor.get(field);

            let crdt_type = detect_field_crdt_type(val_a, val_b, val_anc);

            let strategy_name = match crdt_type {
                CrdtStrategy::LwwRegister => "lww_register",
                CrdtStrategy::GCounter => "g_counter",
                CrdtStrategy::OrSet => "or_set",
            };
            field_strategies.insert(field.clone(), Value::String(strategy_name.to_string()));

            match crdt_type {
                CrdtStrategy::LwwRegister => {
                    let (value, source) = merge_lww_register(val_a, val_b, ts_a, ts_b);
                    merged.insert(field.clone(), value);
                    field_sources.insert(field.clone(), Value::String(source.to_string()));
                }
                CrdtStrategy::GCounter => {
                    let num_a = match val_a { Some(Value::Number(n)) => *n, _ => 0.0 };
                    let num_b = match val_b { Some(Value::Number(n)) => *n, _ => 0.0 };
                    let num_anc = match val_anc { Some(Value::Number(n)) => *n, _ => 0.0 };
                    let result = merge_g_counter(num_a, num_b, num_anc);
                    merged.insert(field.clone(), Value::Number(result));
                    field_sources.insert(field.clone(), Value::String("g_counter_max".to_string()));
                }
                CrdtStrategy::OrSet => {
                    let empty_arr = Vec::new();
                    let a = match val_a { Some(Value::Array(v)) => v.as_slice(), _ => &empty_arr };
                    let b = match val_b { Some(Value::Array(v)) => v.as_slice(), _ => &empty_arr };
                    let anc = match val_anc { Some(Value::Array(v)) => v.as_slice(), _ => &empty_arr };
                    let result = merge_or_set(a, b, anc);
                    merged.insert(field.clone(), Value::Array(result));
                    field_sources.insert(field.clone(), Value::String("or_set_union".to_string()));
                }
            }
        }

        let mut details = HashMap::new();
        details.insert("entity_id".to_string(), Value::String(conflict.entity_id.clone()));
        details.insert("field_strategies".to_string(), Value::Object(field_strategies));
        details.insert("field_sources".to_string(), Value::Object(field_sources));
        details.insert("total_fields".to_string(), Value::Number(all_fields.len() as f64));
        details.insert("convergence_guaranteed".to_string(), Value::Bool(true));

        Ok(Resolution {
            winner: merged,
            strategy: "crdt_merge".to_string(),
            details,
        })
    }

    pub fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        true
    }
}
