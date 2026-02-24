// Per-field comparison conflict resolver with partial auto-resolve capability
// Iterates all fields in both versions, comparing against the ancestor to determine
// which side changed each field. True conflicts arise only when both sides modified
// the same field to different values.

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "field_merge";
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

fn collect_all_fields(
    a: &HashMap<String, Value>,
    b: &HashMap<String, Value>,
    ancestor: &HashMap<String, Value>,
) -> HashSet<String> {
    let mut fields = HashSet::new();
    for key in a.keys().chain(b.keys()).chain(ancestor.keys()) {
        fields.insert(key.clone());
    }
    fields
}

pub struct FieldMergeResolverProvider;

impl FieldMergeResolverProvider {
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
        let all_fields = collect_all_fields(&conflict.version_a, &conflict.version_b, ancestor);

        let mut merged: HashMap<String, Value> = HashMap::new();
        let mut auto_merged: Vec<String> = Vec::new();
        let mut true_conflicts: Vec<String> = Vec::new();
        let mut field_decisions: HashMap<String, Value> = HashMap::new();

        for field in &all_fields {
            let val_anc = ancestor.get(field);
            let val_a = conflict.version_a.get(field);
            let val_b = conflict.version_b.get(field);

            let a_changed = val_anc != val_a;
            let b_changed = val_anc != val_b;

            if !a_changed && !b_changed {
                if let Some(v) = val_anc {
                    merged.insert(field.clone(), v.clone());
                }
                field_decisions.insert(field.clone(), Value::String("unchanged".to_string()));
            } else if a_changed && !b_changed {
                if let Some(v) = val_a {
                    merged.insert(field.clone(), v.clone());
                }
                auto_merged.push(field.clone());
                field_decisions.insert(field.clone(), Value::String("took_version_a".to_string()));
            } else if !a_changed && b_changed {
                if let Some(v) = val_b {
                    merged.insert(field.clone(), v.clone());
                }
                auto_merged.push(field.clone());
                field_decisions.insert(field.clone(), Value::String("took_version_b".to_string()));
            } else if val_a == val_b {
                if let Some(v) = val_a {
                    merged.insert(field.clone(), v.clone());
                }
                auto_merged.push(field.clone());
                field_decisions.insert(field.clone(), Value::String("both_agree".to_string()));
            } else {
                true_conflicts.push(field.clone());
                if let Some(v) = val_a {
                    merged.insert(field.clone(), v.clone());
                }
                field_decisions.insert(
                    field.clone(),
                    Value::String("conflict_defaulted_to_a".to_string()),
                );
            }
        }

        let fully_resolved = true_conflicts.is_empty();
        let mut details = HashMap::new();
        details.insert(
            "entity_id".to_string(),
            Value::String(conflict.entity_id.clone()),
        );
        details.insert(
            "auto_merged_fields".to_string(),
            Value::Array(auto_merged.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "true_conflicts".to_string(),
            Value::Array(true_conflicts.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert("field_decisions".to_string(), Value::Object(field_decisions));
        details.insert("total_fields".to_string(), Value::Number(all_fields.len() as f64));
        details.insert(
            "auto_merged_count".to_string(),
            Value::Number(auto_merged.len() as f64),
        );
        details.insert(
            "true_conflict_count".to_string(),
            Value::Number(true_conflicts.len() as f64),
        );
        details.insert("fully_resolved".to_string(), Value::Bool(fully_resolved));

        Ok(Resolution {
            winner: merged,
            strategy: "field_merge".to_string(),
            details,
        })
    }

    pub fn can_auto_resolve(&self, conflict: &Conflict) -> bool {
        let empty = HashMap::new();
        let ancestor = conflict.ancestor.as_ref().unwrap_or(&empty);
        let all_fields = collect_all_fields(&conflict.version_a, &conflict.version_b, ancestor);

        for field in &all_fields {
            let val_anc = ancestor.get(field);
            let val_a = conflict.version_a.get(field);
            let val_b = conflict.version_b.get(field);

            let a_changed = val_anc != val_a;
            let b_changed = val_anc != val_b;

            if a_changed && b_changed && val_a != val_b {
                return false;
            }
        }

        true
    }
}
